import { Vehicle, MaintenanceLog } from '../types';

export type OilStatusType = 'EM_DIA' | 'PROXIMA' | 'ATRASADA' | 'DESATIVADO';

export interface OilChangeStatus {
  isOilActive: boolean;
  isKm: boolean;
  unit: 'km' | 'h';
  unitName: string;
  currentMeter: number;
  lastMeter: number;
  lastDate: string;
  interval: number;
  warningAdvance: number;
  advance: number; // alias for warningAdvance
  nextMeter: number;
  remaining: number; // > 0: remaining; <= 0: overdue
  hoursOrKmOverdue: number;
  metersInCycle: number;
  status: OilStatusType;
  statusLabel: string;
  statusShortLabel: string;
  statusDetailedMessage: string;
  progressPercent: number; // 0 to 100
  badgeClass: string;
  badgeBorderClass: string;
  barColor: string;
}

/**
 * Checks whether a maintenance log corresponds strictly to an oil change service.
 * Rule: SOMENTE uma manutenção especificamente do tipo TROCA_OLEO pode dar baixa ou resetar o controle de óleo.
 */
export function isOilMaintenanceService(
  type?: string
): boolean {
  return type === 'TROCA_OLEO';
}

/**
 * Single Source of Truth for calculating Oil Change status, intervals, and remaining hours/km.
 */
