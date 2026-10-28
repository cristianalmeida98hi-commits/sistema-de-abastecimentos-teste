export type UserRole = 'ADMIN' | 'FUNCIONARIO' | 'MANUTENCAO';

export const canEditSystemData = (role?: UserRole | string | null): boolean => {
  if (!role) return false;
  return role === 'ADMIN' || role === 'MANUTENCAO';
};

export const canManageUsers = (role?: UserRole | string | null): boolean => {
  if (!role) return false;
  return role === 'MANUTENCAO';
};

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatar?: string;
  department: string;
  phone?: string;
  cpf?: string;
  cnh?: string;
  cnhCategory?: string;
  cnhExpiration?: string;
  active: boolean;
}

export type FuelType = 'DIESEL_S10' | 'DIESEL_S500' | 'GASOLINA_COMUM' | 'GASOLINA_GRID' | 'ETANOL' | 'ARLA_32' | 'NENHUM';

export type Sector = 'AGRICOLA' | 'LOGISTICA' | 'OFICINA_MANUTENCAO' | 'DIRETORIA' | 'COLHEITA' | 'PULVERIZACAO' | 'PREPARO_SOLO';

export type EquipmentCategory = 'VEICULO' | 'TRATOR' | 'MAQUINA_AGRICOLA' | 'IMPLEMENTO';

export type MachineSubtype = 
  | 'PULVERIZADOR' 
  | 'COLHEITADEIRA' 
  | 'DISTRIBUIDOR_ADUBO'
  | 'PLANTADEIRA_SEMEADORA'
  | 'ESCAVADEIRA' 
  | 'RETROESCAVADEIRA' 
  | 'PA_CARREGADEIRA' 
  | 'MOTONIVELADORA' 
  | 'IMPLEMENTO'
  | 'CARRETA_AGRICOLA'
  | 'OUTRO';

export type OperationalCapacityType = 
  | 'COMBUSTIVEL'    // Tanque de Combustível (L)
  | 'PULVERIZACAO'   // Tanque de Pulverização / Calda (L)
  | 'ADUBO'          // Tanque / Depósito / Caçamba de Adubo (kg, t, L, m³)
  | 'SEMENTE'        // Depósito de Sementes / Graneleiro (kg, t, L, sacas)
  | 'CACAMBA'        // Caçamba de Carga / Basculante (kg, t, m³)
  | 'RESERVATORIO'   // Reservatório de Água / Óleo / Outros Fluidos (L, m³)
  | 'AGUA_LIMPA'     // Tanque de Água Limpa (L)
  | 'CARGA'          // Capacidade de Carga Operacional / Tração (kg, t)
  | 'OUTRO';         // Capacidade Personalizada

export interface OperationalCapacity {
  id: string;
  type: OperationalCapacityType;
  name: string; // Nome descritivo (ex: 'Tanque de Pulverização', 'Depósito de Adubo')
  value: number; // Valor numérico da capacidade
  unit: string; // Unidade de medida (L, kg, t, m³, sacas, etc.)
  notes?: string; // Observações opcionais (ex: 'Barra 36m', 'Granulado', 'Coroada')
}

export type MaintenanceControlType = 'HORAS' | 'QUILOMETRAGEM' | 'DATA' | 'HORAS_E_DATA' | 'PERSONALIZADO' | 'HORIMETRO';

export interface ScheduledServiceItem {
  id: string;
  name: string; // Ex: 'Troca de Óleo do Motor', 'Filtros de Combustível e Ar', 'Revisão Geral 1000h', 'Lubrificação Geral'
  type: MaintenanceType;
  controlType: MaintenanceControlType;
  intervalHours?: number; // Ex: 300h, 500h, 1000h, 100h
  intervalKm?: number;    // Ex: 10000 km
  intervalMonths?: number; // Ex: 12 meses
  warningAdvanceHours?: number; // Antecedência para alerta (ex: 50h)
  warningAdvanceKm?: number;
  lastServiceDate?: string;
  lastServiceMeter: number; // Horímetro ou Km no momento do último serviço
  nextScheduledMeter: number; // lastServiceMeter + interval
  notes?: string;
}

