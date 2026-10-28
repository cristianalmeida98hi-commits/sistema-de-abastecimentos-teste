import type { FuelLog, Vehicle } from '../types';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  getFuelTypeName,
  getSectorName,
  getOperationTypeName,
  getActivityTypeName,
  getEffectiveActivityName,
  getEffectiveCategoryName
} from './calculations';

export interface ReportExportOptions {
  logs: FuelLog[];
  vehicles: Vehicle[];
  companyInfo: { name: string; slogan: string; cnpj: string };
  dateRangeStr: string;
  canViewFinancial: boolean;
  appliedFiltersDesc?: string;
  reportTitle?: string;
}

export interface ReportMetrics {
  totalLiters: number;
  totalCost: number;
  totalCount: number;
  avgLitersPerLog: number;
  sortedAct: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedEq: Array<{ name: string; code: string; liters: number; cost: number; count: number }>;
  sortedOp: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedSec: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedOper: Array<{ name: string; liters: number; cost: number; count: number }>;
  sortedTime: Array<{ date: string; liters: number; cost: number }>;
  topEquipment?: { name: string; code: string; liters: number; count: number };
  topOperator?: { name: string; liters: number; count: number };
  topActivity?: { name: string; liters: number; count: number };
  topOperation?: { name: string; liters: number; count: number };
  topSector?: { name: string; liters: number; count: number };
}

/**
 * Agrega e calcula métricas analíticas e gerenciais para os relatórios.
 */
