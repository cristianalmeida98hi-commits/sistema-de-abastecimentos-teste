import React, { useState, useMemo } from 'react';
import { 
  QrCode, Search, Printer, Download, Truck, 
  CheckCircle2, Camera, Clock, Calendar, ExternalLink,
  FileText, Info
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Vehicle, User, FuelLog } from '../types';
import { formatCurrency, getFuelTypeName, getSectorName, getCategoryLabel } from '../utils/calculations';
import { generateQRCodeDataUrl } from '../utils/qrcode';
import { openPrintWindow } from '../utils/printWindow';

interface QRCodeModuleViewProps {
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  currentUser: User;
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  onOpenQRScanner?: () => void;
  darkMode: boolean;
}

export const QRCodeModuleView: React.FC<QRCodeModuleViewProps> = ({
  vehicles,
  fuelLogs,
  currentUser,
  onOpenDigitalSheet,
  onOpenQRScanner,
  darkMode
}) => {
  const [activeTab, setActiveTab] = useState<'GENERATOR' | 'SCANNER'>('GENERATOR');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Selected Machine for Detailed QR Inspection & Scanned Result
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(vehicles[0] || null);

  // Scanner Simulator State
  const [scannedVehicleId, setScannedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (selectedCategory !== 'ALL' && v.category !== selectedCategory) return false;
      if (selectedSector !== 'ALL' && v.sector !== selectedSector) return false;
      if (search) {
        const q = search.toLowerCase();
        const m = v.model.toLowerCase().includes(q);
        const p = (v.licensePlate || v.patrimonyCode || '').toLowerCase().includes(q);
        const f = v.manufacturer.toLowerCase().includes(q);
        if (!m && !p && !f) return false;
      }
      return true;
    });
  }, [vehicles, selectedCategory, selectedSector, search]);

  // Up-to-date data for the currently selected/scanned vehicle
  const currentScannedVehicle = useMemo(() => {
    if (!selectedVehicle) return null;
    return vehicles.find(v => v.id === selectedVehicle.id) || selectedVehicle;
  }, [selectedVehicle, vehicles]);

  // Fueling history for the selected vehicle
  const selectedVehicleFuelLogs = useMemo(() => {
    if (!currentScannedVehicle) return [];
    return fuelLogs
      .filter(f => f.equipmentId === currentScannedVehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [currentScannedVehicle, fuelLogs]);

  // Trigger Scanner Simulation
  const handleSimulateScan = (vehicleId: string) => {
    const v = vehicles.find(item => item.id === vehicleId);
    if (v) {
      setSelectedVehicle(v);
      if (onOpenDigitalSheet) {
        onOpenDigitalSheet(v);
      }
      setScanSuccessMessage(`Ficha Digital e Aba de Manutenção abertas para: ${v.model} (${v.licensePlate || v.patrimonyCode})`);
      setTimeout(() => setScanSuccessMessage(null), 4000);
    }
  };

  // Generate unique URL/ID link stored in QR Code
  const getVehicleQRCodeValue = (v: Vehicle) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://andradeagro.app';
    return `${origin}/#ficha-maquina/${v.id}`;
  };

  // Print Badge for single machine
  const handlePrintBadge = async (v: Vehicle) => {
    const qrValue = getVehicleQRCodeValue(v);
    const qrDataUrl = await generateQRCodeDataUrl(qrValue, 350);
    const categoryLabel = getCategoryLabel(v.category);
    const sectorName = getSectorName(v.sector);
    const tankInfo = v.fuelType === 'NENHUM' ? 'Não aplica' : `${v.tankCapacityLiters}L`;

    const makeCardHtml = (extraClass = '') => `
      <div class="card ${extraClass}">
        <div class="card-header">
          <div class="brand-title">ANDRADEAGRO</div>
          <div class="card-subtitle">IDENTIFICAÇÃO DO EQUIPAMENTO</div>
          <div class="model" title="${v.model}">${v.model}</div>
          <div class="code-badge">${v.licensePlate || v.patrimonyCode}</div>
        </div>
        <div class="qr-container">
          <img src="${qrDataUrl}" alt="QR" />
        </div>
        <div class="card-footer">
          <span>Setor: ${sectorName} • Cap.: ${tankInfo}</span>
        </div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Etiqueta QR Code - ${v.model} (${v.licensePlate || v.patrimonyCode})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: #0f172a;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 100%;
              height: auto;
            }
            .no-print {
              background: #022c22;
              color: #ffffff;
              padding: 12px 20px;
              border-bottom: 2px solid #044E36;
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.3);
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .no-print h2 {
              font-size: 13px;
              font-weight: 900;
              color: #FACC15;
              letter-spacing: 0.5px;
            }
            .mode-tabs {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
              background: #011913;
              padding: 4px;
              border-radius: 8px;
              border: 1px solid #044E36;
            }
            .mode-btn {
              padding: 6px 11px;
              font-size: 11px;
              font-weight: 700;
              border-radius: 6px;
              border: none;
              cursor: pointer;
              background: transparent;
              color: #94a3b8;
              transition: all 0.15s;
              white-space: nowrap;
            }
            .mode-btn.active {
              background: #044E36;
              color: #ffffff;
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            }
            .action-btns {
              display: flex;
              gap: 8px;
            }
            .btn {
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 800;
              border-radius: 8px;
              cursor: pointer;
              border: none;
            }
            .btn-print { background: #FACC15; color: #022c22; }
            .btn-print:hover { background: #eab308; }
            .btn-close { background: #334155; color: #ffffff; }

            .page-container {
              padding: 12mm 0 20mm 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10mm;
            }

            /* Single Card Mode */
            .single-wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
              padding: 16px;
              background: #ffffff;
              border: 2px dashed #94a3b8;
              border-radius: 12px;
              box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            .cut-guide {
              font-size: 11px;
              color: #475569;
              font-weight: 700;
            }

            /* Multi-card Sheet Pages */
            .sheet-page {
              box-sizing: border-box;
              width: 198mm;
              height: 284mm;
              max-height: 284mm;
              background: #ffffff;
              box-shadow: 0 6px 20px rgba(0,0,0,0.3);
              border-radius: 4px;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden;
              display: flex;
              flex-wrap: wrap;
              align-content: flex-start;
            }
            .sheet-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }

            /* Card styling with vivid colors & high contrast */
            .card {
              box-sizing: border-box;
              border: 1.5px solid #044E36;
              border-radius: 8px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              background: #ffffff;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-inside: avoid-page !important;
              -webkit-column-break-inside: avoid !important;
              overflow: hidden;
              position: relative;
              box-shadow: 0 1px 3px rgba(0,0,0,0.06);
              transform: translateZ(0);
            }
            .card-header {
              width: 100%;
              text-align: center;
              padding: 1.5mm 1mm 0 1mm;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .brand-title {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 900;
              color: #044E36;
              letter-spacing: 1.2px;
              text-transform: uppercase;
              line-height: 1.1;
            }
            .card-subtitle {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 800;
              color: #D97706;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              line-height: 1.1;
              margin-top: 1px;
            }
            .model {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 850;
              color: #0f172a;
              line-height: 1.15;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              margin-top: 1.5px;
            }
            .code-badge {
              background: #044E36;
              color: #FFFFFF;
              font-weight: 900;
              border-radius: 5px;
              border: 1px solid #065F46;
              display: inline-block;
              margin-top: 1.5px;
              letter-spacing: 0.8px;
              box-shadow: 0 1px 2px rgba(4,78,54,0.18);
              white-space: nowrap;
            }
            .qr-container {
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 1mm 0;
              background: #ffffff;
              padding: 2px;
              border-radius: 4px;
            }
            .qr-container img {
              display: block;
              image-rendering: pixelated;
              image-rendering: crisp-edges;
            }
            .card-footer {
              width: 100%;
              border-top: 1px solid #E2E8F0;
              background: #F8FAFC;
              padding: 1.2mm 1.5mm;
              display: flex;
              justify-content: center;
              align-items: center;
              font-weight: 750;
              color: #064E3B;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-align: center;
            }

            /* Formats */
            /* 16 por folha (4x4) */
            .sheet-page.d-16 { gap: 2mm; padding: 2.5mm; }
            .sheet-page.d-16 .card {
              width: calc((100% - 3 * 2mm) / 4);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 1.5mm 1mm;
            }
            .sheet-page.d-16 .brand-title { font-size: 7.5pt; }
            .sheet-page.d-16 .card-subtitle { font-size: 5.2pt; }
            .sheet-page.d-16 .model { font-size: 7pt; }
            .sheet-page.d-16 .code-badge { font-size: 7.5pt; padding: 1px 6px; }
            .sheet-page.d-16 .qr-container img { width: 28mm; height: 28mm; }
            .sheet-page.d-16 .card-footer { font-size: 5.5pt; padding: 0.8mm 1mm; }

            /* 12 por folha (3x4) */
            .sheet-page.d-12 { gap: 2.5mm; padding: 2.5mm; }
            .sheet-page.d-12 .card {
              width: calc((100% - 2 * 2.5mm) / 3);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 1.8mm 1.5mm;
            }
            .sheet-page.d-12 .brand-title { font-size: 8.5pt; }
            .sheet-page.d-12 .card-subtitle { font-size: 6pt; }
            .sheet-page.d-12 .model { font-size: 8pt; }
            .sheet-page.d-12 .code-badge { font-size: 8.5pt; padding: 1.5px 8px; }
            .sheet-page.d-12 .qr-container img { width: 32mm; height: 32mm; }
            .sheet-page.d-12 .card-footer { font-size: 6.5pt; padding: 1mm 1.5mm; }

            /* 8 por folha (2x4) */
            .sheet-page.d-8 { gap: 3.5mm; padding: 2.5mm; }
            .sheet-page.d-8 .card {
              width: calc((100% - 1 * 3.5mm) / 2);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 2mm 3mm;
            }
            .sheet-page.d-8 .brand-title { font-size: 9pt; }
            .sheet-page.d-8 .card-subtitle { font-size: 6.5pt; }
            .sheet-page.d-8 .model { font-size: 8.5pt; }
            .sheet-page.d-8 .code-badge { font-size: 9pt; padding: 1.5px 8px; }
            .sheet-page.d-8 .qr-container img { width: 34mm; height: 34mm; }
            .sheet-page.d-8 .card-footer { font-size: 7pt; padding: 1mm 2mm; }

            /* 4 por folha (2x2) */
            .sheet-page.d-4 { gap: 5mm; padding: 3mm; }
            .sheet-page.d-4 .card {
              width: calc((100% - 1 * 5mm) / 2);
              height: 128mm;
              max-height: 128mm;
              padding: 4mm 5mm;
            }
            .sheet-page.d-4 .brand-title { font-size: 14pt; letter-spacing: 2px; }
            .sheet-page.d-4 .card-subtitle { font-size: 9.5pt; }
            .sheet-page.d-4 .model { font-size: 12pt; }
            .sheet-page.d-4 .code-badge { font-size: 12pt; padding: 3px 12px; }
            .sheet-page.d-4 .qr-container img { width: 68mm; height: 68mm; }
            .sheet-page.d-4 .card-footer { font-size: 9pt; padding: 2mm 3mm; }

            /* Standalone single card style */
            .single-wrapper .card {
              width: 72mm;
              height: 72mm;
              padding: 2.5mm;
            }
            .single-wrapper .brand-title { font-size: 8.5pt; }
            .single-wrapper .card-subtitle { font-size: 6pt; }
            .single-wrapper .model { font-size: 8pt; }
            .single-wrapper .code-badge { font-size: 8.5pt; padding: 1.5px 8px; }
            .single-wrapper .qr-container img { width: 36mm; height: 36mm; }
            .single-wrapper .card-footer { font-size: 6.5pt; padding: 1mm 1.5mm; }

            /* Absolute anti-break protection for Mobile & Desktop printing */
            @media print {
              @page {
                size: A4 portrait;
                margin: 6mm 5mm;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              html, body {
                background: #ffffff !important;
                color: #0f172a !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }
              .page-container {
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                width: 100% !important;
                gap: 0 !important;
              }
              .single-wrapper {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                background: transparent !important;
                margin: 0 auto !important;
              }
              .cut-guide { display: none !important; }
              .sheet-page {
                margin: 0 auto !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                width: 100% !important;
                max-width: 198mm !important;
                height: auto !important;
                min-height: 255mm !important;
                max-height: 272mm !important;
                page-break-before: auto !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                overflow: visible !important;
                display: flex !important;
                flex-wrap: wrap !important;
                align-content: flex-start !important;
                background: #ffffff !important;
              }
              .sheet-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .card {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                break-inside: avoid-page !important;
                -webkit-column-break-inside: avoid !important;
                transform: translateZ(0);
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <div>
              <h2>${v.model} (${v.licensePlate || v.patrimonyCode})</h2>
            </div>
            <div class="mode-tabs">
              <button class="mode-btn active" id="btn-m-single" onclick="setMode('single')">1 Etiqueta Avulsa</button>
              <button class="mode-btn" id="btn-m-16" onclick="setMode(16)">📋 Folha 16 (Máx. Rendimento)</button>
              <button class="mode-btn" id="btn-m-12" onclick="setMode(12)">📋 Folha 12 (Padrão)</button>
              <button class="mode-btn" id="btn-m-8" onclick="setMode(8)">📋 Folha 8 (Amplo)</button>
              <button class="mode-btn" id="btn-m-4" onclick="setMode(4)">📋 Folha 4 (Grande)</button>
            </div>
            <div class="action-btns">
              <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir</button>
              <button class="btn btn-close" onclick="window.close()">✕ Fechar</button>
            </div>
          </div>

          <div class="page-container" id="content-container">
            <div class="single-wrapper" id="single-view">
              <span class="cut-guide">✂️ Linha de Corte da Etiqueta</span>
              ${makeCardHtml()}
            </div>
            <div class="sheet-page d-16" id="view-16" style="display: none;">
              ${Array(16).fill(makeCardHtml()).join('')}
            </div>
            <div class="sheet-page d-12" id="view-12" style="display: none;">
              ${Array(12).fill(makeCardHtml()).join('')}
            </div>
            <div class="sheet-page d-8" id="view-8" style="display: none;">
              ${Array(8).fill(makeCardHtml()).join('')}
            </div>
            <div class="sheet-page d-4" id="view-4" style="display: none;">
              ${Array(4).fill(makeCardHtml()).join('')}
            </div>
          </div>

          <script>
            function setMode(mode) {
              const views = {
                'single': document.getElementById('single-view'),
                '16': document.getElementById('view-16'),
                '12': document.getElementById('view-12'),
                '8': document.getElementById('view-8'),
                '4': document.getElementById('view-4'),
              };
              const buttons = {
                'single': document.getElementById('btn-m-single'),
                '16': document.getElementById('btn-m-16'),
                '12': document.getElementById('btn-m-12'),
                '8': document.getElementById('btn-m-8'),
                '4': document.getElementById('btn-m-4'),
              };

              Object.keys(views).forEach(key => {
                if (views[key]) views[key].style.display = 'none';
                if (buttons[key]) buttons[key].classList.remove('active');
              });

              const key = String(mode);
              if (views[key]) views[key].style.display = 'flex';
              if (buttons[key]) buttons[key].classList.add('active');
            }
          </script>
        </body>
      </html>
    `;

    openPrintWindow(htmlContent);
  };

  // Batch Print for all filtered machines with maximized A4 paper efficiency and zero card breaks
  const handleBatchPrint = async () => {
    const cardsDataPromises = filteredVehicles.map(async v => {
      const qrValue = getVehicleQRCodeValue(v);
      const qrDataUrl = await generateQRCodeDataUrl(qrValue, 350);
      const categoryLabel = getCategoryLabel(v.category);
      const sectorName = getSectorName(v.sector);
      const tankInfo = v.fuelType === 'NENHUM' ? 'Não aplica' : `${v.tankCapacityLiters}L`;

      return {
        model: v.model,
        code: v.licensePlate || v.patrimonyCode,
        categoryLabel,
        sectorName,
        tankInfo,
        qrDataUrl
      };
    });

    const cardsData = await Promise.all(cardsDataPromises);
    const totalCount = cardsData.length;
    const cardsDataJson = JSON.stringify(cardsData);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Impressão Otimizada de QR Codes - AndradeAgro (${totalCount} Máquinas)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: #0f172a;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 100%;
              height: auto;
            }
            .no-print {
              background: #022c22;
              color: #ffffff;
              padding: 12px 20px;
              border-bottom: 2px solid #044E36;
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.3);
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .info-group {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .info-title {
              font-size: 14px;
              font-weight: 900;
              color: #ffffff;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .info-subtitle {
              font-size: 11px;
              color: #a7f3d0;
            }
            .info-subtitle strong {
              color: #FACC15;
            }
            .density-group {
              display: flex;
              align-items: center;
              flex-wrap: wrap;
              gap: 4px;
              background: #011913;
              padding: 4px;
              border-radius: 8px;
              border: 1px solid #044E36;
            }
            .density-label {
              font-size: 11px;
              font-weight: 700;
              color: #94a3b8;
              padding: 0 6px;
            }
            .density-btn {
              padding: 6px 10px;
              font-size: 11px;
              font-weight: 700;
              border-radius: 6px;
              border: none;
              cursor: pointer;
              background: transparent;
              color: #94a3b8;
              transition: all 0.15s;
              white-space: nowrap;
            }
            .density-btn.active {
              background: #044E36;
              color: #ffffff;
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            }
            .action-btns {
              display: flex;
              gap: 8px;
            }
            .btn {
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 800;
              border-radius: 8px;
              cursor: pointer;
              border: none;
            }
            .btn-print { background: #FACC15; color: #022c22; }
            .btn-print:hover { background: #eab308; }
            .btn-close { background: #334155; color: #ffffff; }

            .page-container {
              padding: 12mm 0 20mm 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10mm;
            }

            /* Sheet Page Container - Strictly bounded to A4 usable area */
            .sheet-page {
              box-sizing: border-box;
              width: 198mm;
              height: 284mm;
              max-height: 284mm;
              background: #ffffff;
              box-shadow: 0 6px 20px rgba(0,0,0,0.3);
              border-radius: 4px;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden;
              display: flex;
              flex-wrap: wrap;
              align-content: flex-start;
            }
            .sheet-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }

            /* Card element base styles with vivid colors and high definition */
            .card {
              box-sizing: border-box;
              border: 1.5px solid #044E36;
              border-radius: 8px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              background: #ffffff;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-inside: avoid-page !important;
              -webkit-column-break-inside: avoid !important;
              overflow: hidden;
              position: relative;
              box-shadow: 0 1px 3px rgba(0,0,0,0.06);
              transform: translateZ(0);
            }
            .card-header {
              width: 100%;
              text-align: center;
              padding: 1.5mm 1mm 0 1mm;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .brand-title {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 900;
              color: #044E36;
              letter-spacing: 1.2px;
              text-transform: uppercase;
              line-height: 1.1;
            }
            .card-subtitle {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 800;
              color: #D97706;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              line-height: 1.1;
              margin-top: 1px;
            }
            .model {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 850;
              color: #0f172a;
              line-height: 1.15;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              margin-top: 1.5px;
            }
            .code-badge {
              background: #044E36;
              color: #FFFFFF;
              font-weight: 900;
              border-radius: 5px;
              border: 1px solid #065F46;
              display: inline-block;
              margin-top: 1.5px;
              letter-spacing: 0.8px;
              box-shadow: 0 1px 2px rgba(4,78,54,0.18);
              white-space: nowrap;
            }
            .qr-container {
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 1mm 0;
              background: #ffffff;
              padding: 2px;
              border-radius: 4px;
            }
            .qr-container img {
              display: block;
              image-rendering: pixelated;
              image-rendering: crisp-edges;
            }
            .card-footer {
              width: 100%;
              border-top: 1px solid #E2E8F0;
              background: #F8FAFC;
              padding: 1.2mm 1.5mm;
              display: flex;
              justify-content: center;
              align-items: center;
              font-weight: 750;
              color: #064E3B;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-align: center;
            }

            /* Density 16 (4 cols x 4 rows) - Maximum A4 Efficiency */
            .sheet-page.d-16 { gap: 2mm; padding: 2.5mm; }
            .sheet-page.d-16 .card {
              width: calc((100% - 3 * 2mm) / 4);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 1.5mm 1mm;
            }
            .sheet-page.d-16 .brand-title { font-size: 7.5pt; }
            .sheet-page.d-16 .card-subtitle { font-size: 5.2pt; }
            .sheet-page.d-16 .model { font-size: 7pt; }
            .sheet-page.d-16 .code-badge { font-size: 7.5pt; padding: 1px 6px; }
            .sheet-page.d-16 .qr-container img { width: 28mm; height: 28mm; }
            .sheet-page.d-16 .card-footer { font-size: 5.5pt; padding: 0.8mm 1mm; }

            /* Density 12 (3 cols x 4 rows) - High Density Standard */
            .sheet-page.d-12 { gap: 2.5mm; padding: 2.5mm; }
            .sheet-page.d-12 .card {
              width: calc((100% - 2 * 2.5mm) / 3);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 1.8mm 1.5mm;
            }
            .sheet-page.d-12 .brand-title { font-size: 8.5pt; }
            .sheet-page.d-12 .card-subtitle { font-size: 6pt; }
            .sheet-page.d-12 .model { font-size: 8pt; }
            .sheet-page.d-12 .code-badge { font-size: 8.5pt; padding: 1.5px 8px; }
            .sheet-page.d-12 .qr-container img { width: 32mm; height: 32mm; }
            .sheet-page.d-12 .card-footer { font-size: 6.5pt; padding: 1mm 1.5mm; }

            /* Density 9 (3 cols x 3 rows) - Balanced Medium */
            .sheet-page.d-9 { gap: 3.5mm; padding: 2.5mm; }
            .sheet-page.d-9 .card {
              width: calc((100% - 2 * 3.5mm) / 3);
              height: 86mm;
              max-height: 86mm;
              padding: 2.5mm 3mm;
            }
            .sheet-page.d-9 .brand-title { font-size: 10pt; }
            .sheet-page.d-9 .card-subtitle { font-size: 7pt; }
            .sheet-page.d-9 .model { font-size: 9.5pt; }
            .sheet-page.d-9 .code-badge { font-size: 9.5pt; padding: 2px 10px; }
            .sheet-page.d-9 .qr-container img { width: 42mm; height: 42mm; }
            .sheet-page.d-9 .card-footer { font-size: 7.5pt; padding: 1.5mm 2mm; }

            /* Density 8 (2 cols x 4 rows) - Wide Layout */
            .sheet-page.d-8 { gap: 3.5mm; padding: 2.5mm; }
            .sheet-page.d-8 .card {
              width: calc((100% - 1 * 3.5mm) / 2);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 2mm 3mm;
            }
            .sheet-page.d-8 .brand-title { font-size: 9pt; }
            .sheet-page.d-8 .card-subtitle { font-size: 6.5pt; }
            .sheet-page.d-8 .model { font-size: 8.5pt; }
            .sheet-page.d-8 .code-badge { font-size: 9pt; padding: 1.5px 8px; }
            .sheet-page.d-8 .qr-container img { width: 34mm; height: 34mm; }
            .sheet-page.d-8 .card-footer { font-size: 7pt; padding: 1mm 2mm; }

            /* Density 6 (2 cols x 3 rows) - Large */
            .sheet-page.d-6 { gap: 4mm; padding: 2.5mm; }
            .sheet-page.d-6 .card {
              width: calc((100% - 1 * 4mm) / 2);
              height: 86mm;
              max-height: 86mm;
              padding: 3mm 4mm;
            }
            .sheet-page.d-6 .brand-title { font-size: 10.5pt; }
            .sheet-page.d-6 .card-subtitle { font-size: 7.5pt; }
            .sheet-page.d-6 .model { font-size: 10pt; }
            .sheet-page.d-6 .code-badge { font-size: 10pt; padding: 2px 10px; }
            .sheet-page.d-6 .qr-container img { width: 45mm; height: 45mm; }
            .sheet-page.d-6 .card-footer { font-size: 8pt; padding: 1.5mm 2.5mm; }

            /* Density 4 (2 cols x 2 rows) - Extra Large / Signage */
            .sheet-page.d-4 { gap: 5mm; padding: 3mm; }
            .sheet-page.d-4 .card {
              width: calc((100% - 1 * 5mm) / 2);
              height: 128mm;
              max-height: 128mm;
              padding: 4mm 5mm;
            }
            .sheet-page.d-4 .brand-title { font-size: 14pt; letter-spacing: 2px; }
            .sheet-page.d-4 .card-subtitle { font-size: 9.5pt; }
            .sheet-page.d-4 .model { font-size: 12pt; }
            .sheet-page.d-4 .code-badge { font-size: 12pt; padding: 3px 12px; }
            .sheet-page.d-4 .qr-container img { width: 68mm; height: 68mm; }
            .sheet-page.d-4 .card-footer { font-size: 9pt; padding: 2mm 3mm; }

            /* Mobile and Desktop Anti-Fragmentation Printing Rules */
            @media print {
              @page {
                size: A4 portrait;
                margin: 6mm 5mm;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              html, body {
                background: #ffffff !important;
                color: #0f172a !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }
              .page-container {
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                width: 100% !important;
                gap: 0 !important;
              }
              .sheet-page {
                margin: 0 auto !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                width: 100% !important;
                max-width: 198mm !important;
                height: auto !important;
                min-height: 255mm !important;
                max-height: 272mm !important;
                page-break-before: auto !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                overflow: visible !important;
                display: flex !important;
                flex-wrap: wrap !important;
                align-content: flex-start !important;
                background: #ffffff !important;
              }
              .sheet-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .card {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                break-inside: avoid-page !important;
                -webkit-column-break-inside: avoid !important;
                transform: translateZ(0);
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <div class="info-group">
              <div class="info-title">
                <span>🖨️ AndradeAgro • Catálogo de QR Codes de Frota</span>
              </div>
              <div class="info-subtitle" id="stats-desc">
                ${totalCount} máquinas selecionadas
              </div>
            </div>

            <div class="density-group">
              <span class="density-label">Densidade A4:</span>
              <button class="density-btn" id="btn-d16" onclick="setDensity(16)">16 / Folha (4×4 - Máx. Rendimento)</button>
              <button class="density-btn active" id="btn-d12" onclick="setDensity(12)">12 / Folha (3×4 - Padrão)</button>
              <button class="density-btn" id="btn-d9" onclick="setDensity(9)">9 / Folha (3×3)</button>
              <button class="density-btn" id="btn-d8" onclick="setDensity(8)">8 / Folha (2×4)</button>
              <button class="density-btn" id="btn-d6" onclick="setDensity(6)">6 / Folha (2×3)</button>
              <button class="density-btn" id="btn-d4" onclick="setDensity(4)">4 / Folha (2×2)</button>
            </div>

            <div class="action-btns">
              <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir Agora</button>
              <button class="btn btn-close" onclick="window.close()">✕ Fechar</button>
            </div>
          </div>

          <div class="page-container" id="pages-container">
            <!-- Dynamically populated page chunks -->
          </div>

          <script>
            const cardsData = ${cardsDataJson};
            const total = cardsData.length;

            function createCardHtml(item) {
              return '<div class="card">' +
                '<div class="card-header">' +
                  '<div class="brand-title">ANDRADEAGRO</div>' +
                  '<div class="card-subtitle">IDENTIFICAÇÃO DO EQUIPAMENTO</div>' +
                  '<div class="model" title="' + item.model + '">' + item.model + '</div>' +
                  '<div class="code-badge">' + item.code + '</div>' +
                '</div>' +
                '<div class="qr-container">' +
                  '<img src="' + item.qrDataUrl + '" alt="QR" />' +
                '</div>' +
                '<div class="card-footer">' +
                  '<span>Setor: ' + item.sectorName + ' • Cap.: ' + item.tankInfo + '</span>' +
                '</div>' +
              '</div>';
            }

            function setDensity(d) {
              const container = document.getElementById('pages-container');
              const statsDesc = document.getElementById('stats-desc');
              const buttons = ['btn-d16', 'btn-d12', 'btn-d9', 'btn-d8', 'btn-d6', 'btn-d4'];
              buttons.forEach(id => {
                const b = document.getElementById(id);
                if (b) b.classList.remove('active');
              });

              const activeBtn = document.getElementById('btn-d' + d);
              if (activeBtn) activeBtn.classList.add('active');

              const pagesCount = Math.ceil(total / d) || 1;
              const densityLabels = {
                16: '16 por Folha • Máximo Rendimento',
                12: '12 por Folha • Padrão Alta Densidade',
                9: '9 por Folha • Formato Médio',
                8: '8 por Folha • Formato Amplo',
                6: '6 por Folha • Formato Grande',
                4: '4 por Folha • Extra Grande'
              };

              statsDesc.innerHTML = total + ' máquinas selecionadas • Estimativa: <strong>' + pagesCount + ' folha(s) A4</strong> (' + (densityLabels[d] || '') + ')';

              container.innerHTML = '';
              for (let i = 0; i < total; i += d) {
                const chunk = cardsData.slice(i, i + d);
                const pageEl = document.createElement('div');
                pageEl.className = 'sheet-page d-' + d;
                pageEl.innerHTML = chunk.map(createCardHtml).join('');
                container.appendChild(pageEl);
              }
            }

            // Initial render with 12 cards per sheet (or 16 if large count)
            setDensity(12);
          </script>
        </body>
      </html>
    `;

    openPrintWindow(htmlContent);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        darkMode ? 'bg-[#042d23] border-emerald-900/60 text-slate-100' : 'bg-white border-slate-100'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#064E3B] text-[#FACC15]">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Módulo Integrado de QR Code
              </h1>
              <p className="text-xs text-slate-600 dark:text-emerald-200 font-medium">
                Gere e gerencie QR Codes exclusivos com ID/Link para cada máquina e consulte o cadastro e histórico em tempo real.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('GENERATOR')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'GENERATOR'
                ? 'bg-[#064E3B] text-white shadow-md'
                : 'bg-slate-100 dark:bg-emerald-950 text-slate-700 dark:text-emerald-200 hover:bg-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4 text-[#FACC15]" />
            <span>Gerador & Etiquetas</span>
          </button>

          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'SCANNER'
                ? 'bg-[#064E3B] text-white shadow-md'
                : 'bg-slate-100 dark:bg-emerald-950 text-slate-700 dark:text-emerald-200 hover:bg-slate-200'
            }`}
          >
            <Camera className="w-4 h-4 text-[#FACC15]" />
            <span>Leitor / Leitura de QR</span>
          </button>
        </div>
      </div>

      {scanSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{scanSuccessMessage}</span>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: List & Filters (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`p-5 rounded-3xl border shadow-sm space-y-4 ${
            darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Máquinas & Veículos Cadastrados ({filteredVehicles.length})</span>
              </h2>

              <button
                onClick={handleBatchPrint}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Todos em Lote</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por modelo, código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <option value="ALL">Todas Categorias</option>
                <option value="VEICULO">Veículos com Placa</option>
                <option value="TRATOR">Tratores</option>
                <option value="MAQUINA_AGRICOLA">Máquinas Agrícolas</option>
              </select>

              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className={`px-3 py-2 rounded-xl border text-xs outline-none ${
                  darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <option value="ALL">Todos os Setores</option>
                <option value="PREPARO_SOLO">Preparo de Solo</option>
                <option value="COLHEITA">Colheita</option>
                <option value="PULVERIZACAO">Pulverização</option>
                <option value="AGRICOLA">Agrícola</option>
                <option value="LOGISTICA">Logística</option>
              </select>
            </div>

            {/* Equipment Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredVehicles.map(v => {
                const isSelected = selectedVehicle?.id === v.id;
                const qrVal = getVehicleQRCodeValue(v);

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#064E3B] dark:border-[#FACC15] bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-[#064E3B]/20'
                        : darkMode ? 'bg-emerald-950/40 border-emerald-900 hover:border-emerald-700' : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-white p-1 border shadow-xs shrink-0 flex items-center justify-center">
                        <QRCodeCanvas key={v.id} value={qrVal} size={40} level="M" marginSize={1} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          {v.manufacturer}
                        </p>
                        <h3 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {v.model}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-black text-[#FACC15] bg-[#022c22] px-1.5 py-0.5 rounded border border-[#044E36]">
                            {v.licensePlate || v.patrimonyCode}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {getSectorName(v.sector)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintBadge(v);
                      }}
                      className="p-2 rounded-xl bg-white dark:bg-emerald-900 border text-slate-700 dark:text-emerald-200 hover:bg-amber-50 dark:hover:bg-emerald-800 transition-colors shrink-0"
                      title="Imprimir QR Code"
                    >
                      <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed QR Inspector, Scanned Profile & Fueling History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Active Equipment Inspection Card */}
          {currentScannedVehicle ? (
            <div className={`p-6 rounded-3xl border shadow-sm space-y-5 ${
              darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
            }`}>
              
              {/* Header Profile */}
              <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-emerald-900">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border shrink-0">
                    <img
                      src={currentScannedVehicle.photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'}
                      alt={currentScannedVehicle.model}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                      {currentScannedVehicle.licensePlate || currentScannedVehicle.patrimonyCode}
                    </span>
                    <h2 className="font-black text-base text-slate-900 dark:text-slate-100 mt-1">
                      {currentScannedVehicle.model}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => handlePrintBadge(currentScannedVehicle)}
                  className="p-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>

              {/* QR Code Visual Representation - Cartão de Identificação */}
              <div className="p-4 rounded-2xl bg-white text-slate-900 border-2 border-[#044E36] shadow-md flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-full text-center">
                  <div className="text-sm font-black text-[#044E36] tracking-wider uppercase">ANDRADEAGRO</div>
                  <div className="text-[10px] font-extrabold text-[#D97706] tracking-widest uppercase mt-0.5">IDENTIFICAÇÃO DO EQUIPAMENTO</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{currentScannedVehicle.model}</div>
                  <div className="inline-block mt-1 bg-[#044E36] text-white text-xs font-black px-3 py-0.5 rounded-md shadow-xs">
                    {currentScannedVehicle.licensePlate || currentScannedVehicle.patrimonyCode}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs my-1">
                  <QRCodeCanvas key={currentScannedVehicle.id} value={getVehicleQRCodeValue(currentScannedVehicle)} size={160} level="M" marginSize={1} />
                </div>

                <div className="w-full pt-2 border-t border-slate-200 text-xs font-bold text-[#064E3B] text-center">
                  Setor: {getSectorName(currentScannedVehicle.sector)} • Cap.: {currentScannedVehicle.fuelType === 'NENHUM' ? 'Não aplica' : `${currentScannedVehicle.tankCapacityLiters}L`}
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Setor:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{getSectorName(currentScannedVehicle.sector)}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Combustível / Tanque:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currentScannedVehicle.fuelType === 'NENHUM' ? 'Não se aplica' : `${getFuelTypeName(currentScannedVehicle.fuelType)} (${currentScannedVehicle.tankCapacityLiters}L)`}
                  </strong>
                </div>
                {(currentScannedVehicle.sprayingTankCapacityLiters || 0) > 0 && (
                  <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-300 dark:border-cyan-800 col-span-2">
                    <span className="text-cyan-800 dark:text-cyan-300 text-[10px] font-bold block">Tanque Pulverização / Calda:</span>
                    <strong className="text-cyan-950 dark:text-cyan-100 text-xs font-black">
                      {currentScannedVehicle.sprayingTankCapacityLiters?.toLocaleString('pt-BR')} Litros
                    </strong>
                  </div>
                )}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Uso / Odômetro / Horímetro:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currentScannedVehicle.category === 'VEICULO'
                      ? `${currentScannedVehicle.currentKm.toLocaleString('pt-BR')} km`
                      : `${currentScannedVehicle.currentHourmeter || 0} horas`}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-emerald-950/50 border">
                  <span className="text-slate-500 text-[10px] block">Operador Atribuído:</span>
                  <strong className="text-amber-600 dark:text-amber-400">
                    {currentScannedVehicle.assignedOperatorName || 'Nenhum'}
                  </strong>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p>
                  <strong>📌 Ficha Digital & Manutenção:</strong> O QR Code da máquina direciona diretamente para a aba de manutenção com o histórico de trocas de óleo, preventivas e registros técnicos. Os abastecimentos são efetuados via tablet operacional.
                </p>
              </div>

              {/* ACTION: Open digital sheet */}
              <div className="space-y-2 pt-1">
                {onOpenDigitalSheet && (
                  <button
                    onClick={() => onOpenDigitalSheet(currentScannedVehicle)}
                    className="w-full py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99]"
                  >
                    <FileText className="w-4 h-4 text-[#FACC15]" />
                    <span>📄 ABRIR FICHA DIGITAL & ABA DE MANUTENÇÃO DA MÁQUINA</span>
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 border border-dashed rounded-3xl">
              Selecione uma máquina para visualizar o QR Code e histórico.
            </div>
          )}

          {/* Quick Scanner Simulator Panel (if tab SCANNER selected or bottom panel) */}
          {activeTab === 'SCANNER' && (
            <div className={`p-5 rounded-3xl border shadow-sm space-y-4 ${
              darkMode ? 'bg-[#042d23] border-emerald-900/60' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  Simulador de Leitura por Câmera / Leitor
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-emerald-200">
                Selecione o equipamento escaneado pelo operador para buscar automaticamente os dados atualizados do banco de dados:
              </p>

              <div className="space-y-3">
                {onOpenQRScanner && (
                  <button
                    onClick={onOpenQRScanner}
                    className="w-full py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 border border-emerald-700/60"
                  >
                    <Camera className="w-5 h-5 text-[#FACC15]" />
                    <span>ABRIR LEITOR COM CÂMERA DO DISPOSITIVO</span>
                  </button>
                )}

                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-slate-200 dark:border-emerald-800/60 w-full" />
                  <span className="bg-white dark:bg-[#042d23] px-3 text-[10px] uppercase font-bold text-slate-400 dark:text-emerald-400 shrink-0">
                    Ou selecione manualmente
                  </span>
                  <div className="border-t border-slate-200 dark:border-emerald-800/60 w-full" />
                </div>

                <select
                  value={scannedVehicleId}
                  onChange={(e) => setScannedVehicleId(e.target.value)}
                  className={`w-full p-3 rounded-2xl border text-xs font-bold outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      [{v.category}] {v.model} ({v.licensePlate || v.patrimonyCode})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleSimulateScan(scannedVehicleId)}
                  className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Buscar Dados da Máquina</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