export interface Vehicle {
  id: string;
  category: EquipmentCategory;
  licensePlate: string; // Placa (para veículos)
  patrimonyCode?: string; // Patrimônio (para tratores e máquinas)
  model: string;
  manufacturer: string;
  year: number;
  color: string;
  sector: Sector;
  fuelType: FuelType;
  tankCapacityLiters: number;
  sprayingTankCapacityLiters?: number; // Capacidade do tanque de pulverização / calda (L) para máquinas agrícolas e tratores
  hasSprayingTank?: boolean;          // Indicador se possui tanque de pulverização
  operationalCapacities?: OperationalCapacity[]; // Lista detalhada de capacidades operacionais da máquina
  currentKm: number;
  currentHourmeter?: number;
  
  // Controle de Manutenção & Troca de Óleo por Horímetro (Padrão 300h) ou KM (Padrão 10.000 km)
  oilChangeControlActive?: boolean; // Se o controle de óleo está ativo (para máquinas, tratores e veículos)
  oilChangeIntervalHours?: number; // Intervalo configurável por horas (padrão tratores: 300h)
  oilChangeIntervalKm?: number;    // Intervalo configurável por km (padrão veículos: 10.000 km)
  oilChangeWarningAdvanceHours?: number; // Antecedência em horas para acionar alerta amarelo (padrão: 50h)
  oilChangeWarningAdvanceKm?: number;    // Antecedência em km para acionar alerta amarelo (padrão: 1.000 km)
  lastOilChangeHourmeter?: number; // Horímetro na última troca de óleo
  lastOilChangeKm?: number;        // KM na última troca de óleo
  lastOilChangeDate?: string;      // Data da última troca de óleo
  nextOilChangeHourmeter?: number; // Próximo limite em horas (última + intervalo)
  nextOilChangeKm?: number;        // Próximo limite em km (última + intervalo)

  // Controle de Manutenção Personalizado por Equipamento
  maintenanceControlType?: MaintenanceControlType; // 'HORAS' | 'QUILOMETRAGEM' | 'DATA' | 'HORAS_E_DATA' | 'PERSONALIZADO'
  maintenanceIntervalHours?: number; // Intervalo configurável por equipamento (ex: 300, 500, 250)
  maintenanceIntervalKm?: number; // Ex: 10000 km
  maintenanceIntervalMonths?: number; // Ex: 12 meses
  maintenanceWarningAdvanceHours?: number; // Antecedência para aviso de manutenção próxima (padrão: 50h)
  maintenanceWarningAdvanceKm?: number;
  lastMaintenanceHourmeter?: number; // Horímetro na última manutenção realizada
  lastMaintenanceKm?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceHourmeter?: number; // Próximo limite individual (última + intervalo)
  nextMaintenanceKm?: number;
  scheduledServices?: ScheduledServiceItem[]; // Lista de manutenções programadas com intervalos próprios

  photoUrl?: string;
  status: 'ATIVO' | 'EM_MANUTENCAO' | 'INATIVO';
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  machineSubtype?: MachineSubtype;
  qrCodeUrl?: string;
  lastFuelingDate?: string;
  nextRevisionKmOrHour?: number;
  documentsExpiration?: string;
  notes?: string;
}

export interface CentralTank {
  id: string; // 'tank-quadra' | 'tank-itapeva'
  name: string; // 'Tanque Central - Quadra' | 'Tanque Central - Itapeva'
  location: string; // 'Sede Quadra' | 'Sede Itapeva'
  capacityLiters: number; // ex: 10000 ou 15000
  currentStockLiters: number; // Saldo base atual calibrado
  minStockAlertLiters: number; // Padrão: 2000 L (configurável)
  fuelType: FuelType; // Padrão: 'DIESEL_S10'
  status: 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
  stockBaseUpdatedAt?: string;
  notes?: string;
}

export type TankMovementType = 'ENTRADA' | 'SAIDA_ABASTECIMENTO' | 'AJUSTE_MANUAL';

export interface TankMovement {
  id: string;
  tankId: string; // 'tank-quadra' | 'tank-itapeva'
  dateTime: string;
  type: TankMovementType;
  liters: number;
  previousStock: number;
  afterStock: number;
  difference?: number; // Diferença (+/- L)
  userId: string;
  userName: string;
  equipmentId?: string;
  equipmentName?: string;
  fuelLogId?: string;
  refillId?: string;
  reason?: string; // Motivo / Justificativa do ajuste manual
  notes?: string;
}

