import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  QrCode, X, Camera, CameraOff, RefreshCw, CheckCircle2, 
  AlertTriangle, Zap, SwitchCamera, Info, Truck, FileText 
} from 'lucide-react';
import { Vehicle, FuelLog } from '../types';
import jsQR from 'jsqr';
import { parseVehicleFromScannedQRCode } from '../utils/qrcodeParser';
import { getSectorName, getFuelTypeName } from '../utils/calculations';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  fuelLogs?: FuelLog[];
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  darkMode: boolean;
}

type CameraErrorType = 
  | 'PERMISSION_DENIED' 
  | 'NO_CAMERA' 
  | 'IN_USE' 
  | 'NOT_SUPPORTED' 
  | 'INSECURE_CONTEXT' 
  | 'UNKNOWN' 
  | null;

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  fuelLogs = [],
  onOpenDigitalSheet,
  darkMode
}) => {
  // Video & Stream references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const isProcessingFrameRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);
  const [errorType, setErrorType] = useState<CameraErrorType>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [identifiedVehicle, setIdentifiedVehicle] = useState<Vehicle | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [unrecognizedCode, setUnrecognizedCode] = useState<string | null>(null);
  const [selectedManualId, setSelectedManualId] = useState<string>(vehicles[0]?.id || '');

  /**
   * Safely stops and releases all camera tracks and hardware resources
   */
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[Camera QR] Erro ao encerrar track:', e);
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    setCameraActive(false);
    setTorchOn(false);
  }, []);

  /**
   * Starts camera with requested facing mode and handles permissions/errors
   */
  const startCamera = useCallback(async (targetFacing: 'environment' | 'user' = facingMode) => {
    setIsLoadingCamera(true);
    setErrorMessage(null);
    setErrorType(null);
    setUnrecognizedCode(null);

    // 1. Verify HTTPS / Secure Context
    const isLocalhost = 
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
      setIsLoadingCamera(false);
      setErrorType('INSECURE_CONTEXT');
      setErrorMessage(
        'Acesso à câmera bloqueado: o navegador exige uma conexão segura HTTPS (ou localhost). Por favor, verifique se a URL utiliza https://.'
      );
      return;
    }

    // 2. Verify mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoadingCamera(false);
      setErrorType('NOT_SUPPORTED');
      setErrorMessage(
        'Este navegador não possui suporte ao acesso de mídia/câmera. Recomendamos utilizar o Google Chrome atualizado no Android.'
      );
      return;
    }

    // Stop any previously active camera to prevent device conflict
    stopCamera();

    try {
      // 3. Request camera stream - prefer rear (environment) camera on mobile
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: any) {
        // Fallback for single camera devices or specific webview constraints
        console.warn('[Camera QR] Tentativa com facingMode ideal falhou, tentando fallback genérico:', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;

      // Check if torch/flashlight is supported on the active video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = (typeof videoTrack.getCapabilities === 'function') 
          ? videoTrack.getCapabilities() 
          : {};
        setHasTorch(Boolean(capabilities?.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('[Camera QR] Autoplay do elemento video:', playErr);
        }
      }

      setCameraActive(true);
      setIsLoadingCamera(false);
    } catch (err: any) {
      setIsLoadingCamera(false);
      setCameraActive(false);
      console.error('[Camera QR] Erro ao obter mídia de câmera:', err);

      const errorName = err.name || '';
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setErrorType('PERMISSION_DENIED');
        setErrorMessage(
          'Permissão de acesso à câmera negada. Para escanear o QR Code, você deve permitir o uso da câmera nas configurações ou no ícone de cadeado do navegador.'
        );
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setErrorType('NO_CAMERA');
        setErrorMessage('Nenhuma câmera física foi localizada neste dispositivo ou tablet.');
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        setErrorType('IN_USE');
        setErrorMessage('A câmera pode estar em uso por outro aplicativo ou aba. Feche outros programas e tente novamente.');
      } else if (errorName === 'SecurityError') {
        setErrorType('INSECURE_CONTEXT');
        setErrorMessage('Acesso à câmera bloqueado por política de segurança. O leitor requer HTTPS seguro.');
      } else {
        setErrorType('UNKNOWN');
        setErrorMessage(`Não foi possível iniciar a câmera (${err.message || 'Erro inesperado'}).`);
      }
    }
  }, [facingMode, stopCamera]);

  /**
   * Toggle flashlight/torch if supported by device hardware
   */
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const nextState = !torchOn;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('[Camera QR] Erro ao alternar lanterna:', err);
    }
  }, [hasTorch, torchOn]);

  /**
   * Switch between front and back camera
   */
  const toggleFacingMode = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  /**
   * Handle successful detection of a QR Code payload
   */
  const handleScannedPayload = useCallback((rawText: string) => {
    if (!rawText || isSuccess) return;

    const matched = parseVehicleFromScannedQRCode(rawText, vehicles);

    if (matched) {
      // Haptic vibration feedback on supported mobile devices
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([60, 40, 80]);
        } catch {
          // ignore
        }
      }

      setIsSuccess(true);
      setIdentifiedVehicle(matched);

      // Stop camera tracks immediately
      stopCamera();

      // Seamless internal navigation to digital sheet after quick visual confirmation
      setTimeout(() => {
        onClose();
        if (onOpenDigitalSheet) {
          onOpenDigitalSheet(matched);
        }
      }, 500);
    } else {
      // QR detected but not an AndradeAgro machine
      setUnrecognizedCode(rawText);
      setTimeout(() => {
        setUnrecognizedCode(null);
      }, 4000);
    }
  }, [isSuccess, vehicles, stopCamera, onClose, onOpenDigitalSheet]);

  // Start camera when modal opens, stop on close, unmount, or mobile background suspension
  useEffect(() => {
    if (isOpen) {
      startCamera();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera();
      } else if (document.visibilityState === 'visible' && isOpen && !isSuccess) {
        startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, [isOpen, isSuccess, startCamera, stopCamera]);

  // Frame processing loop for QR detection
  useEffect(() => {
    if (!cameraActive || isSuccess) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video || isProcessingFrameRef.current) return;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

      isProcessingFrameRef.current = true;

      try {
        // 1. Try native BarcodeDetector API if available (Chrome Android / modern browsers)
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
              handleScannedPayload(barcodes[0].rawValue);
              return;
            }
          } catch {
            // Fallback directly to jsQR
          }
        }

        // 2. Pure JavaScript jsQR processing via hidden canvas (universal compatibility)
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            handleScannedPayload(code.data);
            return;
          }
        }
      } catch (loopErr) {
        console.warn('[Camera QR] Erro no processamento de frame:', loopErr);
      } finally {
        isProcessingFrameRef.current = false;
      }
    }, 120);

    scanIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [cameraActive, isSuccess, handleScannedPayload]);

  /**
   * Manual fallback selection if camera is unavailable or label damaged
   */
  const handleManualSelect = () => {
    const found = vehicles.find(v => v.id === selectedManualId);
    if (found) {
      stopCamera();
      onClose();
      if (onOpenDigitalSheet) {
        onOpenDigitalSheet(found);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div 
        className={`w-full max-w-lg rounded-3xl shadow-2xl border p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col overflow-hidden ${
          darkMode ? 'bg-[#042d23] border-emerald-900 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#064E3B] text-[#FACC15] shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-tight">
                Leitor de QR Code • Câmera
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-emerald-300/80">
                Aponte a câmera para a etiqueta colada na máquina
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              stopCamera();
              onClose();
            }} 
            className="p-2 min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 dark:hover:bg-emerald-900/50 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
            title="Fechar leitor"
            aria-label="Fechar leitor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Camera Viewport */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
          
          {/* SUCCESS BANNER */}
          {isSuccess && identifiedVehicle && (
            <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-100 space-y-2 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 animate-bounce" />
                <div>
                  <span className="text-[10px] font-black uppercase bg-emerald-700/50 text-emerald-100 px-2 py-0.5 rounded-md">
                    Identificado com Sucesso
                  </span>
                  <h3 className="text-sm font-black mt-0.5">
                    {identifiedVehicle.model} ({identifiedVehicle.licensePlate || identifiedVehicle.patrimonyCode})
                  </h3>
                </div>
              </div>
              <p className="text-xs text-emerald-200/90 font-medium">
                Abrindo a ficha técnica e controle de manutenção da máquina...
              </p>
            </div>
          )}

          {/* UNRECOGNIZED QR CODE WARNING */}
          {unrecognizedCode && !isSuccess && (
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p>QR Code detectado, porém não corresponde a nenhuma máquina do AndradeAgro.</p>
                <p className="text-[10px] opacity-75 truncate mt-0.5">Conteúdo: {unrecognizedCode}</p>
              </div>
            </div>
          )}

          {/* CAMERA VIEWPORT CONTAINER */}
          <div className="relative rounded-2xl bg-black border-2 border-emerald-800/80 overflow-hidden shadow-inner aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center">
            
            {/* Hidden Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                cameraActive ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* SCANNER OVERLAY / VIEWFINDER (when camera is active) */}
            {cameraActive && !isSuccess && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                
                {/* Visual Viewfinder Target */}
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/40 rounded-3xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  
                  {/* Viewfinder Corners */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#FACC15] rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#FACC15] rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#FACC15] rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#FACC15] rounded-br-xl" />

                  {/* Animated Scanning Laser */}
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#FACC15] to-transparent animate-[bounce_2s_infinite] shadow-[0_0_12px_#FACC15]" />
                </div>

                {/* Subtitle prompt */}
                <span className="mt-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-xs text-[11px] font-bold text-emerald-200 border border-emerald-800/60 shadow-sm">
                  Posicione o QR Code no centro do quadro
                </span>
              </div>
            )}

            {/* CAMERA CONTROLS (Torch & Switch) */}
            {cameraActive && !isSuccess && (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10 pointer-events-auto">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-full border backdrop-blur-md transition-all ${
                      torchOn 
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg' 
                        : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                    }`}
                    title={torchOn ? 'Desligar Lanterna' : 'Ligar Lanterna'}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={toggleFacingMode}
                  className="p-2.5 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md transition-all"
                  title="Alternar Câmera (Traseira/Frontal)"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* LOADING STATE */}
            {isLoadingCamera && (
              <div className="absolute inset-0 bg-[#031d16]/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-900/60 border border-emerald-700/60 flex items-center justify-center animate-pulse">
                  <Camera className="w-6 h-6 text-[#FACC15]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-100">Iniciando câmera do dispositivo...</p>
                  <p className="text-[11px] text-emerald-300/80">Solicitando permissão para leitura de QR Code</p>
                </div>
              </div>
            )}

            {/* ERROR OR PERMISSION BLOCKED STATE */}
            {!isLoadingCamera && !cameraActive && errorType && (
              <div className="absolute inset-0 bg-[#031d16] p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
                <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400 shrink-0">
                  <CameraOff className="w-6 h-6" />
                </div>

                <div className="space-y-1 max-w-xs">
                  <h4 className="text-xs font-black text-rose-200">
                    {errorType === 'PERMISSION_DENIED' ? 'Permissão de Câmera Negada' :
                     errorType === 'NO_CAMERA' ? 'Câmera Não Localizada' :
                     errorType === 'IN_USE' ? 'Câmera em Uso por Outro App' :
                     errorType === 'INSECURE_CONTEXT' ? 'Conexão HTTPS Necessária' :
                     'Não Foi Possível Abrir a Câmera'}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>

                <button
                  onClick={() => startCamera()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar Novamente / Abrir Câmera</span>
                </button>
              </div>
            )}

          </div>

          {/* MANUAL SELECTION FALLBACK (Zero Blockage Guarantee) */}
          <div className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
            darkMode ? 'bg-emerald-950/40 border-emerald-800/40' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-emerald-200 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Ou selecione a máquina na lista:</span>
              </label>
              <span className="text-[10px] text-slate-400">Opção sem câmera</span>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedManualId}
                onChange={(e) => setSelectedManualId(e.target.value)}
                className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    [{v.category}] {v.model} - {v.licensePlate || v.patrimonyCode}
                  </option>
                ))}
              </select>

              <button
                onClick={handleManualSelect}
                className="px-3.5 py-2.5 rounded-xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-bold text-xs flex items-center gap-1.5 shadow-sm shrink-0 transition-transform active:scale-95"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Abrir Ficha</span>
              </button>
            </div>
          </div>

          {/* INSTRUCTION NOTE */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 text-[#FACC15] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Navegação Interna:</strong> Ao identificar o QR Code, a ficha técnica da máquina é aberta instantaneamente dentro do AndradeAgro com horímetro, trocas de óleo e manutenções, sem abrir novas abas.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
