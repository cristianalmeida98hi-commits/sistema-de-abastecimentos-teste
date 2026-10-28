import { FuelLog, Vehicle, FuelType, Sector, GasStation } from '../types';
import { getOperationTypeName, getActivityTypeName, getEffectiveActivityName, getEffectiveCategoryName } from './operations';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatters = new Map<number, Intl.NumberFormat>();

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount || 0);
}

export function formatNumber(value: number, decimals: number = 1): string {
  let formatter = numberFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatters.set(decimals, formatter);
  }
  return formatter.format(value || 0);
}

const TIMEZONE_BR = 'America/Sao_Paulo';

/**
 * Retorna a data de hoje (YYYY-MM-DD) no fuso horário do Brasil (America/Sao_Paulo).
 * Garante que em horários noturnos a data local não pule incorretamente para o dia seguinte.
 */
export function getTodayDateSaoPaulo(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE_BR,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Retorna o horário atual (HH:mm) no fuso horário do Brasil (America/Sao_Paulo).
 */
export function getCurrentTimeSaoPaulo(): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Retorna a data e hora atual no fuso de Brasília em formato ISO com offset -03:00.
 */
export function getNowSaoPauloISO(): string {
  const today = getTodayDateSaoPaulo();
  const time = getCurrentTimeSaoPaulo();
  const now = new Date();
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${today}T${time}:${seconds}-03:00`;
}

/**
 * Gera um timestamp ISO com offset correto do Brasil (-03:00) para uma data (YYYY-MM-DD)
 * e hora opcional (HH:mm ou atual).
 */
export function createTimestampForDateSaoPaulo(dateStr: string, timeStr?: string): string {
  if (!dateStr) return getNowSaoPauloISO();
  const cleanDate = dateStr.trim().slice(0, 10);
  let hours = '12';
  let minutes = '00';
  let seconds = '00';

  if (timeStr && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
    const parts = timeStr.trim().split(':');
    hours = parts[0];
    minutes = parts[1];
    seconds = parts[2] || '00';
  } else {
    try {
      const timeFmt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE_BR,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = timeFmt.formatToParts(new Date());
      hours = parts.find(p => p.type === 'hour')?.value || '12';
      minutes = parts.find(p => p.type === 'minute')?.value || '00';
      seconds = parts.find(p => p.type === 'second')?.value || '00';
    } catch {
      const d = new Date();
      hours = String(d.getHours()).padStart(2, '0');
      minutes = String(d.getMinutes()).padStart(2, '0');
      seconds = String(d.getSeconds()).padStart(2, '0');
    }
  }

  return `${cleanDate}T${hours}:${minutes}:${seconds}-03:00`;
}

/**
 * Formata qualquer data para DD/MM/AAAA no fuso horário do Brasil (America/Sao_Paulo).
 * Se a data de entrada for pura (YYYY-MM-DD) ou vier com falso UTC meia-noite,
 * garante que NUNCA retroceda um dia.
 */
export function formatDateBR(dateInput: string | number | Date | any): string {
  if (!dateInput) return '-';
  
  // Suporte a Firestore Timestamp
  if (typeof dateInput === 'object' && dateInput !== null && !(dateInput instanceof Date)) {
    if (typeof dateInput.toDate === 'function') {
      dateInput = dateInput.toDate();
    } else if (typeof dateInput.seconds === 'number') {
      dateInput = new Date(dateInput.seconds * 1000);
    }
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '-';

    // Formato puro YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${day}/${month}/${year}`;
    }
    // Já formatado como DD/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // Falso UTC da meia-noite YYYY-MM-DDT00:00:00...
    if (/^\d{4}-\d{2}-\d{2}T00:00(:00)?(\.000)?(Z|[+-]\d{2}:\d{2})?$/i.test(trimmed)) {
      const [datePart] = trimmed.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }
  }

  try {
    let d: Date;
    if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
        d = new Date(`${trimmed}-03:00`);
      } else {
        d = new Date(trimmed);
      }
    } else {
      d = dateInput;
    }

    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '-';

    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);

    // Proteção rigorosa contra recuo indevido de dia por meia-noite UTC
    if (typeof dateInput === 'string') {
      const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const [, y, mo, da] = m;
        const expectedDateStr = `${da}/${mo}/${y}`;
        if (expectedDateStr !== dateStr && (dateInput.includes('T00:00:00') || dateInput.includes('T01:00:00') || dateInput.includes('T02:00:00') || dateInput.includes('T03:00:00'))) {
          return expectedDateStr;
        }
      }
    }

    return dateStr;
  } catch {
    return String(dateInput);
  }
}