export interface GasStation {
  id: string;
  name: string;
  type: 'INTERNO' | 'EXTERNO';
  supplierName: string;
  cnpj?: string;
  location: string;
  pricePerLiter: Record<FuelType, number>;
  active: boolean;
  tankId?: string; // Vinculação opcional ao Tanque Central ('tank-quadra' | 'tank-itapeva')
}

export type OperationType = 'GRAMA' | 'COLHEITA' | 'PLANTIO' | 'TRANSPORTE' | 'CANA' | 'OUTROS';

export type ActivityType =
  // Grama
  | 'CORTE'
  | 'ROCADA'
  | 'APLICACAO'
  | 'COLETA_PALHA'
  // Colheita
  | 'COLHEITA'
  | 'CARREGAMENTO'
  | 'TRANSBORDO'
  // Plantio
  | 'PLANTIO'
  | 'PREPARO_SOLO'
  | 'SULCACAO'
  | 'ADUBACAO'
  // Transporte
  | 'TRANSPORTE_CANA'
  | 'TRANSPORTE_INSUMOS'
  | 'TRANSPORTE_MAQUINAS'
  | 'TRANSPORTE_MATERIAIS'
  // Cana
  | 'CORTE_CANA'
  | 'ADUBACAO_CANA'
  | 'CARREGAMENTO_CANA'
  | 'ENLEIRAMENTO_PALHA'
  | 'PLANTIO_CANA'
  // Fallbacks
  | 'OUTRAS'
  | 'OUTROS'
  | string;

export interface FuelLog {
  id: string;
  dateTime: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCategory: EquipmentCategory;
  equipmentPlateOrCode: string;
  driverOrOperatorId: string;
  driverOrOperatorName: string;
  attendantId: string;
  attendantName: string;
  gasStationId: string;
  gasStationName: string;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalValue: number;
  operationType?: OperationType;
  activityType?: ActivityType;
  kmAtFueling?: number;
  hourmeterAtFueling?: number;
  previousKmOrHour?: number;
  calculatedAverageKmPerLiter?: number; // km/L
  calculatedAverageLitersPerHour?: number; // L/h
  costPerKm?: number; // R$/km
  costPerHour?: number; // R$/h
  estimatedAutonomyKmOrHours?: number; // Autonomia estimada
  dashboardPhotoUrl?: string;
  invoicePhotoUrl?: string;
  observations?: string;
  flaggedSuspicious?: boolean;
  suspiciousReason?: string;
  isAuthorizedCorrection?: boolean;
  correctionReason?: string;
  previousHourmeterAtCorrection?: number;
  createdAt: string;
  createdById: string;
  createdByName: string;
  updatedAt?: string;
}

export type MaintenanceType = 'REVISAO' | 'TROCA_OLEO' | 'TROCA_FILTROS' | 'PNEUS' | 'PECAS' | 'SERVICO_CORRETIVO' | 'OUTROS';

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentPlateOrCode: string;
  date: string;
  dateTime?: string;
  createdAt?: string;
  type: MaintenanceType;
  title: string;
  description: string;
  kmOrHourAtService: number;
  nextServiceKmOrHour?: number;
  cost: number;
  supplierOrWorkshop: string;
  performedBy: string;
  status: 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
  attachments?: string[];
  notes?: string;
  // Detalhes Específicos da Troca de Óleo
  oilType?: string; // ex: '15W40 Mineral', '15W40 Semi-Sintético', '10W40'
  oilQuantityLiters?: number; // ex: 24 Litros
  filtersReplaced?: string; // ex: 'Filtro Lubrificante Motor, Filtro Combustível Separador'
  intervalHoursApplied?: number; // ex: 300h
}

export type AlertType = 'SUSPICIOUS_FUEL' | 'MAINTENANCE_DUE' | 'IDLE_VEHICLE' | 'DOCUMENT_EXPIRING' | 'LOW_TANK_LEVEL' | 'OIL_CHANGE_DUE' | 'PREVENTIVE_MAINTENANCE' | 'MACHINE_ISSUE';

