import React, { useState, useEffect } from 'react';
import { 
  Settings, Shield, RotateCcw, CheckCircle2, Fuel, AlertTriangle, 
  Scale, History, Edit3, ShieldAlert, Check, RefreshCw
} from 'lucide-react';
import { SystemSettings, User, CentralTank } from '../types';
import { 
  resetSystemData, getCentralTanks, getTankStatus, updateCentralTank, getTankMovements 
} from '../utils/storage';
import { EditCentralTankModal } from './EditCentralTankModal';
import { PushNotificationSettingsCard } from './PushNotificationSettingsCard';

interface SettingsAndAboutViewProps {
  settings: SystemSettings;
  currentUser: User;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  darkMode: boolean;
}

export const SettingsAndAboutView: React.FC<SettingsAndAboutViewProps> = ({
  settings,
  currentUser,
  onUpdateSettings,
  darkMode
}) => {
  const [employeeEditTimeLimitHours, setEmployeeEditTimeLimitHours] = useState<string | number>(settings.employeeEditTimeLimitHours || 24);
  const [suspiciousFuelMarginPercentage, setSuspiciousFuelMarginPercentage] = useState<string | number>(settings.suspiciousFuelMarginPercentage || 25);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Central Tanks state
  const [centralTanks, setCentralTanks] = useState<CentralTank[]>(getCentralTanks());
  const [selectedTankForModal, setSelectedTankForModal] = useState<CentralTank | null>(null);

  // Quadra Form State
  const quadraTank = centralTanks.find(t => t.id === 'tank-quadra') || centralTanks[0];
  const quadraStatus = getTankStatus('tank-quadra');
  const [quadraCapacity, setQuadraCapacity] = useState<string | number>(quadraTank?.capacityLiters || 10000);
  const [quadraStock, setQuadraStock] = useState<string | number>(quadraStatus?.currentStock ?? 6500);
  const [quadraMinAlert, setQuadraMinAlert] = useState<string | number>(quadraTank?.minStockAlertLiters || 2000);
  const [quadraReason, setQuadraReason] = useState<string>('');
  const [quadraError, setQuadraError] = useState<string | null>(null);
  const [quadraSaved, setQuadraSaved] = useState<boolean>(false);
  const [quadraSubmitting, setQuadraSubmitting] = useState<boolean>(false);

  // Itapeva Form State
  const itapevaTank = centralTanks.find(t => t.id === 'tank-itapeva') || centralTanks[1];
  const itapevaStatus = getTankStatus('tank-itapeva');
  const [itapevaCapacity, setItapevaCapacity] = useState<string | number>(itapevaTank?.capacityLiters || 15000);
  const [itapevaStock, setItapevaStock] = useState<string | number>(itapevaStatus?.currentStock ?? 9000);
  const [itapevaMinAlert, setItapevaMinAlert] = useState<string | number>(itapevaTank?.minStockAlertLiters || 2000);
  const [itapevaReason, setItapevaReason] = useState<string>('');
  const [itapevaError, setItapevaError] = useState<string | null>(null);
  const [itapevaSaved, setItapevaSaved] = useState<boolean>(false);
  const [itapevaSubmitting, setItapevaSubmitting] = useState<boolean>(false);

  const refreshTanks = () => {
    const tanks = getCentralTanks();
    setCentralTanks(tanks);
    const qTank = tanks.find(t => t.id === 'tank-quadra') || tanks[0];
    const qStat = getTankStatus('tank-quadra');
    if (qTank) {
      setQuadraCapacity(qTank.capacityLiters || 10000);
      setQuadraStock(qStat ? Math.round(qStat.currentStock * 100) / 100 : (qTank.currentStockLiters || 6500));
      setQuadraMinAlert(qTank.minStockAlertLiters || 2000);
    }
    const iTank = tanks.find(t => t.id === 'tank-itapeva') || tanks[1];
    const iStat = getTankStatus('tank-itapeva');
    if (iTank) {
      setItapevaCapacity(iTank.capacityLiters || 15000);
      setItapevaStock(iStat ? Math.round(iStat.currentStock * 100) / 100 : (iTank.currentStockLiters || 9000));
      setItapevaMinAlert(iTank.minStockAlertLiters || 2000);
    }
  };

  useEffect(() => {
    setEmployeeEditTimeLimitHours(settings.employeeEditTimeLimitHours || 24);
    setSuspiciousFuelMarginPercentage(settings.suspiciousFuelMarginPercentage || 25);
    refreshTanks();
  }, [settings]);

  useEffect(() => {
    const handleUpdate = () => refreshTanks();
    window.addEventListener('andradeagro_data_updated', handleUpdate);
    return () => window.removeEventListener('andradeagro_data_updated', handleUpdate);
  }, []);

  // Quadra Percentage
  const numQuadraCap = Number(quadraCapacity) || 0;
  const numQuadraStock = Number(quadraStock) || 0;
  const numQuadraMin = Number(quadraMinAlert) || 0;
  const quadraPct = numQuadraCap > 0 ? Math.round(((numQuadraStock / numQuadraCap) * 100) * 10) / 10 : 0;
  const isQuadraLow = numQuadraStock <= numQuadraMin;
  const isQuadraCritical = numQuadraStock <= Math.max(500, numQuadraMin * 0.25);
  const quadraStockDiff = numQuadraStock - (quadraStatus?.currentStock ?? (quadraTank?.currentStockLiters || 0));
  const hasQuadraStockChanged = Math.abs(quadraStockDiff) > 0.01;

  // Itapeva Percentage
  const numItapevaCap = Number(itapevaCapacity) || 0;
  const numItapevaStock = Number(itapevaStock) || 0;
  const numItapevaMin = Number(itapevaMinAlert) || 0;
  const itapevaPct = numItapevaCap > 0 ? Math.round(((numItapevaStock / numItapevaCap) * 100) * 10) / 10 : 0;
  const isItapevaLow = numItapevaStock <= numItapevaMin;
  const isItapevaCritical = numItapevaStock <= Math.max(500, numItapevaMin * 0.25);
  const itapevaStockDiff = numItapevaStock - (itapevaStatus?.currentStock ?? (itapevaTank?.currentStockLiters || 0));
  const hasItapevaStockChanged = Math.abs(itapevaStockDiff) > 0.01;

  // Validate Quadra
  const handleQuadraStockChange = (val: string) => {
    setQuadraStock(val);
    const num = Number(val);
    if (!isNaN(num) && num > numQuadraCap && numQuadraCap > 0) {
      setQuadraError('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
    } else if (!isNaN(num) && num < 0) {
      setQuadraError('A quantidade atual em estoque não pode ser negativa.');
    } else {
      setQuadraError(null);
    }
  };

  const handleQuadraCapacityChange = (val: string) => {
    setQuadraCapacity(val);
    const num = Number(val);
    if (!isNaN(num) && numQuadraStock > num && num > 0) {
      setQuadraError('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
    } else {
      setQuadraError(null);
    }
  };

  // Validate Itapeva
  const handleItapevaStockChange = (val: string) => {
    setItapevaStock(val);
    const num = Number(val);
    if (!isNaN(num) && num > numItapevaCap && numItapevaCap > 0) {
      setItapevaError('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
    } else if (!isNaN(num) && num < 0) {
      setItapevaError('A quantidade atual em estoque não pode ser negativa.');
    } else {
      setItapevaError(null);
    }
  };

  const handleItapevaCapacityChange = (val: string) => {
    setItapevaCapacity(val);
    const num = Number(val);
    if (!isNaN(num) && numItapevaStock > num && num > 0) {
      setItapevaError('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
    } else {
      setItapevaError(null);
    }
  };

  // Save Quadra Tank
  const handleSaveQuadra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numQuadraCap) || numQuadraCap <= 0) {
      setQuadraError('A capacidade máxima deve ser maior que zero.');
      return;
    }
    if (isNaN(numQuadraStock) || numQuadraStock < 0) {
      setQuadraError('A quantidade atual em estoque não pode ser negativa.');
      return;
    }
    if (numQuadraStock > numQuadraCap) {
      setQuadraError('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
      return;
    }

    setQuadraSubmitting(true);
    setQuadraError(null);
    try {
      await updateCentralTank(
        'tank-quadra',
        {
          capacityLiters: numQuadraCap,
          currentStockLiters: numQuadraStock,
          minStockAlertLiters: numQuadraMin
        },
        hasQuadraStockChanged ? (quadraReason.trim() || 'Ajuste manual de estoque na configuração') : undefined
      );
      setQuadraSaved(true);
      setQuadraReason('');
      setTimeout(() => setQuadraSaved(false), 3500);
    } catch (err: any) {
      setQuadraError(err?.message || 'Erro ao salvar Tanque Quadra.');
    } finally {
      setQuadraSubmitting(false);
    }
  };

  // Save Itapeva Tank
  const handleSaveItapeva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numItapevaCap) || numItapevaCap <= 0) {
      setItapevaError('A capacidade máxima deve ser maior que zero.');
      return;
    }
    if (isNaN(numItapevaStock) || numItapevaStock < 0) {
      setItapevaError('A quantidade atual em estoque não pode ser negativa.');
      return;
    }
    if (numItapevaStock > numItapevaCap) {
      setItapevaError('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
      return;
    }

    setItapevaSubmitting(true);
    setItapevaError(null);
    try {
      await updateCentralTank(
        'tank-itapeva',
        {
          capacityLiters: numItapevaCap,
          currentStockLiters: numItapevaStock,
          minStockAlertLiters: numItapevaMin
        },
        hasItapevaStockChanged ? (itapevaReason.trim() || 'Ajuste manual de estoque na configuração') : undefined
      );
      setItapevaSaved(true);
      setItapevaReason('');
      setTimeout(() => setItapevaSaved(false), 3500);
    } catch (err: any) {
      setItapevaError(err?.message || 'Erro ao salvar Tanque Itapeva.');
    } finally {
      setItapevaSubmitting(false);
    }
  };

  // Save General Operational Rules
  const handleSaveGeneralSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      employeeEditTimeLimitHours: Math.max(1, Number(employeeEditTimeLimitHours) || 24),
      suspiciousFuelMarginPercentage: Math.max(1, Number(suspiciousFuelMarginPercentage) || 25)
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja restaurar o banco de dados inicial do AndradeAgro?')) {
      resetSystemData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#FACC15]" />
            Configurações do Sistema & Tanques Centrais
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Parametrização individual de tanques de combustível, limites de segurança e regras operacionais da AndradeAgro.
          </p>
        </div>

        <button
          onClick={refreshTanks}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          title="Recarregar dados"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar Valores</span>
        </button>
      </div>

      {/* SECTION 1: TANQUES CENTRAIS INDEPENDENTES (QUADRA & ITAPEVA) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⛽</span>
          <h2 className="text-base font-extrabold text-slate-100">
            Configuração dos Tanques Centrais Independentes
          </h2>
          <span className="text-[10px] bg-[#FACC15]/20 text-[#FACC15] px-2 py-0.5 rounded-full font-bold border border-[#FACC15]/30">
            Quadra & Itapeva
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ==================== 1. TANQUE CENTRAL - QUADRA ==================== */}
          <div 
            id="config-tank-quadra-card"
            className={`p-6 rounded-3xl border space-y-4 flex flex-col justify-between ${
              darkMode ? 'bg-[#042d23] border-emerald-800/80 shadow-md' : 'bg-white border-emerald-100 shadow-sm'
            }`}
          >
            <div>
              {/* Header do Tanque Quadra */}
              <div className="flex items-start justify-between gap-2 border-b border-emerald-800/40 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⛽</span>
                    <h3 className="font-black text-base text-slate-100">
                      Tanque Central - Quadra
                    </h3>
                  </div>
                  <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                    Localização: <strong className="text-white">Sede Quadra</strong> • Diesel S10
                  </p>
                </div>

                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                  isQuadraCritical 
                    ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' 
                    : (isQuadraLow 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40')
                }`}>
                  {isQuadraCritical ? '🔴 Crítico' : (isQuadraLow ? '⚠️ Baixo' : '🟢 Normal')}
                </span>
              </div>

              {/* Visão em Tempo Real & Percentual Calculado */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 space-y-2 mb-4">
                <div className="flex items-baseline justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">Status de Estoque</span>
                    <span className="font-black text-slate-100 text-sm">
                      {numQuadraStock.toLocaleString('pt-BR')} L <span className="text-emerald-400 text-xs font-bold">/ {numQuadraCap.toLocaleString('pt-BR')} L</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">Percentual</span>
                    <span className="font-black text-[#FACC15] text-base">
                      {quadraPct}% da capacidade
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-emerald-900 rounded-full overflow-hidden border border-emerald-800 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      isQuadraCritical ? 'bg-red-500' : (isQuadraLow ? 'bg-amber-500' : 'bg-[#FACC15]')
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, quadraPct))}%` }}
                  />
                </div>

                {/* Low stock notice */}
                {isQuadraLow && (
                  <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>🔴 Estoque baixo (Estoque atual: {numQuadraStock.toLocaleString('pt-BR')} L • Mínimo: {numQuadraMin.toLocaleString('pt-BR')} L)</span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {quadraError && (
                <div className="p-3 mb-4 rounded-xl bg-red-950/90 border border-red-700 text-red-200 font-bold text-xs flex items-center gap-2 animate-shake">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{quadraError}</span>
                </div>
              )}

              {/* Success Message */}
              {quadraSaved && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-900/90 border border-emerald-600 text-emerald-200 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0" />
                  <span>Tanque Central - Quadra atualizado com sucesso!</span>
                </div>
              )}

              {/* Form Quadra */}
              <form id="form-tank-quadra" onSubmit={handleSaveQuadra} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold mb-1 text-slate-200">
                    Capacidade Máxima do Tanque (Litros) <span className="text-[#FACC15]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-quadra-capacity"
                      type="number"
                      required
                      min="100"
                      step="any"
                      value={quadraCapacity}
                      onChange={(e) => handleQuadraCapacityChange(e.target.value)}
                      placeholder="Ex: 10000"
                      className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                        darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white focus:border-[#FACC15] focus:outline-none' : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-emerald-400 font-bold text-xs pointer-events-none">
                      L
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-400/80 mt-0.5">
                    Limite físico do tanque de Quadra (ex: 10.000 L).
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-200">
                    Quantidade Atual em Estoque (Litros) <span className="text-[#FACC15]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-quadra-stock"
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={quadraStock}
                      onChange={(e) => handleQuadraStockChange(e.target.value)}
                      placeholder="Ex: 6500"
                      className={`w-full p-2.5 rounded-xl border font-black text-xs ${
                        darkMode ? 'bg-emerald-950/60 border-emerald-800 text-[#FACC15] focus:border-[#FACC15] focus:outline-none' : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-[#FACC15] font-bold text-xs pointer-events-none">
                      L
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-400/80 mt-0.5">
                    Combustível existente neste momento no tanque de Quadra.
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-200">
                    Estoque Mínimo para Alerta (Litros)
                  </label>
                  <div className="relative">
                    <input
                      id="input-quadra-min-alert"
                      type="number"
                      min="0"
                      step="any"
                      value={quadraMinAlert}
                      onChange={(e) => setQuadraMinAlert(e.target.value)}
                      placeholder="Padrão: 2000"
                      className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                        darkMode ? 'bg-emerald-950/60 border-emerald-800 text-amber-300 focus:border-[#FACC15] focus:outline-none' : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-amber-400 font-bold text-xs pointer-events-none">
                      L
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-400/80 mt-0.5">
                    Disparo de alerta se o estoque atual for menor ou igual (padrão: 2.000 L).
                  </p>
                </div>

                {/* Justificativa se o estoque mudou */}
                {hasQuadraStockChanged && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-1.5 animate-in fade-in">
                    <div className="flex justify-between text-[11px] font-bold text-amber-300">
                      <span>Ajuste de Estoque Detectado:</span>
                      <span>{quadraStockDiff > 0 ? `+${quadraStockDiff.toLocaleString('pt-BR')}` : quadraStockDiff.toLocaleString('pt-BR')} L</span>
                    </div>
                    <label className="block text-[10px] font-bold text-amber-200">
                      Motivo / Observação da Alteração <span className="text-[#FACC15]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={quadraReason}
                      onChange={(e) => setQuadraReason(e.target.value)}
                      placeholder="Ex: Medição física com régua, acerto de inventário..."
                      className={`w-full p-2 rounded-lg border text-xs ${
                        darkMode ? 'bg-emerald-950 border-amber-600/70 text-white' : 'bg-white'
                      }`}
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedTankForModal(quadraTank)}
                    className="text-xs text-[#FACC15] font-extrabold hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Abrir em Modal Completo</span>
                  </button>

                  <button
                    type="submit"
                    disabled={quadraSubmitting || !!quadraError}
                    className="px-4 py-2 rounded-xl bg-[#FACC15] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {quadraSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Salvar Tanque Quadra</span>
                  </button>
                </div>
              </form>
            </div>
          </div>


          {/* ==================== 2. TANQUE CENTRAL - ITAPEVA ==================== */}
          <div 
            id="config-tank-itapeva-card"
            className={`p-6 rounded-3xl border space-y-4 flex flex-col justify-between ${
              darkMode ? 'bg-[#042d23] border-emerald-800/80 shadow-md' : 'bg-white border-emerald-100 shadow-sm'
            }`}
          >
            <div>
              {/* Header do Tanque Itapeva */}
              <div className="flex items-start justify-between gap-2 border-b border-emerald-800/40 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⛽</span>
                    <h3 className="font-black text-base text-slate-100">
                      Tanque Central - Itapeva
                    </h3>
                  </div>
                  <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                    Localização: <strong className="text-white">Sede Itapeva</strong> • Diesel S10
                  </p>
                </div>

                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                  isItapevaCritical 
                    ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' 
                    : (isItapevaLow 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40')
                }`}>
                  {isItapevaCritical ? '🔴 Crítico' : (isItapevaLow ? '⚠️ Baixo' : '🟢 Normal')}
                </span>
              </div>

              {/* Visão em Tempo Real & Percentual Calculado */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 space-y-2 mb-4">
                <div className="flex items-baseline justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">Status de Estoque</span>
                    <span className="font-black text-slate-100 text-sm">
                      {numItapevaStock.toLocaleString('pt-BR')} L <span className="text-emerald-400 text-xs font-bold">/ {numItapevaCap.toLocaleString('pt-BR')} L</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">Percentual</span>
                    <span className="font-black text-[#FACC15] text-base">
                      {itapevaPct}% da capacidade
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-emerald-900 rounded-full overflow-hidden border border-emerald-800 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      isItapevaCritical ? 'bg-red-500' : (isItapevaLow ? 'bg-amber-500' : 'bg-[#FACC15]')
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, itapevaPct))}%` }}
                  />
                </div>

                {/* Low stock notice */}
                {isItapevaLow && (
                  <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>🔴 Estoque baixo (Estoque atual: {numItapevaStock.toLocaleString('pt-BR')} L • Mínimo: {numItapevaMin.toLocaleString('pt-BR')} L)</span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {itapevaError && (
                <div className="p-3 mb-4 rounded-xl bg-red-950/90 border border-red-700 text-red-200 font-bold text-xs flex items-center gap-2 animate-shake">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{itapevaError}</span>
                </div>
              )}

              {/* Success Message */}
              {itapevaSaved && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-900/90 border border-emerald-600 text-emerald-200 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0" />
                  <span>Tanque Central - Itapeva atualizado com sucesso!</span>
                </div>
              )}

              {/* Form Itapeva */}
              <form id="form-tank-itapeva" onSubmit={handleSaveItapeva} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold mb-1 text-slate-200">
                    Capacidade Máxima do Tanque (Litros) <span className="text-[#FACC15]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-itapeva-capacity"
                      type="number"
                      required
                      min="100"
                      step="any"
                      value={itapevaCapacity}
                      onChange={(e) => handleItapevaCapacityChange(e.target.value)}
                      placeholder="Ex: 15000"
                      className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                        darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white focus:border-[#FACC15] focus:outline-none' : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-emerald-400 font-bold text-xs pointer-events-none">
                      L
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-400/80 mt-0.5">
                    Limite físico do tanque de Itapeva (ex: 15.000 L).
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-200">
                    Quantidade Atual em Estoque (Litros) <span className="text-[#FACC15]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-itapeva-stock"
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={itapevaStock}
                      onChange={(e) => handleItapevaStockChange(e.target.value)}
                      placeholder="Ex: 9000"
                      className={`w-full p-2.5 rounded-xl border font-black text-xs ${
                        darkMode ? 'bg-emerald-950/60 border-emerald-800 text-[#FACC15] focus:border-[#FACC15] focus:outline-none' : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-[#FACC15] font-bold text-xs pointer-events-none">
                      L
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-400/80 mt-0.5">
                    Combustível existente neste momento no tanque de Itapeva.
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-200">
                    Estoque Mínimo para Alerta (Litros)
                  </label>
                  <div className="relative">
                    <input
                      id="input-itapeva-min-alert"
                      type="number"
                      min="0"
                      step="any"
                      value={itapevaMinAlert}
                      onChange={(e) => setItapevaMinAlert(e.target.value)}
                      placeholder="Padrão: 2000"
                      className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                        darkMode ? 'bg-emerald-950/60 border-emerald-800 text-amber-300 focus:border-[#FACC15] focus:outline-none' : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-amber-400 font-bold text-xs pointer-events-none">
                      L
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-400/80 mt-0.5">
                    Disparo de alerta se o estoque atual for menor ou igual (padrão: 2.000 L).
                  </p>
                </div>

                {/* Justificativa se o estoque mudou */}
                {hasItapevaStockChanged && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-1.5 animate-in fade-in">
                    <div className="flex justify-between text-[11px] font-bold text-amber-300">
                      <span>Ajuste de Estoque Detectado:</span>
                      <span>{itapevaStockDiff > 0 ? `+${itapevaStockDiff.toLocaleString('pt-BR')}` : itapevaStockDiff.toLocaleString('pt-BR')} L</span>
                    </div>
                    <label className="block text-[10px] font-bold text-amber-200">
                      Motivo / Observação da Alteração <span className="text-[#FACC15]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={itapevaReason}
                      onChange={(e) => setItapevaReason(e.target.value)}
                      placeholder="Ex: Medição física com régua, acerto de inventário..."
                      className={`w-full p-2 rounded-lg border text-xs ${
                        darkMode ? 'bg-emerald-950 border-amber-600/70 text-white' : 'bg-white'
                      }`}
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedTankForModal(itapevaTank)}
                    className="text-xs text-[#FACC15] font-extrabold hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Abrir em Modal Completo</span>
                  </button>

                  <button
                    type="submit"
                    disabled={itapevaSubmitting || !!itapevaError}
                    className="px-4 py-2 rounded-xl bg-[#FACC15] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {itapevaSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Salvar Tanque Itapeva</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>

      {/* PUSH NOTIFICATIONS REAL-TIME */}
      {currentUser && (
        <div className="pt-2">
          <PushNotificationSettingsCard currentUser={currentUser} darkMode={darkMode} />
        </div>
      )}

      {/* SECTION 2: REGRAS OPERACIONAIS & INFORMAÇÕES DA EMPRESA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        
        {/* Settings Form */}
        <div className={`lg:col-span-7 p-6 rounded-3xl border space-y-4 ${
          darkMode ? 'bg-[#042d23] border-emerald-800/80 shadow-md' : 'bg-white border-emerald-100 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 font-bold text-sm text-slate-100 border-b pb-3 border-emerald-800/40">
            <Shield className="w-4 h-4 text-[#FACC15]" />
            <span>Parâmetros de Auditoria & Margens de Segurança</span>
          </div>

          <form onSubmit={handleSaveGeneralSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold mb-1 text-slate-200">
                Janela de Edição Recente para Funcionários (Horas)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={employeeEditTimeLimitHours}
                onChange={(e) => setEmployeeEditTimeLimitHours(e.target.value)}
                className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white' : 'bg-gray-50'}`}
              />
              <p className="text-[11px] text-emerald-400/80 mt-1">
                Funcionários só poderão editar registros criados por eles dentro deste número de horas.
              </p>
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-200">
                Margem para Disparo de Alerta de Consumo Suspeito (%)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={suspiciousFuelMarginPercentage}
                onChange={(e) => setSuspiciousFuelMarginPercentage(e.target.value)}
                className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white' : 'bg-gray-50'}`}
              />
              <p className="text-[11px] text-emerald-400/80 mt-1">
                Gera alerta automático se a média de consumo for X% pior que o histórico do equipamento.
              </p>
            </div>

            {savedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-200 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FACC15]" />
                <span>Parâmetros operacionais salvos com sucesso!</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar Base Inicial
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#064E3B] hover:bg-emerald-800 border border-emerald-600/40 text-white font-bold text-xs shadow-md transition-colors"
              >
                Salvar Parâmetros
              </button>
            </div>
          </form>
        </div>

        {/* Brand Presentation Card */}
        <div className={`lg:col-span-5 p-6 rounded-3xl border space-y-4 ${
          darkMode ? 'bg-gradient-to-br from-[#03231b] to-[#043327] border-emerald-800 text-emerald-100' : 'bg-gradient-to-br from-emerald-900 to-emerald-950 text-white border-emerald-900 shadow-md'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-bold shadow-md">
              <Fuel className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Andrade<span className="text-[#FACC15]">Agro</span></h2>
              <p className="text-xs text-[#FACC15] font-semibold">{settings.slogan}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs opacity-90 leading-relaxed border-t border-emerald-800/40 pt-3">
            <p>
              O <strong>AndradeAgro</strong> é a plataforma central de controle de abastecimentos, gestão de frotas, manutenção preventiva de máquinas agrícolas e auditoria de combustível.
            </p>
            <p>
              Os dois tanques centrais (Sede Quadra e Sede Itapeva) operam com estoque automatizado, alimentando instantaneamente a Visão Geral e os alertas inteligentes.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-[11px] space-y-1">
            <p><strong>CNPJ:</strong> {settings.cnpj}</p>
            <p><strong>Endereço:</strong> {settings.address}</p>
            <p><strong>Contato:</strong> {settings.contactEmail} • {settings.phone}</p>
            <p><strong>Versão:</strong> 2.5.0 (Multi-Tank Agro Engine)</p>
          </div>
        </div>

      </div>

      {/* Edit Central Tank Modal when clicked */}
      {selectedTankForModal && (
        <EditCentralTankModal
          isOpen={!!selectedTankForModal}
          tank={selectedTankForModal}
          currentUser={currentUser}
          onClose={() => setSelectedTankForModal(null)}
          onSave={async (tankId, updates, reason) => {
            await updateCentralTank(tankId, updates, reason);
            refreshTanks();
          }}
          darkMode={darkMode}
        />
      )}

    </div>
  );
};