export const formatDateSaoPaulo = formatDateBR;

/**
 * Formata data e horário para DD/MM/AAAA HH:mm no fuso horário do Brasil (America/Sao_Paulo).
 * Garante que:
 * 1. Strings sem horário (YYYY-MM-DD) ou com meia-noite UTC NÃO exibam o falso "21:00".
 * 2. Strings com data e hora reais mantenham a data intacta (nunca volte 1 dia) e preservem
 *    o horário exato em que o evento ocorreu.
 */
export function formatDateTimeBR(dateTimeInput: string | number | Date | any): string {
  if (!dateTimeInput) return '-';

  // Suporte a Firestore Timestamp
  if (typeof dateTimeInput === 'object' && dateTimeInput !== null && !(dateTimeInput instanceof Date)) {
    if (typeof dateTimeInput.toDate === 'function') {
      dateTimeInput = dateTimeInput.toDate();
    } else if (typeof dateTimeInput.seconds === 'number') {
      dateTimeInput = new Date(dateTimeInput.seconds * 1000);
    }
  }

  if (typeof dateTimeInput === 'string') {
    const trimmed = dateTimeInput.trim();
    if (!trimmed) return '-';

    // 1. Formato puro YYYY-MM-DD -> não há horário gravado, não inventar 21:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${day}/${month}/${year}`;
    }

    // 2. Falso UTC da meia-noite gerado por serialização UTC de data pura -> não exibir 21:00!
    if (/^\d{4}-\d{2}-\d{2}T00:00(:00)?(\.000)?(Z|[+-]\d{2}:\d{2})?$/i.test(trimmed)) {
      const [datePart] = trimmed.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }

    // 3. String de datetime-local sem timezone (ex: "2026-09-07T14:30"):
    // Como foi digitada no Brasil, os valores de data e hora já estão em horário local de Brasília!
    const noOffsetMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (noOffsetMatch) {
      const [, y, m, d, hh, mm] = noOffsetMatch;
      if (hh === '00' && mm === '00') {
        return `${d}/${m}/${y}`;
      }
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }
  }

  try {
    let d: Date;
    if (typeof dateTimeInput === 'number') {
      d = new Date(dateTimeInput);
    } else if (typeof dateTimeInput === 'string') {
      const trimmed = dateTimeInput.trim();
      // Se string sem offset, assume fuso de Brasília (-03:00)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
        d = new Date(`${trimmed}-03:00`);
      } else {
        d = new Date(trimmed);
      }
    } else {
      d = dateTimeInput;
    }

    if (isNaN(d.getTime())) return typeof dateTimeInput === 'string' ? dateTimeInput : '-';

    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);

    const timeStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_BR,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

    // Proteção contra offset UTC que converte 00:00 UTC para 21:00 do dia anterior
    if (typeof dateTimeInput === 'string') {
      const m = dateTimeInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const [, y, mo, da] = m;
        const expectedDateStr = `${da}/${mo}/${y}`;
        if (expectedDateStr !== dateStr && (timeStr === '21:00' || timeStr === '20:00' || timeStr === '22:00')) {
          // O dia voltou para trás devido à conversão de meia-noite UTC! Preserva a data real sem o falso 21:00.
          return expectedDateStr;
        }
      }
    }

    return `${dateStr} ${timeStr}`;
  } catch {
    return String(dateTimeInput);
  }
}