export function calculateReportMetrics(logs: FuelLog[], vehicles: Vehicle[]): ReportMetrics {
  const totalLiters = logs.reduce((acc, l) => acc + (l.liters || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (l.totalValue || 0), 0);
  const totalCount = logs.length;
  const avgLitersPerLog = totalCount > 0 ? totalLiters / totalCount : 0;

  const vehicleMap = new Map<string, Vehicle>();
  vehicles.forEach(v => {
    if (v.id) vehicleMap.set(v.id, v);
  });

  const eqMap = new Map<string, { name: string; code: string; liters: number; cost: number; count: number }>();
  const opMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const actMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const operMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const secMap = new Map<string, { name: string; liters: number; cost: number; count: number }>();
  const timeMap = new Map<string, { date: string; liters: number; cost: number }>();

  logs.forEach(l => {
    const liters = l.liters || 0;
    const cost = l.totalValue || 0;

    // Equipamento
    const eqKey = l.equipmentId || l.equipmentName || 'OUTRO';
    const eqCur = eqMap.get(eqKey) || {
      name: l.equipmentName || 'Equipamento',
      code: l.equipmentPlateOrCode || '',
      liters: 0,
      cost: 0,
      count: 0
    };
    eqCur.liters += liters;
    eqCur.cost += cost;
    eqCur.count += 1;
    eqMap.set(eqKey, eqCur);

    // Operador
    const opKey = l.driverOrOperatorId || l.driverOrOperatorName || 'NÃO INFORMADO';
    const opCur = opMap.get(opKey) || {
      name: l.driverOrOperatorName || 'Não Informado',
      liters: 0,
      cost: 0,
      count: 0
    };
    opCur.liters += liters;
    opCur.cost += cost;
    opCur.count += 1;
    opMap.set(opKey, opCur);

    // Atividade
    const actName = getEffectiveActivityName(l);
    const actCur = actMap.get(actName) || { name: actName, liters: 0, cost: 0, count: 0 };
    actCur.liters += liters;
    actCur.cost += cost;
    actCur.count += 1;
    actMap.set(actName, actCur);

    // Operação
    const operName = getEffectiveCategoryName(l);
    const operCur = operMap.get(operName) || { name: operName, liters: 0, cost: 0, count: 0 };
    operCur.liters += liters;
    operCur.cost += cost;
    operCur.count += 1;
    operMap.set(operName, operCur);

    // Setor
    const veh = vehicleMap.get(l.equipmentId);
    const sectorRaw = veh?.sector || 'AGRICOLA';
    const sectorLabel = getSectorName(sectorRaw);
    const secCur = secMap.get(sectorLabel) || { name: sectorLabel, liters: 0, cost: 0, count: 0 };
    secCur.liters += liters;
    secCur.cost += cost;
    secCur.count += 1;
    secMap.set(sectorLabel, secCur);

    // Temporal
    const dateKey = (l.dateTime || '').slice(0, 10);
    if (dateKey) {
      const tCur = timeMap.get(dateKey) || { date: dateKey, liters: 0, cost: 0 };
      tCur.liters += liters;
      tCur.cost += cost;
      timeMap.set(dateKey, tCur);
    }
  });

  const sortedEq = Array.from(eqMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedOp = Array.from(opMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedAct = Array.from(actMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedOper = Array.from(operMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedSec = Array.from(secMap.values()).sort((a, b) => b.liters - a.liters);
  const sortedTime = Array.from(timeMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalLiters,
    totalCost,
    totalCount,
    avgLitersPerLog,
    sortedAct,
    sortedEq,
    sortedOp,
    sortedSec,
    sortedOper,
    sortedTime,
    topEquipment: sortedEq[0],
    topOperator: sortedOp[0],
    topActivity: sortedAct[0],
    topOperation: sortedOper[0],
    topSector: sortedSec[0]
  };
}

/**
 * Gera imagem PNG base64 de gráfico de barras horizontais via HTML Canvas (navegador).
 */
export function createBarChartPng(options: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; formattedValue: string; percent?: string }>;
  colorHex: string;
  width?: number;
  height?: number;
}): string {
  if (typeof document === 'undefined') return '';
  const { title, subtitle, items, colorHex, width = 760, height = 360 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fundo branco e borda
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Faixa do Cabeçalho
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(2, 2, width - 4, 48);
  ctx.beginPath();
  ctx.moveTo(2, 50);
  ctx.lineTo(width - 2, 50);
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // Título e Subtítulo
  ctx.fillStyle = '#0f3822';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(title, 16, 30);

  ctx.fillStyle = '#64748b';
  ctx.font = 'normal 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(subtitle, width - 16, 30);
  ctx.textAlign = 'left';

  if (!items || items.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Nenhum dado disponível no período selecionado.', 20, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  }

  const topItems = items.slice(0, 5);
  const maxVal = Math.max(...topItems.map(i => i.value), 1);
  const startY = 68;
  const rowH = 54;
  const barMaxWidth = width - 270;

  topItems.forEach((item, idx) => {
    const y = startY + idx * rowH;

    // Rótulo
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    const labelText = item.label.length > 22 ? item.label.slice(0, 20) + '...' : item.label;
    ctx.fillText(labelText, 16, y + 16);

    // Barra de fundo
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(170, y, barMaxWidth, 22);

    // Barra preenchida
    const barW = Math.max(5, (item.value / maxVal) * barMaxWidth);
    ctx.fillStyle = colorHex;
    ctx.fillRect(170, y, barW, 22);

    // Valor e porcentagem à direita
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    const valText = item.percent ? `${item.formattedValue} (${item.percent})` : item.formattedValue;
    ctx.fillText(valText, 170 + barMaxWidth + 10, y + 16);
  });

  return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * Gera imagem PNG base64 de gráfico de evolução temporal via HTML Canvas.
 */
export function createTimelineChartPng(options: {
  title: string;
  subtitle: string;
  items: Array<{ date: string; liters: number }>;
  colorHex: string;
  width?: number;
  height?: number;
}): string {
  if (typeof document === 'undefined') return '';
  const { title, subtitle, items, colorHex, width = 760, height = 360 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(2, 2, width - 4, 48);
  ctx.beginPath();
  ctx.moveTo(2, 50);
  ctx.lineTo(width - 2, 50);
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  ctx.fillStyle = '#0f3822';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(title, 16, 30);

  ctx.fillStyle = '#64748b';
  ctx.font = 'normal 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(subtitle, width - 16, 30);
  ctx.textAlign = 'left';

  if (!items || items.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Nenhum dado disponível no período selecionado.', 20, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  }

  const slice = items.slice(-14);
  const maxLiters = Math.max(...slice.map(s => s.liters), 1);
  const chartX = 26;
  const chartY = 72;
  const chartW = width - 52;
  const chartH = height - 122;
  const colStep = chartW / Math.max(slice.length, 1);
  const colW = Math.min(colStep * 0.65, 34);

  // Linha de base
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(chartX, chartY + chartH);
  ctx.lineTo(chartX + chartW, chartY + chartH);
  ctx.stroke();

  slice.forEach((pt, i) => {
    const x = chartX + i * colStep + (colStep - colW) / 2;
    const barH = Math.max(4, (pt.liters / maxLiters) * chartH);
    const y = chartY + chartH - barH;

    ctx.fillStyle = colorHex;
    ctx.fillRect(x, y, colW, barH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(pt.liters)}L`, x + colW / 2, y - 4);

    const parts = pt.date.split('-');
    const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : pt.date;
    ctx.fillStyle = '#64748b';
    ctx.font = 'normal 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(dateLabel, x + colW / 2, chartY + chartH + 16);
  });

  return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * Desenha caixa com título e subtítulo para gráficos vetoriais no PDF.
 */
function drawPdfChartBox(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(215, 225, 220);
  doc.rect(x, y, w, h, 'FD');

  doc.setFillColor(246, 249, 247);
  doc.rect(x, y, w, 7.5, 'F');
  doc.setDrawColor(225, 235, 230);
  doc.line(x, y + 7.5, x + w, y + 7.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 60, 40);
  doc.text(title, x + 3, y + 5);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 115, 110);
  doc.text(subtitle, x + w - 3, y + 5, { align: 'right' });
}

/**
 * Renderiza os 4 gráficos vetoriais analíticos no PDF (Atividade, Máquina, Operador, Setor/Temporal).
 */
function drawPdfVectorCharts(
  doc: any,
  metrics: ReportMetrics,
  startY: number,
  panelHeight: number = 52
) {
  const panelW = 132.5;
  const panelH = panelHeight;
  const totalLiters = metrics.totalLiters;

  // 1. Gráfico Top Atividades (Top Left)
  const g1X = 14;
  const g1Y = startY;
  drawPdfChartBox(doc, g1X, g1Y, panelW, panelH, '📊 CONSUMO POR ATIVIDADE (LITROS)', 'Top 5 Atividades');
  const top5Activities = metrics.sortedAct.slice(0, 5);
  const maxActLiters = top5Activities.length > 0 ? Math.max(...top5Activities.map(a => a.liters), 1) : 1;

  if (top5Activities.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g1X + 15, g1Y + 22);
  } else {
    top5Activities.forEach((act, idx) => {
      const itemY = g1Y + 10 + idx * 8.2;
      const barMaxWidth = panelW - 54;
      const barW = Math.max(2, (act.liters / maxActLiters) * barMaxWidth);
      const pct = totalLiters > 0 ? ((act.liters / totalLiters) * 100).toFixed(1) : '0';

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 50, 45);
      doc.text(act.name.length > 18 ? `${act.name.slice(0, 16)}..` : act.name, g1X + 3, itemY + 3.2);

      doc.setFillColor(240, 244, 242);
      doc.rect(g1X + 34, itemY, barMaxWidth, 4.2, 'F');

      doc.setFillColor(16, 140, 75);
      doc.rect(g1X + 34, itemY, barW, 4.2, 'F');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 60, 40);
      doc.text(`${act.liters.toLocaleString('pt-BR')} L (${pct}%)`, g1X + panelW - 3, itemY + 3.3, { align: 'right' });
    });
  }

  // 2. Gráfico Top Equipamentos / Máquinas (Top Right)
  const g2X = 150.5;
  const g2Y = startY;
  drawPdfChartBox(doc, g2X, g2Y, panelW, panelH, '🚜 CONSUMO POR EQUIPAMENTO / MÁQUINA', 'Top 5 Máquinas');
  const top5Equipments = metrics.sortedEq.slice(0, 5);
  const maxEqLiters = top5Equipments.length > 0 ? Math.max(...top5Equipments.map(e => e.liters), 1) : 1;

  if (top5Equipments.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g2X + 15, g2Y + 22);
  } else {
    top5Equipments.forEach((eq, idx) => {
      const itemY = g2Y + 10 + idx * 8.2;
      const barMaxWidth = panelW - 54;
      const barW = Math.max(2, (eq.liters / maxEqLiters) * barMaxWidth);
      const pct = totalLiters > 0 ? ((eq.liters / totalLiters) * 100).toFixed(1) : '0';

      const label = eq.code ? `${eq.name.slice(0, 13)} (${eq.code.slice(0, 6)})` : eq.name.slice(0, 18);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 50, 45);
      doc.text(label, g2X + 3, itemY + 3.2);

      doc.setFillColor(240, 244, 242);
      doc.rect(g2X + 42, itemY, barMaxWidth - 8, 4.2, 'F');

      doc.setFillColor(217, 119, 6);
      doc.rect(g2X + 42, itemY, (barW / barMaxWidth) * (barMaxWidth - 8), 4.2, 'F');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(140, 60, 10);
      doc.text(`${eq.liters.toLocaleString('pt-BR')} L (${pct}%)`, g2X + panelW - 3, itemY + 3.3, { align: 'right' });
    });
  }

  // 3. Gráfico Top Operadores / Motoristas (Bottom Left)
  const g3X = 14;
  const g3Y = startY + panelH + 3.5;
  drawPdfChartBox(doc, g3X, g3Y, panelW, panelH, '👤 CONSUMO POR OPERADOR / MOTORISTA', 'Top 5 Operadores');
  const top5Operators = metrics.sortedOp.slice(0, 5);
  const maxOpLiters = top5Operators.length > 0 ? Math.max(...top5Operators.map(o => o.liters), 1) : 1;

  if (top5Operators.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g3X + 15, g3Y + 22);
  } else {
    top5Operators.forEach((op, idx) => {
      const itemY = g3Y + 10 + idx * 8.2;
      const barMaxWidth = panelW - 54;
      const barW = Math.max(2, (op.liters / maxOpLiters) * barMaxWidth);
      const pct = totalLiters > 0 ? ((op.liters / totalLiters) * 100).toFixed(1) : '0';

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 50, 45);
      doc.text(op.name.length > 18 ? `${op.name.slice(0, 16)}..` : op.name, g3X + 3, itemY + 3.2);

      doc.setFillColor(240, 244, 242);
      doc.rect(g3X + 34, itemY, barMaxWidth, 4.2, 'F');

      doc.setFillColor(37, 99, 235);
      doc.rect(g3X + 34, itemY, barW, 4.2, 'F');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(`${op.liters.toLocaleString('pt-BR')} L (${pct}%)`, g3X + panelW - 3, itemY + 3.3, { align: 'right' });
    });
  }

  // 4. Gráfico Evolução Temporal no Período (Bottom Right)
  const g4X = 150.5;
  const g4Y = startY + panelH + 3.5;
  drawPdfChartBox(doc, g4X, g4Y, panelW, panelH, '📅 EVOLUÇÃO DOS ABASTECIMENTOS NO PERÍODO', 'Litros por Data');

  if (metrics.sortedTime.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sem abastecimentos no período selecionado.', g4X + 15, g4Y + 22);
  } else {
    const timeSlice = metrics.sortedTime.slice(-14);
    const maxTimeLiters = Math.max(...timeSlice.map(t => t.liters), 1);
    const chartInnerW = panelW - 20;
    const chartInnerH = panelH - 20;
    const colStep = chartInnerW / Math.max(timeSlice.length, 1);
    const barWidth = Math.min(colStep * 0.65, 8);

    doc.setDrawColor(210, 220, 215);
    doc.line(g4X + 10, g4Y + 12 + chartInnerH, g4X + 10 + chartInnerW, g4Y + 12 + chartInnerH);

    timeSlice.forEach((pt, idx) => {
      const colX = g4X + 10 + idx * colStep + (colStep - barWidth) / 2;
      const barH = Math.max(1.5, (pt.liters / maxTimeLiters) * chartInnerH);
      const barY = g4Y + 12 + chartInnerH - barH;

      doc.setFillColor(15, 118, 110);
      doc.rect(colX, barY, barWidth, barH, 'F');

      if (timeSlice.length <= 10) {
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 90, 80);
        doc.text(`${Math.round(pt.liters)}`, colX + barWidth / 2, barY - 1, { align: 'center' });
      }

      const parts = pt.date.split('-');
      const d = parts[2] || '';
      const m = parts[1] || '';
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 105, 100);
      doc.text(`${d}/${m}`, colX + barWidth / 2, g4Y + 15 + chartInnerH, { align: 'center' });
    });
  }
}

/**
 * Renderiza os cards de Resumo Gerencial / Indicadores no PDF.
 */
function drawPdfKpiCards(
  doc: any,
  metrics: ReportMetrics,
  startY: number,
  canViewFinancial: boolean
) {
  const cardW = 64.5;
  const cardH = 12.5;
  const cardGap = 4;

  const kpis = [
    {
      title: 'VOLUME TOTAL',
      value: `${metrics.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
      color: [16, 110, 60]
    },
    {
      title: 'INVESTIMENTO TOTAL',
      value: canViewFinancial ? formatCurrency(metrics.totalCost) : 'Restrito',
      color: canViewFinancial ? [180, 100, 15] : [100, 110, 120]
    },
    {
      title: 'MÉDIA POR ABASTECIMENTO',
      value: `${metrics.avgLitersPerLog.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`,
      color: [14, 116, 144]
    },
    {
      title: 'MÁQUINA MAIOR CONSUMO',
      value: metrics.topEquipment ? `${metrics.topEquipment.name.slice(0, 18)}` : 'N/A',
      color: [120, 53, 15]
    }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardW + cardGap);
    const y = startY;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 230, 225);
    doc.rect(x, y, cardW, cardH, 'FD');

    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(x, y, cardW, 1.2, 'F');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 115, 110);
    doc.text(kpi.title, x + 2.5, y + 4.2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 2.5, y + 9.5);
  });
}

/**
 * EXPORTAÇÃO OFICIAL EM PDF (ESTRUTURA COMPLETA UNIFICADA):
 * 1. Cabeçalho Principal no Topo
 * 2. Tabela Principal Completa com todos os Lançamentos e Colunas
 * 3. Gráficos Analíticos e Resumo Gerencial posicionados dinamicamente APÓS a tabela no final do documento
 */
export async function exportReportPDF(options: ReportExportOptions) {
  const {
    logs,
    vehicles,
    companyInfo,
    dateRangeStr,
    canViewFinancial,
    appliedFiltersDesc = 'Filtros aplicados: Período selecionado',
    reportTitle = 'RELATÓRIO OFICIAL DE ABASTECIMENTOS'
  } = options;

  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const metrics = calculateReportMetrics(logs, vehicles);

  // 1. CABEÇALHO DO RELATÓRIO (Página 1)
  doc.setFillColor(15, 56, 34); // Forest Agro Green
  doc.rect(0, 0, 297, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo.name.toUpperCase(), 14, 10);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(companyInfo.slogan || 'Gestão Inteligente do Agronegócio', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle.toUpperCase(), 283, 9.5, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emissão: ${formatDateTimeBR(new Date().toISOString())} • CNPJ: ${companyInfo.cnpj}`, 283, 15.5, { align: 'right' });

  // Faixa de Contexto & Filtros
  doc.setFillColor(243, 247, 244);
  doc.setDrawColor(210, 225, 215);
  doc.rect(14, 24.5, 269, 7.5, 'FD');

  doc.setTextColor(20, 50, 30);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Período: ${dateRangeStr}`, 18, 29.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 100, 90);
  doc.text(`${logs.length} lançamentos • ${appliedFiltersDesc}`, 280, 29.5, { align: 'right' });

  // 2. TABELA PRINCIPAL DE LANÇAMENTOS
  const tableData = logs.map(log => {
    const row = [
      formatDateTimeBR(log.dateTime),
      log.equipmentPlateOrCode || '-',
      log.equipmentName,
      log.driverOrOperatorName,
      `${getOperationTypeName(log.operationType)}${log.activityType ? ' - ' + getActivityTypeName(log.activityType, log.operationType) : ''}`,
      log.gasStationName,
      getFuelTypeName(log.fuelType),
      `${log.liters} L`
    ];

    if (canViewFinancial) {
      row.push(formatCurrency(log.pricePerLiter));
      row.push(formatCurrency(log.totalValue));
    }

    row.push(log.calculatedAverageKmPerLiter ? `${log.calculatedAverageKmPerLiter} km/L` : log.calculatedAverageLitersPerHour ? `${log.calculatedAverageLitersPerHour} L/h` : '-');
    return row;
  });

  const headCols = canViewFinancial
    ? ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'R$/L', 'Total R$', 'Média']
    : ['Data/Hora', 'Placa/Cód.', 'Equipamento', 'Motorista/Operador', 'Operação / Atividade', 'Posto', 'Combustível', 'Litros', 'Média'];

  const footCols = canViewFinancial
    ? ['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', '-', `${metrics.totalLiters.toLocaleString('pt-BR')} L`, '-', formatCurrency(metrics.totalCost), '-']
    : ['TOTAL', `${logs.length} reg.`, '-', '-', '-', '-', '-', `${metrics.totalLiters.toLocaleString('pt-BR')} L`, '-'];

  autoTable(doc, {
    startY: 34,
    head: [headCols],
    body: tableData,
    foot: [footCols],
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: {
      fillColor: [20, 78, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    footStyles: {
      fillColor: [230, 240, 234],
      textColor: [15, 56, 34],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.4
    },
    alternateRowStyles: {
      fillColor: [248, 250, 248]
    },
    margin: { left: 14, right: 14, bottom: 16 }
  });

  // 3. GRÁFICOS NO FINAL DO MESMO RELATÓRIO (POSICIONAMENTO DINÂMICO APÓS A TABELA)
  const finalY = (doc as any).lastAutoTable?.finalY || 35;
  const availableSpace = 196 - finalY;
  const chartsNeededHeight = 124; // Cards (13mm) + Gap (4mm) + 2x Gráficos (107mm)

  let chartsStartY: number;

  if (availableSpace >= chartsNeededHeight) {
    // Poucas linhas: Gráficos cabem confortavelmente abaixo da tabela na mesma página
    chartsStartY = finalY + 6;

    // Linha divisória suave
    doc.setDrawColor(210, 225, 215);
    doc.line(14, chartsStartY - 2, 283, chartsStartY - 2);

    // Título da seção analítica
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 56, 34);
    doc.text('📊 RESUMO GERENCIAL & GRÁFICOS ANALÍTICOS DO PERÍODO', 14, chartsStartY + 2.5);

    drawPdfKpiCards(doc, metrics, chartsStartY + 5, canViewFinancial);
    drawPdfVectorCharts(doc, metrics, chartsStartY + 21, 48);
  } else {
    // Muitas linhas ou espaço insuficiente: Inserir quebra de página dinâmica para não cortar nem sobrepor
    doc.addPage('a4', 'landscape');

    // Cabeçalho resumido da página de gráficos
    doc.setFillColor(15, 56, 34);
    doc.rect(0, 0, 297, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.name.toUpperCase(), 14, 8.5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Resumo Gerencial e Gráficos Analíticos • Período: ${dateRangeStr}`, 14, 13);

    doc.text(`Total: ${logs.length} registros`, 283, 10, { align: 'right' });

    chartsStartY = 20;
    drawPdfKpiCards(doc, metrics, chartsStartY, canViewFinancial);
    drawPdfVectorCharts(doc, metrics, chartsStartY + 16, 52);
  }

  // Rodapé em todas as páginas com numeração dinâmica "Página X de Y"
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 135, 130);
    doc.text(`AndradeAgro • Sistema de Gestão de Abastecimento e Frotas • ${dateRangeStr}`, 14, 203);
    doc.text(`Página ${p} de ${totalPages}`, 283, 203, { align: 'right' });
  }

  const cleanFileName = `AndradeAgro_Relatorio_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(cleanFileName);
}

/**
 * EXPORTAÇÃO OFICIAL EM EXCEL (.xlsx com Gráficos Incorporados):
 * 1. Cabeçalho Oficial no Topo da Planilha
 * 2. Tabela Principal com Todos os Lançamentos e Colunas
 * 3. Totalizadores ao final da tabela
 * 4. Resumo Gerencial / Indicadores em células formatadas
 * 5. Gráficos Analíticos Incorporados Diretamente na Mesma Planilha Abaixo da Última Linha
 */
export async function exportReportExcel(options: ReportExportOptions) {
  const {
    logs,
    vehicles,
    companyInfo,
    dateRangeStr,
    canViewFinancial,
    appliedFiltersDesc = 'Filtros aplicados: Período selecionado'
  } = options;

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = companyInfo.name || 'AndradeAgro';
  wb.created = new Date();

  const ws = wb.addWorksheet('Relatório de Abastecimentos', {
    views: [{ showGridLines: true }]
  });

  const metrics = calculateReportMetrics(logs, vehicles);

  // 1. CABEÇALHO DO RELATÓRIO
  ws.mergeCells(1, 1, 1, canViewFinancial ? 21 : 17);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${companyInfo.name.toUpperCase()} - GESTÃO INTELIGENTE DO AGRONEGÓCIO`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3822' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, canViewFinancial ? 21 : 17);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Relatório de Abastecimentos e Gestão de Frotas • Período: ${dateRangeStr} • Filtros: ${appliedFiltersDesc}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF2D3748' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 19;

  ws.mergeCells(3, 1, 3, canViewFinancial ? 21 : 17);
  const metaCell = ws.getCell(3, 1);
  metaCell.value = `Emitido em: ${formatDateTimeBR(new Date().toISOString())} • CNPJ: ${companyInfo.cnpj} • Total de Lançamentos: ${logs.length}`;
  metaCell.font = { name: 'Arial', size: 9, color: { argb: 'FF4A5568' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(3).height = 18;

  // 2. TABELA PRINCIPAL
  const headers = [
    'Data/Hora',
    'ID Equipamento',
    'Categoria',
    'Placa / Código',
    'Nome Equipamento',
    'Tipo de Operação',
    'Atividade',
    'Motorista / Operador',
    'Frentista / Atendente',
    'Posto',
    'Tipo de Combustível',
    'Litros'
  ];

  if (canViewFinancial) {
    headers.push('Valor por Litro (R$)', 'Valor Total (R$)');
  }

  headers.push('KM no Abastecimento', 'Horímetro no Abastecimento', 'Média km/L', 'Média L/h');

  if (canViewFinancial) {
    headers.push('Custo por KM (R$)', 'Custo por Hora (R$)');
  }

  headers.push('Observações');

  const headerRow = ws.getRow(5);
  headerRow.values = headers;
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF154C2E' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F3822' } },
      bottom: { style: 'thin', color: { argb: 'FF0F3822' } },
      left: { style: 'thin', color: { argb: 'FF0F3822' } },
      right: { style: 'thin', color: { argb: 'FF0F3822' } }
    };
  });

  // Linhas de dados da tabela principal
  logs.forEach((log, index) => {
    const rowNum = 6 + index;
    const r = ws.getRow(rowNum);

    const values: any[] = [
      formatDateTimeBR(log.dateTime),
      log.equipmentId || '',
      log.equipmentCategory || '',
      log.equipmentPlateOrCode || '',
      log.equipmentName || '',
      getOperationTypeName(log.operationType),
      log.activityType ? getActivityTypeName(log.activityType, log.operationType) : '',
      log.driverOrOperatorName || '',
      log.attendantName || '',
      log.gasStationName || '',
      getFuelTypeName(log.fuelType),
      log.liters || 0
    ];

    if (canViewFinancial) {
      values.push(log.pricePerLiter || 0);
      values.push(log.totalValue || 0);
    }

    values.push(
      log.kmAtFueling ?? '',
      log.hourmeterAtFueling ?? '',
      log.calculatedAverageKmPerLiter ?? '',
      log.calculatedAverageLitersPerHour ?? ''
    );

    if (canViewFinancial) {
      values.push(log.costPerKm ?? '', log.costPerHour ?? '');
    }

    values.push(log.observations || '');

    r.values = values;
    r.height = 19;

    const isEven = index % 2 === 0;
    r.eachCell((cell, colIndex) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF9FBF9' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Alinhamentos numéricos
      if (colIndex === 12 || colIndex === 13 || colIndex === 14) {
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  const lastTableRow = 5 + logs.length;

  // Linha de Totalização
  const totalRow = ws.getRow(lastTableRow + 1);
  const totalValues: any[] = [
    'TOTAL',
    `${logs.length} reg.`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    metrics.totalLiters
  ];

  if (canViewFinancial) {
    totalValues.push('', metrics.totalCost);
  }

  totalRow.values = totalValues;
  totalRow.height = 22;
  totalRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F3822' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0EA' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF154C2E' } },
      bottom: { style: 'medium', color: { argb: 'FF154C2E' } }
    };
  });

  // 3. RESUMO GERENCIAL / INDICADORES EM CÉLULAS DA PLANILHA (POSICIONAMENTO DINÂMICO APÓS A TABELA)
  const summaryStartRow = lastTableRow + 3;

  ws.mergeCells(summaryStartRow, 1, summaryStartRow, canViewFinancial ? 14 : 12);
  const sumHeader = ws.getCell(summaryStartRow, 1);
  sumHeader.value = '📊 RESUMO GERENCIAL E INDICADORES OPERACIONAIS';
  sumHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF154C2E' } };
  ws.getRow(summaryStartRow).height = 22;

  const kpiData = [
    ['Total de Abastecimentos', logs.length, 'Máquina com Maior Consumo', metrics.topEquipment ? `${metrics.topEquipment.name} (${metrics.topEquipment.liters.toLocaleString('pt-BR')} L)` : '-'],
    ['Volume Total Abastecido', `${metrics.totalLiters.toLocaleString('pt-BR')} L`, 'Operador com Maior Volume', metrics.topOperator ? `${metrics.topOperator.name} (${metrics.topOperator.liters.toLocaleString('pt-BR')} L)` : '-'],
    ['Média por Abastecimento', `${metrics.avgLitersPerLog.toFixed(1)} L`, 'Atividade com Maior Consumo', metrics.topActivity ? `${metrics.topActivity.name} (${metrics.topActivity.liters.toLocaleString('pt-BR')} L)` : '-'],
    [
      canViewFinancial ? 'Investimento Total (R$)' : 'Perfil Operacional',
      canViewFinancial ? formatCurrency(metrics.totalCost) : 'Restrito',
      'Setor com Maior Consumo',
      metrics.topSector ? `${metrics.topSector.name} (${metrics.topSector.liters.toLocaleString('pt-BR')} L)` : '-'
    ]
  ];

  kpiData.forEach((row, idx) => {
    const r = ws.getRow(summaryStartRow + 1 + idx);
    r.values = row;
    r.height = 19;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D3748' } };
    r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF154C2E' } };
    r.getCell(3).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2D3748' } };
    r.getCell(4).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF154C2E' } };
  });

  // 4. GRÁFICOS ANALÍTICOS INCORPORADOS NA MESMA PLANILHA ABAIXO DA TABELA
  const chartsStartRow = summaryStartRow + 6;

  // Gerar os 4 gráficos em PNG via Canvas
  const totalLit = metrics.totalLiters;

  const chart1Png = createBarChartPng({
    title: 'CONSUMO POR ATIVIDADE (LITROS E %)',
    subtitle: 'Top 5 Atividades',
    colorHex: '#108c4b',
    items: metrics.sortedAct.map(a => ({
      label: a.name,
      value: a.liters,
      formattedValue: `${a.liters.toLocaleString('pt-BR')} L`,
      percent: totalLit > 0 ? `${((a.liters / totalLit) * 100).toFixed(1)}%` : '0%'
    }))
  });

  const chart2Png = createBarChartPng({
    title: 'CONSUMO POR EQUIPAMENTO / MÁQUINA',
    subtitle: 'Top 5 Máquinas',
    colorHex: '#d97706',
    items: metrics.sortedEq.map(e => ({
      label: e.code ? `${e.name} (${e.code})` : e.name,
      value: e.liters,
      formattedValue: `${e.liters.toLocaleString('pt-BR')} L`,
      percent: totalLit > 0 ? `${((e.liters / totalLit) * 100).toFixed(1)}%` : '0%'
    }))
  });

  const chart3Png = createBarChartPng({
    title: 'CONSUMO POR OPERADOR / MOTORISTA',
    subtitle: 'Top 5 Operadores',
    colorHex: '#2563eb',
    items: metrics.sortedOp.map(o => ({
      label: o.name,
      value: o.liters,
      formattedValue: `${o.liters.toLocaleString('pt-BR')} L`,
      percent: totalLit > 0 ? `${((o.liters / totalLit) * 100).toFixed(1)}%` : '0%'
    }))
  });

  const chart4Png = createTimelineChartPng({
    title: 'EVOLUÇÃO DOS ABASTECIMENTOS NO PERÍODO',
    subtitle: 'Litros Abastecidos por Data',
    colorHex: '#0f766e',
    items: metrics.sortedTime
  });

  if (chart1Png) {
    const img1 = wb.addImage({ base64: chart1Png, extension: 'png' });
    ws.addImage(img1, {
      tl: { col: 0, row: chartsStartRow },
      ext: { width: 500, height: 245 }
    });
  }

  if (chart2Png) {
    const img2 = wb.addImage({ base64: chart2Png, extension: 'png' });
    ws.addImage(img2, {
      tl: { col: 7, row: chartsStartRow },
      ext: { width: 500, height: 245 }
    });
  }

  if (chart3Png) {
    const img3 = wb.addImage({ base64: chart3Png, extension: 'png' });
    ws.addImage(img3, {
      tl: { col: 0, row: chartsStartRow + 13 },
      ext: { width: 500, height: 245 }
    });
  }

  if (chart4Png) {
    const img4 = wb.addImage({ base64: chart4Png, extension: 'png' });
    ws.addImage(img4, {
      tl: { col: 7, row: chartsStartRow + 13 },
      ext: { width: 500, height: 245 }
    });
  }

  // Larguras adequadas para as colunas da planilha
  ws.columns = [
    { width: 18 }, // Data/Hora
    { width: 14 }, // ID
    { width: 14 }, // Categoria
    { width: 14 }, // Placa
    { width: 24 }, // Equipamento
    { width: 16 }, // Operação
    { width: 18 }, // Atividade
    { width: 20 }, // Operador
    { width: 18 }, // Frentista
    { width: 18 }, // Posto
    { width: 16 }, // Combustível
    { width: 14 }, // Litros
    ...(canViewFinancial ? [{ width: 13 }, { width: 15 }] : []),
    { width: 14 }, // KM
    { width: 14 }, // Horímetro
    { width: 13 }, // km/L
    { width: 13 }, // L/h
    ...(canViewFinancial ? [{ width: 14 }, { width: 14 }] : []),
    { width: 26 }  // Obs
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AndradeAgro_Relatorio_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