export interface FuelRefill {
  id: string;
  dateTime: string;
  liters: number;
  fuelType: FuelType;
  supplierName: string;
  invoiceNumber?: string;
  costPerLiter?: number;
  totalCost?: number;
  gasStationId?: string; // ID do posto/tanque de destino (ex: stn-001)
  gasStationName?: string;
  registeredByUserId: string;
  registeredByUserName: string;
  notes?: string;
  createdAt?: string;
}

export interface MachineIssue {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentPlateOrCode: string;
  reportedByUserId: string;
  reportedByUserName: string;
  description: string;
  photoUrl?: string;
  photoUrls?: string[];
  photoStoragePaths?: string[];
  dateTime: string;
  status: 'ABERTO' | 'EM_ANALISE' | 'RESOLVIDO';
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export type PreventiveItemKey = 
  | 'TROCA_OLEO_MOTOR' 
  | 'FILTRO_OLEO' 
  | 'FILTRO_COMBUSTIVEL' 
  | 'FILTRO_AR' 
  | 'LUBRIFICACAO' 
  | 'REVISAO_GERAL' 
  | 'PNEUS_ESTEIRAS';

export interface PreventiveMaintenanceItem {
  id: string;
  equipmentId: string;
  itemKey: PreventiveItemKey;
  itemName: string;
  lastServiceDate: string;
  lastServiceHourmeter: number;
  nextScheduledHourmeter: number;
  intervalHours: number;
  notes?: string;
}

export interface SmartAlert {
  id: string;
  type: AlertType;
  severity: 'BAIXA' | 'MEDIA' | 'ALTA';
  title: string;
  description: string;
  equipmentId?: string;
  equipmentName?: string;
  fuelLogId?: string;
  date: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  cycleTargetHourmeter?: number;
  lastOilChangeHourmeter?: number;
  cycleTargetKm?: number;
  lastOilChangeKm?: number;
  cycleId?: string;
  pushNotified?: boolean;
  pushNotifiedForCycle?: number;
  pushNotifiedAt?: string;
  issueId?: string;
  photoUrl?: string;
  photoUrls?: string[];
  operatorName?: string;
}

export interface AuditLog {
  id: string;
  dateTime: string;
  userId: string;
  userName: string;
  action: 'CRIAR' | 'EDITAR' | 'EXCLUIR' | 'EXPORTAR' | 'LOGIN' | 'LOGOUT' | 'CONFIGURACAO';
  entity: string;
  details: string;
  ipAddress?: string;
}

export interface SystemSettings {
  companyName: string;
  slogan: string;
  cnpj: string;
  address: string;
  phone: string;
  contactEmail: string;
  employeeEditTimeLimitHours: number; // Ex: 24 horas para edicao recente
  suspiciousFuelMarginPercentage: number; // Ex: 25% acima da media
  autoAlertsEnabled: boolean;
  themeMode: 'LIGHT' | 'DARK' | 'SYSTEM';
  tankCapacityLiters: number; // Capacidade total do tanque principal (ex: 20000)
  tankInitialStockLiters?: number; // Saldo base atual configurado (ex: 15000)
  tankStockBaseUpdatedAt?: string; // Data e hora da última calibração manual de estoque
  quickAccessUserIds?: string[]; // IDs dos usuários exibidos nos Atalhos de Acesso Rápido na tela de login
}

export interface ReportFilter {
  startDate: string;
  endDate: string;
  equipmentId?: string;
  category?: string;
  sector?: Sector;
  staffId?: string;
  gasStationId?: string;
  fuelType?: FuelType;
  operationType?: OperationType;
  activityType?: ActivityType;
}

export interface UserDevice {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  token?: string;
  endpoint?: string;
  subscription?: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    isPWA?: boolean;
    isMobile?: boolean;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PushEventType = 'NEW_ISSUE' | 'NEW_MAINTENANCE' | 'OIL_CHANGE_DUE' | 'TEST' | AlertType;

export interface PushNotificationPayload {
  eventType: PushEventType | string;
  eventId: string;
  equipmentName?: string;
  description: string;
  equipmentId?: string;
  customTitle?: string;
  url?: string;
  photoUrl?: string;
  image?: string;
  issueId?: string;
  reportedByUserId?: string;
  reportedByUserName?: string;
  action?: string;
}