export const formatDateTimeSaoPaulo = formatDateTimeBR;

export function getFuelTypeName(fuelType: FuelType | string | undefined | null): string {
  if (!fuelType || fuelType === 'NENHUM') return 'Nenhum (Não se aplica)';
  switch (fuelType) {
    case 'DIESEL_S10': return 'Diesel S10';
    case 'DIESEL_S500': return 'Diesel S500';
    case 'GASOLINA_COMUM': return 'Gasolina Comum';
    case 'GASOLINA_GRID': return 'Gasolina Aditivada';
    case 'ETANOL': return 'Etanol Hidratado';
    case 'ARLA_32': return 'Arla 32';
    default: return fuelType;
  }
}

/**
 * Resolves the precise price per liter for a given fuel type and gas station.
 * Strictly respects gasoline, ethanol, arla, and diesel categories without cross-contamination.
 */
export function getStationFuelPrice(station?: GasStation, fuelType?: FuelType | string | null): number {
  if (!fuelType || fuelType === 'NENHUM') {
    return 0;
  }

  const rawType = String(fuelType).toUpperCase();
  const prices = station?.pricePerLiter;

  // 1. Direct match in station's price map
  if (prices && typeof (prices as any)[rawType] === 'number' && (prices as any)[rawType] > 0) {
    return (prices as any)[rawType];
  }

  // 2. Category-based resolution
  if (rawType.includes('GASOLINA')) {
    if (rawType.includes('GRID') || rawType.includes('ADITIVADA')) {
      return prices?.GASOLINA_GRID || prices?.GASOLINA_COMUM || 6.29;
    }
    return prices?.GASOLINA_COMUM || prices?.GASOLINA_GRID || 5.99;
  }

  if (rawType.includes('ETANOL') || rawType.includes('ALCOOL')) {
    return prices?.ETANOL || 3.89;
  }

  if (rawType.includes('ARLA')) {
    return prices?.ARLA_32 || 2.50;
  }

  if (rawType.includes('S500')) {
    return prices?.DIESEL_S500 || prices?.DIESEL_S10 || 5.59;
  }

  if (rawType.includes('DIESEL')) {
    return prices?.DIESEL_S10 || prices?.DIESEL_S500 || 5.79;
  }

  // Default fallback according to station diesel
  return prices?.DIESEL_S10 || 5.79;
}

export function getSectorName(sector: Sector): string {
  switch (sector) {
    case 'AGRICOLA': return 'Agrícola';
    case 'LOGISTICA': return 'Logística / Transportes';
    case 'OFICINA_MANUTENCAO': return 'Oficina & Manutenção';
    case 'DIRETORIA': return 'Diretoria Executiva';
    case 'COLHEITA': return 'Colheita';
    case 'PULVERIZACAO': return 'Pulverização';
    case 'PREPARO_SOLO': return 'Preparo de Solo';
    default: return sector;
  }
}

export function getCategoryLabel(category?: string | null): string {
  switch (category) {
    case 'TRATOR': return 'Trator';
    case 'VEICULO': return 'Veículo';
    case 'MAQUINA_AGRICOLA': return 'Máquina Agrícola';
    case 'IMPLEMENTO': return 'Implemento';
    default: return category || 'Equipamento';
  }
}

export const getCategoryName = getCategoryLabel;

