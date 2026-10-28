import { OperationType, ActivityType, FuelLog } from '../types';

export interface ActivityOption {
  id: string;
  label: string;
  description?: string;
}

export interface OperationOption {
  id: OperationType;
  label: string;
  emoji: string;
  activities: ActivityOption[];
}

/**
 * Tabela mestra de Operações e Atividades do AndradeAgro.
 * Estruturada centralizadamente para permitir fácil adição de novas operações ou atividades.
 */
export const OPERATIONS_CONFIG: Record<OperationType, { label: string; emoji: string; activities: ActivityOption[] }> = {
  GRAMA: {
    label: 'Grama',
    emoji: '🌱',
    activities: [
      { id: 'CORTE', label: 'Corte' },
      { id: 'ROCADA', label: 'Roçada' },
      { id: 'APLICACAO', label: 'Aplicação' },
      { id: 'COLETA_PALHA', label: 'Coleta de palha' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  COLHEITA: {
    label: 'Colheita',
    emoji: '🌾',
    activities: [
      { id: 'COLHEITA', label: 'Colheita' },
      { id: 'CORTE', label: 'Corte' },
      { id: 'CARREGAMENTO', label: 'Carregamento' },
      { id: 'TRANSBORDO', label: 'Transbordo' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  PLANTIO: {
    label: 'Plantio',
    emoji: '🚜',
    activities: [
      { id: 'PLANTIO', label: 'Plantio' },
      { id: 'PREPARO_SOLO', label: 'Preparo de solo' },
      { id: 'SULCACAO', label: 'Sulcação' },
      { id: 'ADUBACAO', label: 'Adubação' },
      { id: 'APLICACAO', label: 'Aplicação' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  TRANSPORTE: {
    label: 'Transporte',
    emoji: '🚚',
    activities: [
      { id: 'TRANSPORTE_CANA', label: 'Transporte de cana' },
      { id: 'TRANSPORTE_INSUMOS', label: 'Transporte de insumos' },
      { id: 'TRANSPORTE_MAQUINAS', label: 'Transporte de máquinas' },
      { id: 'TRANSPORTE_MATERIAIS', label: 'Transporte de materiais' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  CANA: {
    label: 'Cana',
    emoji: '🎋',
    activities: [
      { id: 'CORTE_CANA', label: 'Corte de cana' },
      { id: 'ADUBACAO_CANA', label: 'Adubação de cana' },
      { id: 'TRANSPORTE_CANA', label: 'Transporte de cana' },
      { id: 'ENLEIRAMENTO_PALHA', label: 'Enleiramento de palha' },
      { id: 'APLICACAO', label: 'Aplicação' },
      { id: 'PLANTIO_CANA', label: 'Plantio de cana' },
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
  OUTROS: {
    label: 'Outros',
    emoji: '🔧',
    activities: [
      { id: 'OUTRAS', label: 'Outras' },
    ],
  },
};

export const OPERATION_OPTIONS: Array<{ id: OperationType; label: string; emoji: string }> = [
  { id: 'GRAMA', label: 'Grama', emoji: '🌱' },
  { id: 'COLHEITA', label: 'Colheita', emoji: '🌾' },
  { id: 'PLANTIO', label: 'Plantio', emoji: '🚜' },
  { id: 'TRANSPORTE', label: 'Transporte', emoji: '🚚' },
  { id: 'CANA', label: 'Cana', emoji: '🎋' },
  { id: 'OUTROS', label: 'Outros', emoji: '🔧' },
];

export function getActivitiesForOperation(operationType?: OperationType | string | null): ActivityOption[] {
  if (!operationType) return [];
  const opKey = operationType.toUpperCase() as OperationType;
  const op = OPERATIONS_CONFIG[opKey];
  if (op && Array.isArray(op.activities)) {
    return op.activities;
  }
  return [{ id: 'OUTRAS', label: 'Outras' }];
}

export function getOperationTypeName(operationType?: OperationType | string | null): string {
  if (!operationType) return '-';
  const opKey = operationType.toUpperCase() as OperationType;
  const op = OPERATIONS_CONFIG[opKey];
  return op ? `${op.emoji} ${op.label}` : String(operationType);
}

export function getOperationTypeLabelOnly(operationType?: OperationType | string | null): string {
  if (!operationType) return '-';
  const opKey = operationType.toUpperCase() as OperationType;
  const op = OPERATIONS_CONFIG[opKey];
  return op ? op.label : String(operationType);
}

export function getActivityTypeName(activityType?: ActivityType | string | null, operationType?: OperationType | string | null): string {
  if (!activityType) return '-';
  const actKey = String(activityType).toUpperCase();
  
  // Compatibilidade com histórico e novas atividades de Cana
  if (actKey === 'ADUBACAO_CANA' || actKey === 'ADUBACAO DE CANA') return 'Adubação de cana';
  if (actKey === 'ENLEIRAMENTO_PALHA' || actKey === 'ENLEIRAMENTO DE PALHA') return 'Enleiramento de palha';

  // Se for registro antigo gravado como 'CARREGAMENTO_CANA'
  if (actKey === 'CARREGAMENTO_CANA' || actKey === 'CARREGAMENTO DE CANA') return 'Adubação de cana';

  // Se for registro antigo de Cana gravado como 'TRANSBORDO'
  if (operationType === 'CANA' && actKey === 'TRANSBORDO') {
    return 'Enleiramento de palha';
  }

  if (operationType) {
    const list = getActivitiesForOperation(operationType);
    const found = list.find(a => a.id.toUpperCase() === actKey || a.label.toLowerCase() === String(activityType).toLowerCase());
    if (found) return found.label;
  }
  
  // Search in all operations
  for (const key of Object.keys(OPERATIONS_CONFIG) as OperationType[]) {
    const found = OPERATIONS_CONFIG[key].activities.find(
      a => a.id.toUpperCase() === actKey || a.label.toLowerCase() === String(activityType).toLowerCase()
    );
    if (found) return found.label;
  }
  
  if (actKey === 'OUTROS' || actKey === 'OUTRAS') return 'Outras';
  return String(activityType);
}

/**
 * Retorna o nome efetivo da atividade / serviço para análise e relatórios.
 * Se a atividade for 'OUTRAS' ou 'OUTROS' (ou tipo OUTROS) e houver observação preenchida,
 * utiliza a observação como atividade personalizada.
 */
export function getEffectiveActivityName(log: { 
  activityType?: ActivityType | string | null; 
  operationType?: OperationType | string | null; 
  observations?: string | null;
}): string {
  const actKey = log.activityType ? String(log.activityType).toUpperCase() : '';
  const isOther = !log.activityType || 
                  actKey === 'OUTRAS' || 
                  actKey === 'OUTROS' || 
                  log.operationType === 'OUTROS';
  
  if (isOther && log.observations && log.observations.trim().length > 0) {
    // Trunca se for texto excessivamente longo mantendo legibilidade
    const obs = log.observations.trim();
    return obs.length > 35 ? `${obs.substring(0, 32)}...` : obs;
  }
  
  return getActivityTypeName(log.activityType, log.operationType);
}

/**
 * Retorna o nome efetivo da categoria / operação para agrupamento e gráficos.
 * Compatível com registros legados (usando equipmentCategory como fallback).
 */
export function getEffectiveCategoryName(log: { 
  operationType?: OperationType | string | null; 
  equipmentCategory?: string | null;
}): string {
  if (log.operationType) {
    const op = OPERATIONS_CONFIG[log.operationType as OperationType];
    if (op) return `${op.emoji} ${op.label}`;
    return String(log.operationType);
  }
  
  if (log.equipmentCategory === 'VEICULO') return '🚚 Veículos';
  if (log.equipmentCategory === 'TRATOR') return '🚜 Tratores';
  if (log.equipmentCategory === 'MAQUINA_AGRICOLA') return '🌾 Máquinas Agrícolas';
  return '🔧 Outros / Geral';
}

export interface CategoryConsumptionItem {
  key: string;
  label: string;
  liters: number;
  percentage: number;
  cost: number;
  count: number;
  color?: string;
}

export interface ActivityConsumptionItem {
  key: string;
  activity: string;
  categoryLabel: string;
  liters: number;
  percentage: number;
  cost: number;
  count: number;
  isCustom: boolean;
}

export const CATEGORY_PALETTE: Record<string, string> = {
  GRAMA: '#10B981',      // Emerald
  COLHEITA: '#F59E0B',   // Amber
  PLANTIO: '#059669',    // Dark green
  TRANSPORTE: '#3B82F6', // Blue
  CANA: '#84CC16',       // Lime
  OUTROS: '#FACC15',     // Gold yellow
  VEICULO: '#3B82F6',
  TRATOR: '#10B981',
  MAQUINA_AGRICOLA: '#F59E0B',
};

/**
 * Calcula consumo agrupado por Categoria (Litros e Porcentagem).
 */
export function getConsumptionByCategory(fuelLogs: FuelLog[]): CategoryConsumptionItem[] {
  const totalLiters = fuelLogs.reduce((acc, l) => acc + (l.liters || 0), 0);
  const map = new Map<string, { label: string; liters: number; cost: number; count: number; color: string }>();

  fuelLogs.forEach(l => {
    const rawKey = l.operationType || l.equipmentCategory || 'OUTROS';
    const label = getEffectiveCategoryName(l);
    const existing = map.get(rawKey) || {
      label,
      liters: 0,
      cost: 0,
      count: 0,
      color: CATEGORY_PALETTE[rawKey] || '#10B981'
    };

    existing.liters += (l.liters || 0);
    existing.cost += (l.totalValue || 0);
    existing.count += 1;
    map.set(rawKey, existing);
  });

  return Array.from(map.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      liters: Math.round(data.liters * 10) / 10,
      percentage: totalLiters > 0 ? Math.round((data.liters / totalLiters) * 1000) / 10 : 0,
      cost: data.cost,
      count: data.count,
      color: data.color
    }))
    .sort((a, b) => b.liters - a.liters);
}

/**
 * Calcula consumo agrupado por Atividade / Serviço (Litros e Atividade Personalizada).
 */
export function getConsumptionByActivity(fuelLogs: FuelLog[], categoryFilter?: string | null): ActivityConsumptionItem[] {
  const relevantLogs = categoryFilter && categoryFilter !== 'ALL'
    ? fuelLogs.filter(l => (l.operationType === categoryFilter) || (!l.operationType && l.equipmentCategory === categoryFilter))
    : fuelLogs;

  const totalLiters = relevantLogs.reduce((acc, l) => acc + (l.liters || 0), 0);
  const map = new Map<string, { activity: string; categoryLabel: string; liters: number; cost: number; count: number; isCustom: boolean }>();

  relevantLogs.forEach(l => {
    const effectiveName = getEffectiveActivityName(l);
    const categoryLabel = getEffectiveCategoryName(l);
    const isCustom = Boolean(
      (l.activityType === 'OUTRAS' || l.activityType === 'OUTROS' || l.operationType === 'OUTROS') && 
      l.observations && 
      l.observations.trim().length > 0
    );

    const key = `${effectiveName}__${categoryLabel}`;
    const existing = map.get(key) || {
      activity: effectiveName,
      categoryLabel,
      liters: 0,
      cost: 0,
      count: 0,
      isCustom
    };

    existing.liters += (l.liters || 0);
    existing.cost += (l.totalValue || 0);
    existing.count += 1;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .map(data => ({
      key: `${data.activity}_${data.categoryLabel}`,
      activity: data.activity,
      categoryLabel: data.categoryLabel,
      liters: Math.round(data.liters * 10) / 10,
      percentage: totalLiters > 0 ? Math.round((data.liters / totalLiters) * 1000) / 10 : 0,
      cost: data.cost,
      count: data.count,
      isCustom: data.isCustom
    }))
    .sort((a, b) => b.liters - a.liters);
}