export function calculateOilChangeStatus(vehicle: Vehicle): OilChangeStatus {
  const isKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
  const isOilActive = vehicle.oilChangeControlActive !== false && vehicle.category !== 'IMPLEMENTO';
  const unit: 'km' | 'h' = isKm ? 'km' : 'h';
  const unitName = isKm ? 'Quilômetros' : 'Horas';

  if (!isOilActive) {
    const cur = isKm ? (Number(vehicle.currentKm) || 0) : (Number(vehicle.currentHourmeter) || 0);
    return {
      isOilActive: false,
      isKm,
      unit,
      unitName,
      currentMeter: cur,
      lastMeter: 0,
      lastDate: '',
      interval: isKm ? 10000 : 300,
      warningAdvance: isKm ? 1000 : 50,
      advance: isKm ? 1000 : 50,
      nextMeter: 0,
      remaining: 0,
      hoursOrKmOverdue: 0,
      metersInCycle: 0,
      status: 'DESATIVADO',
      statusLabel: 'Controle desativado',
      statusShortLabel: 'Desativado',
      statusDetailedMessage: 'O controle de troca de óleo está desativado para este equipamento.',
      progressPercent: 0,
      badgeClass: 'bg-slate-500/20 text-slate-400',
      badgeBorderClass: 'border-slate-500/30',
      barColor: 'bg-slate-400'
    };
  }

  const currentMeter = isKm ? (Number(vehicle.currentKm) || 0) : (Number(vehicle.currentHourmeter) || 0);
  const interval = isKm
    ? (Number(vehicle.oilChangeIntervalKm) || Number(vehicle.maintenanceIntervalKm) || 10000)
    : (Number(vehicle.oilChangeIntervalHours) || Number(vehicle.maintenanceIntervalHours) || 300);

  const warningAdvance = isKm
    ? (vehicle.oilChangeWarningAdvanceKm !== undefined ? Number(vehicle.oilChangeWarningAdvanceKm) : (Number(vehicle.maintenanceWarningAdvanceKm) || 1000))
    : (vehicle.oilChangeWarningAdvanceHours !== undefined ? Number(vehicle.oilChangeWarningAdvanceHours) : (Number(vehicle.maintenanceWarningAdvanceHours) || 50));

  const lastMeter = isKm
    ? (vehicle.lastOilChangeKm !== undefined ? Number(vehicle.lastOilChangeKm) : 0)
    : (vehicle.lastOilChangeHourmeter !== undefined ? Number(vehicle.lastOilChangeHourmeter) : 0);

  const lastDate = vehicle.lastOilChangeDate || '';

  // Determine next target meter: if explicitly configured/calculated and > lastMeter, use it; otherwise lastMeter + interval
  let nextMeter = isKm
    ? (vehicle.nextOilChangeKm !== undefined && Number(vehicle.nextOilChangeKm) > 0 ? Number(vehicle.nextOilChangeKm) : (lastMeter > 0 ? lastMeter + interval : interval))
    : (vehicle.nextOilChangeHourmeter !== undefined && Number(vehicle.nextOilChangeHourmeter) > 0 ? Number(vehicle.nextOilChangeHourmeter) : (lastMeter > 0 ? lastMeter + interval : interval));

  if (nextMeter <= lastMeter) {
    nextMeter = lastMeter + interval;
  }

  const remaining = nextMeter - currentMeter;
  const hoursOrKmOverdue = remaining < 0 ? Math.abs(remaining) : 0;
  const cycleUsed = Math.max(0, currentMeter - lastMeter);
  const progressPercent = Math.min(100, Math.max(0, (cycleUsed / interval) * 100));

  const unitWord = isKm ? 'quilômetros' : 'horas';

  let status: OilStatusType = 'EM_DIA';
  let statusLabel = `Em dia (${remaining.toLocaleString('pt-BR')} ${unit} restantes)`;
  let statusShortLabel = 'Em dia';
  let statusDetailedMessage = `A manutenção está em dia. Faltam ${remaining.toLocaleString('pt-BR')} ${unitWord} para a próxima troca programada (meta de ${nextMeter.toLocaleString('pt-BR')} ${unit}).`;
  let badgeClass = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
  let badgeBorderClass = 'border-emerald-500/30';
  let barColor = 'bg-emerald-500';

  if (remaining <= 0 || currentMeter >= nextMeter) {
    status = 'ATRASADA';
    statusLabel = hoursOrKmOverdue > 0 
      ? `Troca de óleo vencida (${hoursOrKmOverdue.toLocaleString('pt-BR')} ${unit} de atraso)`
      : `Troca de óleo vencida`;
    statusShortLabel = 'Troca de óleo vencida';
    statusDetailedMessage = `ATENÇÃO: Troca de óleo vencida! O equipamento atingiu ou ultrapassou o limite oficial de ${nextMeter.toLocaleString('pt-BR')} ${unit}${hoursOrKmOverdue > 0 ? ` (excedido em ${hoursOrKmOverdue.toLocaleString('pt-BR')} ${unitWord})` : ''}.`;
    badgeClass = 'bg-red-500 text-white font-extrabold animate-pulse';
    badgeBorderClass = 'border-red-600';
    barColor = 'bg-red-500';
  } else if (remaining <= warningAdvance) {
    status = 'PROXIMA';
    statusLabel = `Troca de óleo próxima (faltam ${remaining.toLocaleString('pt-BR')} ${unit})`;
    statusShortLabel = 'Troca de óleo próxima';
    statusDetailedMessage = `Troca de óleo próxima: faltam ${remaining.toLocaleString('pt-BR')} ${unitWord} para a troca de óleo (prevista para ${nextMeter.toLocaleString('pt-BR')} ${unit}).`;
    badgeClass = 'bg-amber-500 text-gray-950 font-extrabold';
    badgeBorderClass = 'border-amber-600';
    barColor = 'bg-amber-500';
  }

  return {
    isOilActive: true,
    isKm,
    unit,
    unitName,
    currentMeter,
    lastMeter,
    lastDate,
    interval,
    warningAdvance,
    advance: warningAdvance,
    nextMeter,
    remaining,
    hoursOrKmOverdue,
    metersInCycle: cycleUsed,
    status,
    statusLabel,
    statusShortLabel,
    statusDetailedMessage,
    progressPercent,
    badgeClass,
    badgeBorderClass,
    barColor
  };
}