export function calculateFuelLogMetrics(
  liters: number,
  pricePerLiter: number,
  equipment: Vehicle,
  currentKmOrHour: number,
  previousLogsForEquipment: FuelLog[],
  suspiciousMarginPercent: number = 25
): {
  totalValue: number;
  calculatedAverageKmPerLiter?: number;
  calculatedAverageLitersPerHour?: number;
  costPerKm?: number;
  costPerHour?: number;
  estimatedAutonomyKmOrHours?: number;
  previousKmOrHour?: number;
  flaggedSuspicious: boolean;
  suspiciousReason?: string;
} {
  const totalValue = Number((liters * pricePerLiter).toFixed(2));
  
  // Find last previous fuel log for this equipment
  const sortedLogs = [...previousLogsForEquipment].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
  );
  
  const lastLog = sortedLogs[0];
  const isKmBased = equipment.category === 'VEICULO';
  let previousKmOrHour = lastLog 
    ? (isKmBased ? lastLog.kmAtFueling : lastLog.hourmeterAtFueling)
    : (isKmBased ? equipment.currentKm : equipment.currentHourmeter);

  let calculatedAverageKmPerLiter: number | undefined;
  let calculatedAverageLitersPerHour: number | undefined;
  let costPerKm: number | undefined;
  let costPerHour: number | undefined;
  let estimatedAutonomyKmOrHours: number | undefined;
  let flaggedSuspicious = false;
  let suspiciousReason: string | undefined;

  if (previousKmOrHour !== undefined && currentKmOrHour > previousKmOrHour && liters > 0) {
    const diff = currentKmOrHour - previousKmOrHour;

    if (isKmBased) {
      // km per Liter
      calculatedAverageKmPerLiter = Number((diff / liters).toFixed(2));
      costPerKm = Number((totalValue / diff).toFixed(3));
      estimatedAutonomyKmOrHours = Number((equipment.tankCapacityLiters * calculatedAverageKmPerLiter).toFixed(0));

      // Historical average
      const prevAverages = sortedLogs
        .map(l => l.calculatedAverageKmPerLiter)
        .filter((val): val is number => val !== undefined && val > 0);

      if (prevAverages.length > 0) {
        const avgKmL = prevAverages.reduce((acc, v) => acc + v, 0) / prevAverages.length;
        // If km/L dropped significantly (e.g. consuming way more fuel per km)
        if (calculatedAverageKmPerLiter < avgKmL * (1 - suspiciousMarginPercent / 100)) {
          flaggedSuspicious = true;
          suspiciousReason = `Rendimento de ${calculatedAverageKmPerLiter} km/L está ${suspiciousMarginPercent}% abaixo da média histórica (${avgKmL.toFixed(2)} km/L).`;
        }
      }
    } else {
      // Liters per Hour
      calculatedAverageLitersPerHour = Number((liters / diff).toFixed(2));
      costPerHour = Number((totalValue / diff).toFixed(2));
      if (calculatedAverageLitersPerHour > 0) {
        estimatedAutonomyKmOrHours = Number((equipment.tankCapacityLiters / calculatedAverageLitersPerHour).toFixed(1));
      }

      // Historical average
      const prevAverages = sortedLogs
        .map(l => l.calculatedAverageLitersPerHour)
        .filter((val): val is number => val !== undefined && val > 0);

      if (prevAverages.length > 0) {
        const avgLh = prevAverages.reduce((acc, v) => acc + v, 0) / prevAverages.length;
        // If Liters per hour spiked
        if (calculatedAverageLitersPerHour > avgLh * (1 + suspiciousMarginPercent / 100)) {
          flaggedSuspicious = true;
          suspiciousReason = `Consumo de ${calculatedAverageLitersPerHour} L/h está ${suspiciousMarginPercent}% acima da média histórica (${avgLh.toFixed(1)} L/h).`;
        }
      }
    }
  }

  return {
    totalValue,
    calculatedAverageKmPerLiter,
    calculatedAverageLitersPerHour,
    costPerKm,
    costPerHour,
    estimatedAutonomyKmOrHours,
    previousKmOrHour,
    flaggedSuspicious,
    suspiciousReason
  };
}

// PDF Export Function - Relatório Oficial Tradicional (Tabela com Gráficos no Final)
export async function exportFuelLogsPDF(
  logs: FuelLog[],
  title: string = 'Relatório de Abastecimentos',
  companyInfo: { name: string; slogan: string; cnpj: string },
  canViewFinancial: boolean = true,
  options?: {
    vehicles?: Vehicle[];
    appliedFiltersDesc?: string;
    dateRangeStr?: string;
  }
) {
  const { exportReportPDF } = await import('./reportExportService');
  return exportReportPDF({
    logs,
    vehicles: options?.vehicles || [],
    companyInfo,
    dateRangeStr: options?.dateRangeStr || 'Período Selecionado',
    canViewFinancial,
    appliedFiltersDesc: options?.appliedFiltersDesc || 'Filtros aplicados: Período selecionado',
    reportTitle: title
  });
}

export interface ExecutiveReportOptions {
  logs: FuelLog[];
  vehicles: Vehicle[];
  companyInfo: { name: string; slogan: string; cnpj: string };
  dateRangeStr: string;
  canViewFinancial: boolean;
  appliedFiltersDesc?: string;
  reportTitle?: string;
}

// PDF Export Function - Relatório Executivo Completo com Resumo Gerencial e Gráficos Vetoriais
export async function exportExecutiveReportPDF(options: ExecutiveReportOptions) {
  const { exportReportPDF } = await import("./reportExportService");
  return exportReportPDF({
    ...options,
    reportTitle: options.reportTitle || "Relatório Executivo Gerencial"
  });
}

// Excel Export Function - Relatório em Excel (.xlsx) com Gráficos Incorporados abaixo da Tabela
export async function exportFuelLogsExcelWithCharts(options: ExecutiveReportOptions) {
  const { exportReportExcel } = await import("./reportExportService");
  return exportReportExcel(options);
}

// Excel / CSV Export Function - Tradicional
export function exportFuelLogsCSV(logs: FuelLog[], fileName: string = 'Abastecimentos_AndradeAgro', canViewFinancial: boolean = true) {
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
    headers.push('Valor por Litro (R$)');
    headers.push('Valor Total (R$)');
  }

  headers.push(
    'KM no Abastecimento',
    'Horímetro no Abastecimento',
    'Média km/L',
    'Média L/h'
  );

  if (canViewFinancial) {
    headers.push('Custo por KM (R$)');
    headers.push('Custo por Hora (R$)');
  }

  headers.push('Observações');

  const rows = logs.map(l => {
    const row = [
      `"${formatDateTimeBR(l.dateTime)}"`,
      `"${l.equipmentId}"`,
      `"${l.equipmentCategory}"`,
      `"${l.equipmentPlateOrCode}"`,
      `"${(l.equipmentName || '').replace(/"/g, '""')}"`,
      `"${getOperationTypeName(l.operationType)}"`,
      `"${l.activityType ? getActivityTypeName(l.activityType, l.operationType) : ''}"`,
      `"${(l.driverOrOperatorName || '').replace(/"/g, '""')}"`,
      `"${(l.attendantName || '').replace(/"/g, '""')}"`,
      `"${(l.gasStationName || '').replace(/"/g, '""')}"`,
      `"${getFuelTypeName(l.fuelType)}"`,
      l.liters
    ];

    if (canViewFinancial) {
      row.push(l.pricePerLiter as any);
      row.push(l.totalValue as any);
    }

    row.push(
      l.kmAtFueling ?? '' as any,
      l.hourmeterAtFueling ?? '' as any,
      l.calculatedAverageKmPerLiter ?? '' as any,
      l.calculatedAverageLitersPerHour ?? '' as any
    );

    if (canViewFinancial) {
      row.push(l.costPerKm ?? '' as any);
      row.push(l.costPerHour ?? '' as any);
    }

    row.push(`"${(l.observations || '').replace(/"/g, '""')}"`);
    return row;
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exportação Completa e Estruturada: Relatório Gerencial
export function exportManagerialCSV(options: {
  logs: FuelLog[];
  vehicles: Vehicle[];
  dateRangeStr: string;
  canViewFinancial: boolean;
  companyName: string;
}) {
  const { logs, vehicles, dateRangeStr, canViewFinancial, companyName } = options;

  const totalLiters = logs.reduce((acc, l) => acc + (l.liters || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (l.totalValue || 0), 0);
  const totalCount = logs.length;
  const avgLiters = totalCount > 0 ? totalLiters / totalCount : 0;

  // Mapa de setores dos veículos
  const vehicleMap = new Map<string, Vehicle>();
  vehicles.forEach(v => {
    if (v.id) vehicleMap.set(v.id, v);
  });

  // Agrupamentos
  const actMap = new Map<string, { liters: number; cost: number; count: number }>();
  const operMap = new Map<string, { liters: number; cost: number; count: number }>();
  const eqMap = new Map<string, { name: string; code: string; sector: string; liters: number; cost: number; count: number }>();
  const secMap = new Map<string, { liters: number; cost: number; count: number }>();

  logs.forEach(l => {
    const liters = l.liters || 0;
    const cost = l.totalValue || 0;
    const act = getEffectiveActivityName(l);
    const oper = getEffectiveCategoryName(l);
    const veh = vehicleMap.get(l.equipmentId);
    const sector = getSectorName(veh?.sector || 'AGRICOLA');

    // Atividade
    const a = actMap.get(act) || { liters: 0, cost: 0, count: 0 };
    a.liters += liters; a.cost += cost; a.count += 1;
    actMap.set(act, a);

    // Operação
    const o = operMap.get(oper) || { liters: 0, cost: 0, count: 0 };
    o.liters += liters; o.cost += cost; o.count += 1;
    operMap.set(oper, o);

    // Equipamento
    const eqKey = l.equipmentId || l.equipmentName;
    const eq = eqMap.get(eqKey) || { name: l.equipmentName, code: l.equipmentPlateOrCode, sector, liters: 0, cost: 0, count: 0 };
    eq.liters += liters; eq.cost += cost; eq.count += 1;
    eqMap.set(eqKey, eq);

    // Setor
    const s = secMap.get(sector) || { liters: 0, cost: 0, count: 0 };
    s.liters += liters; s.cost += cost; s.count += 1;
    secMap.set(sector, s);
  });

  const lines: string[] = [];

  // Seção 1: Cabeçalho
  lines.push(`"# RELATÓRIO GERENCIAL DE ABASTECIMENTOS - ${companyName.toUpperCase()}"`);
  lines.push(`"# Período: ${dateRangeStr} | Gerado em: ${formatDateTimeBR(new Date().toISOString())}"`);
  lines.push('');

  // Seção 2: Resumo Gerencial
  lines.push('"# --- RESUMO GERENCIAL ---"');
  lines.push('Indicador;Valor');
  lines.push(`"Total de Abastecimentos";${totalCount}`);
  lines.push(`"Volume Total Abastecido (Litros)";${totalLiters.toFixed(1)}`);
  lines.push(`"Média de Litros por Abastecimento";${avgLiters.toFixed(1)}`);
  if (canViewFinancial) {
    lines.push(`"Investimento Total (R$)";${totalCost.toFixed(2)}`);
    lines.push(`"Custo Médio por Litro (R$)";${totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : '0.00'}`);
  }
  lines.push('');

  // Seção 3: Consumo por Atividade
  lines.push('"# --- CONSUMO POR ATIVIDADE ---"');
  lines.push(canViewFinancial ? 'Atividade;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Atividade;Litros;Percentual;Qtd Abastecimentos');
  Array.from(actMap.entries())
    .sort((a, b) => b[1].liters - a[1].liters)
    .forEach(([name, data]) => {
      const pct = totalLiters > 0 ? ((data.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count};${data.cost.toFixed(2)}`);
      } else {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count}`);
      }
    });
  lines.push('');

  // Seção 4: Consumo por Operação
  lines.push('"# --- CONSUMO POR OPERAÇÃO ---"');
  lines.push(canViewFinancial ? 'Operação;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Operação;Litros;Percentual;Qtd Abastecimentos');
  Array.from(operMap.entries())
    .sort((a, b) => b[1].liters - a[1].liters)
    .forEach(([name, data]) => {
      const pct = totalLiters > 0 ? ((data.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count};${data.cost.toFixed(2)}`);
      } else {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count}`);
      }
    });
  lines.push('');

  // Seção 5: Consumo por Equipamento (Top Máquinas)
  lines.push('"# --- CONSUMO POR EQUIPAMENTO ---"');
  lines.push(canViewFinancial ? 'Equipamento;Placa/Código;Setor;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Equipamento;Placa/Código;Setor;Litros;Percentual;Qtd Abastecimentos');
  Array.from(eqMap.values())
    .sort((a, b) => b.liters - a.liters)
    .forEach(e => {
      const pct = totalLiters > 0 ? ((e.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${e.name}";"${e.code}";"${e.sector}";${e.liters.toFixed(1)};${pct};${e.count};${e.cost.toFixed(2)}`);
      } else {
        lines.push(`"${e.name}";"${e.code}";"${e.sector}";${e.liters.toFixed(1)};${pct};${e.count}`);
      }
    });
  lines.push('');

  // Seção 6: Consumo por Setor
  lines.push('"# --- CONSUMO POR SETOR ---"');
  lines.push(canViewFinancial ? 'Setor;Litros;Percentual;Qtd Abastecimentos;Valor Total (R$)' : 'Setor;Litros;Percentual;Qtd Abastecimentos');
  Array.from(secMap.entries())
    .sort((a, b) => b[1].liters - a[1].liters)
    .forEach(([name, data]) => {
      const pct = totalLiters > 0 ? ((data.liters / totalLiters) * 100).toFixed(1) + '%' : '0%';
      if (canViewFinancial) {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count};${data.cost.toFixed(2)}`);
      } else {
        lines.push(`"${name}";${data.liters.toFixed(1)};${pct};${data.count}`);
      }
    });
  lines.push('');

  // Seção 7: Lançamentos Detalhados
  lines.push('"# --- LANÇAMENTOS DETALHADOS ---"');
  const headers = [
    'Data/Hora',
    'ID Equipamento',
    'Placa / Código',
    'Nome Equipamento',
    'Tipo de Operação',
    'Atividade',
    'Motorista / Operador',
    'Posto',
    'Combustível',
    'Litros'
  ];
  if (canViewFinancial) {
    headers.push('R$/L', 'Total R$');
  }
  headers.push('KM', 'Horímetro', 'Média');
  lines.push(headers.join(';'));

  logs.forEach(l => {
    const row = [
      `"${formatDateTimeBR(l.dateTime)}"`,
      `"${l.equipmentId}"`,
      `"${l.equipmentPlateOrCode}"`,
      `"${(l.equipmentName || '').replace(/"/g, '""')}"`,
      `"${getOperationTypeName(l.operationType)}"`,
      `"${l.activityType ? getActivityTypeName(l.activityType, l.operationType) : ''}"`,
      `"${(l.driverOrOperatorName || '').replace(/"/g, '""')}"`,
      `"${(l.gasStationName || '').replace(/"/g, '""')}"`,
      `"${getFuelTypeName(l.fuelType)}"`,
      l.liters
    ];

    if (canViewFinancial) {
      row.push(l.pricePerLiter as any, l.totalValue as any);
    }

    row.push(
      l.kmAtFueling ?? '' as any,
      l.hourmeterAtFueling ?? '' as any,
      (l.calculatedAverageKmPerLiter ? `${l.calculatedAverageKmPerLiter} km/L` : l.calculatedAverageLitersPerHour ? `${l.calculatedAverageLitersPerHour} L/h` : '-') as any
    );

    lines.push(row.join(';'));
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + lines.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `AndradeAgro_Relatorio_Gerencial_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export { 
  OPERATIONS_CONFIG, 
  OPERATION_OPTIONS, 
  getActivitiesForOperation, 
  getOperationTypeName, 
  getOperationTypeLabelOnly, 
  getActivityTypeName,
  getEffectiveActivityName,
  getEffectiveCategoryName,
  getConsumptionByCategory,
  getConsumptionByActivity,
  CATEGORY_PALETTE
} from './operations';
