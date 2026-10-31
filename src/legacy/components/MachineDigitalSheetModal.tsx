import React, { useState, useMemo, useEffect } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { 
  X, Truck, Fuel, Wrench, AlertTriangle, CheckCircle2, Clock, 
  Calendar, FileText, User as UserIcon, BarChart3, Shield, Filter, 
  PlusCircle, RefreshCw, AlertCircle, Camera, Check, ChevronRight, ChevronLeft,
  TrendingUp, Award, Layers, Sparkles, Edit, Trash2, Info, DollarSign,
  Plus, CheckSquare, ArrowLeft, Droplet
} from 'lucide-react';
import { 
  Vehicle, FuelLog, MaintenanceLog, MachineIssue, 
  PreventiveMaintenanceItem, PreventiveItemKey, User, MaintenanceType, canEditSystemData,
  SmartAlert
} from '../types';
import { 
  formatCurrency, getFuelTypeName, getSectorName, 
  formatDateBR, formatDateTimeBR, getTodayDateSaoPaulo, createTimestampForDateSaoPaulo, getNowSaoPauloISO 
} from '../utils/calculations';
import { getConsolidatedCapacities, getCapacityTypeEmoji, getMachineSubtypeName } from '../utils/capacities';
import { calculateOilChangeStatus, isOilMaintenanceService } from '../utils/maintenanceCalculations';
import { recordOilChange, setOilChangeConfigAndReference, getVehicles } from '../utils/storage';
import { ReportProblemModal } from './ReportProblemModal';

interface MachineDigitalSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  machineIssues: MachineIssue[];
  preventiveItems: PreventiveMaintenanceItem[];
  alerts?: SmartAlert[];
  currentUser: User;
  onOpenFuelingModalWithEquipment?: (equipmentId: string) => void;
  onAddMaintenance?: (log: Omit<MaintenanceLog, 'id'>) => void;
  onUpdateMaintenance?: (id: string, fields: Partial<MaintenanceLog>) => void;
  onDeleteMaintenance?: (id: string) => void;
  onReportProblemSubmit: (issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'>) => void;
  onRecordPreventiveService: (equipmentId: string, itemKey: PreventiveItemKey, currentHourmeter: number, notes?: string) => void;
  onResolveIssue?: (issueId: string) => void;
  onUpdateVehicleStatus?: (vehicleId: string, newStatus: 'ATIVO' | 'EM_MANUTENCAO' | 'INATIVO') => void;
  initialTab?: 'PREVENTIVE' | 'HISTORY' | 'TIMELINE' | 'OVERVIEW' | 'ISSUES';
  initialIssueId?: string;
  initialAction?: string;
  darkMode?: boolean;
}

interface MachineDigitalSheetInnerProps extends Omit<MachineDigitalSheetModalProps, 'vehicle'> {
  vehicle: Vehicle;
}

const MachineDigitalSheetInner: React.FC<MachineDigitalSheetInnerProps> = ({
  isOpen,
  onClose,
  vehicle,
  vehicles = [],
  fuelLogs = [],
  maintenanceLogs = [],
  machineIssues = [],
  preventiveItems = [],
  alerts = [],
  currentUser,
  onOpenFuelingModalWithEquipment,
  onAddMaintenance,
  onUpdateMaintenance,
  onDeleteMaintenance,
  onReportProblemSubmit,
  onRecordPreventiveService,
  onResolveIssue,
  onUpdateVehicleStatus,
  initialTab = 'HISTORY',
  initialIssueId,
  initialAction,
  darkMode = true
}) => {
  const canEdit = canEditSystemData(currentUser?.role);
  const canManageTimeline = currentUser?.role === 'MANUTENCAO';

  const [activeTab, setActiveTab] = useState<'PREVENTIVE' | 'HISTORY' | 'TIMELINE' | 'OVERVIEW' | 'ISSUES'>(initialIssueId ? 'ISSUES' : initialTab);
  const [isReportProblemOpen, setIsReportProblemOpen] = useState(false);
  const [selectedIssueForPhotos, setSelectedIssueForPhotos] = useState<MachineIssue | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [issueToConfirmResolve, setIssueToConfirmResolve] = useState<MachineIssue | null>(null);
  const [recordingItem, setRecordingItem] = useState<PreventiveMaintenanceItem | null>(null);
  const [recordHourmeter, setRecordHourmeter] = useState<number>(vehicle.currentHourmeter || vehicle.currentKm || 0);
  const [recordNotes, setRecordNotes] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<{
    id: string;
    title: string;
    desc: string;
    type: 'RED' | 'YELLOW' | 'BLUE';
    isOilAlert?: boolean;
    isIssueAlert?: boolean;
    isPreventiveAlert?: boolean;
    photoUrl?: string;
  } | null>(null);

  // Deep-link direto para a aba de Defeitos e acionamento de resolução quando solicitado
  useEffect(() => {
    if (initialIssueId) {
      setActiveTab('ISSUES');
      const cleanId = initialIssueId.startsWith('issue-') ? initialIssueId.slice(6) : initialIssueId;
      const target = machineIssues.find(i => i.id === cleanId || i.id === initialIssueId);
      if (target && initialAction === 'resolve' && target.status === 'ABERTO') {
        setIssueToConfirmResolve(target);
      }
    }
  }, [initialIssueId, initialAction, machineIssues]);

  // Synchronize internal form values whenever the active vehicle changes
  useEffect(() => {
    setRecordHourmeter(vehicle.currentHourmeter || vehicle.currentKm || 0);
    setOilConfigActive(vehicle.oilChangeControlActive !== false);
    const isKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
    setDirectOilHourmeter(isKm ? (vehicle.currentKm || 0) : (vehicle.currentHourmeter || 0));
    setMntMeter(vehicle.currentHourmeter || vehicle.currentKm || 0);
    setSelectedAlertDetail(null);
  }, [vehicle.id]);

  // Oil Change Direct Registration & Configuration State
  const [isOilConfigOpen, setIsOilConfigOpen] = useState(false);
  const [oilConfigActive, setOilConfigActive] = useState<boolean>(vehicle.oilChangeControlActive !== false);
  const isVehicleKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
  const [oilConfigInterval, setOilConfigInterval] = useState<number | string>(
    isVehicleKm 
      ? (vehicle.oilChangeIntervalKm || vehicle.maintenanceIntervalKm || 10000)
      : (vehicle.oilChangeIntervalHours || vehicle.maintenanceIntervalHours || 300)
  );
  const [oilConfigAdvance, setOilConfigAdvance] = useState<number | string>(
    isVehicleKm
      ? (vehicle.oilChangeWarningAdvanceKm !== undefined ? vehicle.oilChangeWarningAdvanceKm : (vehicle.maintenanceWarningAdvanceKm || 1000))
      : (vehicle.oilChangeWarningAdvanceHours !== undefined ? vehicle.oilChangeWarningAdvanceHours : (vehicle.maintenanceWarningAdvanceHours || 50))
  );
  const [oilConfigRefHourmeter, setOilConfigRefHourmeter] = useState<number | string>(
    isVehicleKm
      ? (vehicle.lastOilChangeKm !== undefined ? vehicle.lastOilChangeKm : (vehicle.currentKm || 0))
      : (vehicle.lastOilChangeHourmeter !== undefined ? vehicle.lastOilChangeHourmeter : (vehicle.currentHourmeter || 0))
  );
  const [isSavingOilConfig, setIsSavingOilConfig] = useState(false);

  const [isDirectOilChangeOpen, setIsDirectOilChangeOpen] = useState(false);
  const [directOilHourmeter, setDirectOilHourmeter] = useState<number>(vehicle.currentHourmeter || 0);
  const [directOilDate, setDirectOilDate] = useState<string>(() => getTodayDateSaoPaulo());
  const [directOilType, setDirectOilType] = useState<string>('15W40 Mineral');
  const [directOilLiters, setDirectOilLiters] = useState<number>(20);
  const [directOilFilters, setDirectOilFilters] = useState<string>('Filtro de Óleo Lubrificante + Filtro de Combustível');
  const [directOilCost, setDirectOilCost] = useState<number>(0);
  const [directOilPerformedBy, setDirectOilPerformedBy] = useState<string>(currentUser?.name || '');
  const [directOilSupplier, setDirectOilSupplier] = useState<string>('Oficina Interna AndradeAgro');
  const [directOilNotes, setDirectOilNotes] = useState<string>('');
  const [isSavingDirectOil, setIsSavingDirectOil] = useState(false);

  // Form State for Adding / Editing Maintenance Log
  const [isMntFormOpen, setIsMntFormOpen] = useState(false);
  const [editingMntId, setEditingMntId] = useState<string | null>(null);
  const [mntType, setMntType] = useState<MaintenanceType>('TROCA_OLEO');
  const [mntTitle, setMntTitle] = useState('');
  const [mntDate, setMntDate] = useState(() => getTodayDateSaoPaulo());
  const [mntMeter, setMntMeter] = useState<number>(vehicle.currentHourmeter || vehicle.currentKm || 0);
  const [mntDesc, setMntDesc] = useState('');
  const [mntPerformedBy, setMntPerformedBy] = useState(currentUser?.name || '');
  const [mntSupplier, setMntSupplier] = useState('Oficina Interna AndradeAgro');
  const [mntCost, setMntCost] = useState<number>(0);
  const [mntNotes, setMntNotes] = useState('');

  // Machine Specific Data Filters
  const machineFuelLogs = useMemo(() => {
    return fuelLogs
      .filter(f => f.equipmentId === vehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [fuelLogs, vehicle.id]);

  const machineMaintenanceLogs = useMemo(() => {
    return maintenanceLogs
      .filter(m => m.equipmentId === vehicle.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceLogs, vehicle.id]);

  const oilChangeLogs = useMemo(() => {
    return machineMaintenanceLogs.filter(m => 
      m.type === 'TROCA_OLEO' || 
      m.type === 'TROCA_FILTROS' || 
      m.title.toLowerCase().includes('óleo') || 
      m.title.toLowerCase().includes('oleo') || 
      m.title.toLowerCase().includes('filtro')
    );
  }, [machineMaintenanceLogs]);

  const machineReportedIssues = useMemo(() => {
    return machineIssues
      .filter(i => i.equipmentId === vehicle.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [machineIssues, vehicle.id]);

  const machinePreventiveItems = useMemo(() => {
    return preventiveItems.filter(p => p.equipmentId === vehicle.id);
  }, [preventiveItems, vehicle.id]);

  // Monthly KPIs & Accumulated Costs
  const currentMonth = getTodayDateSaoPaulo().slice(0, 7); // YYYY-MM
  const monthFuelLogs = useMemo(() => {
    return machineFuelLogs.filter(f => f.dateTime.startsWith(currentMonth));
  }, [machineFuelLogs, currentMonth]);

  const { litersConsumedMonth, totalSpentMonth } = useMemo(() => {
    let liters = 0;
    let spent = 0;
    for (let i = 0; i < monthFuelLogs.length; i++) {
      liters += monthFuelLogs[i].liters || 0;
      spent += monthFuelLogs[i].totalValue || 0;
    }
    return { litersConsumedMonth: liters, totalSpentMonth: spent };
  }, [monthFuelLogs]);

  const accumulatedFuelCost = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < machineFuelLogs.length; i++) {
      sum += machineFuelLogs[i].totalValue || 0;
    }
    return sum;
  }, [machineFuelLogs]);

  const accumulatedMaintenanceCost = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < machineMaintenanceLogs.length; i++) {
      sum += machineMaintenanceLogs[i].cost || 0;
    }
    return sum;
  }, [machineMaintenanceLogs]);

  const totalAccumulatedCost = accumulatedFuelCost + accumulatedMaintenanceCost;

  const averageConsumption = useMemo(() => {
    if (machineFuelLogs.length === 0) return 0;
    const isKm = vehicle.category === 'VEICULO';
    if (isKm) {
      const logsWithAvg = machineFuelLogs.filter(l => l.calculatedAverageKmPerLiter && l.calculatedAverageKmPerLiter > 0);
      if (logsWithAvg.length === 0) return 3.2;
      return logsWithAvg.reduce((sum, l) => sum + (l.calculatedAverageKmPerLiter || 0), 0) / logsWithAvg.length;
    } else {
      const logsWithAvg = machineFuelLogs.filter(l => l.calculatedAverageLitersPerHour && l.calculatedAverageLitersPerHour > 0);
      if (logsWithAvg.length === 0) return 18.5;
      return logsWithAvg.reduce((sum, l) => sum + (l.calculatedAverageLitersPerHour || 0), 0) / logsWithAvg.length;
    }
  }, [machineFuelLogs, vehicle.category]);

  const lastFueling = machineFuelLogs[0] || null;
  const lastMaintenance = machineMaintenanceLogs[0] || null;

  // Chart Data for Recharts
  const fuelChartData = useMemo(() => {
    return [...machineFuelLogs]
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
      .slice(-10)
      .map(f => ({
        date: formatDateBR(f.dateTime).slice(0, 5),
        litros: f.liters,
        horimetro: f.hourmeterAtFueling || (f as any).odometerAtFueling || 0,
        custo: f.totalValue
      }));
  }, [machineFuelLogs]);

  const maintenanceChartData = useMemo(() => {
    return [...machineMaintenanceLogs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10)
      .map(m => ({
        date: formatDateBR(m.date).slice(0, 5),
        custo: m.cost,
        horimetro: m.kmOrHourAtService,
        title: m.title
      }));
  }, [machineMaintenanceLogs]);

  // Preventive Maintenance Status Analyzer
  const currentMeter = vehicle.currentHourmeter || vehicle.currentKm || 0;

  const getPreventiveStatus = (item: PreventiveMaintenanceItem) => {
    // If this item is motor oil and vehicle has active oil tracking, synchronize with official calculateOilChangeStatus
    const isOil = item.itemKey === 'TROCA_OLEO_MOTOR' || item.itemKey === 'FILTRO_OLEO' || item.itemName?.toLowerCase().includes('óleo do motor') || item.itemName?.toLowerCase().includes('oleo do motor');
    if (isOil && vehicle.oilChangeControlActive !== false && vehicle.category !== 'IMPLEMENTO') {
      const oilStatus = calculateOilChangeStatus(vehicle);
      if (oilStatus.status === 'ATRASADA') {
        return { status: 'RED', label: 'Vencida 🔴', color: 'bg-red-600 text-white', hoursRemaining: -oilStatus.hoursOrKmOverdue };
      }
      if (oilStatus.status === 'PROXIMA') {
        return { status: 'YELLOW', label: 'Próxima 🟡', color: 'bg-amber-500 text-slate-950', hoursRemaining: oilStatus.remaining };
      }
      return { status: 'GREEN', label: 'Em dia 🟢', color: 'bg-emerald-600 text-white', hoursRemaining: oilStatus.remaining };
    }

    const hoursRemaining = item.nextScheduledHourmeter - currentMeter;
    if (hoursRemaining <= 0) {
      return { status: 'RED', label: 'Atrasada 🔴', color: 'bg-red-600 text-white', hoursRemaining };
    }
    if (hoursRemaining <= 50) {
      return { status: 'YELLOW', label: 'Próxima 🟡', color: 'bg-amber-500 text-slate-950', hoursRemaining };
    }
    return { status: 'GREEN', label: 'Em dia 🟢', color: 'bg-emerald-600 text-white', hoursRemaining };
  };

  // Open issues strictly for THIS vehicle, excluding any residual issue about oil change if oil is in day
  const openIssues = useMemo(() => {
    const oilStatus = calculateOilChangeStatus(vehicle);
    return machineReportedIssues.filter(i => {
      if (i.status !== 'ABERTO') return false;
      const isOil = i.description.toLowerCase().includes('troca de óleo') ||
                    i.description.toLowerCase().includes('troca de oleo') ||
                    i.description.toLowerCase().includes('óleo do motor') ||
                    i.description.toLowerCase().includes('oleo do motor') ||
                    i.description.toLowerCase().includes('óleo vencid') ||
                    i.description.toLowerCase().includes('oleo vencid');
      // If oil is in day, do not treat resolved oil change as a pending issue
      if (isOil && oilStatus.status === 'EM_DIA') {
        return false;
      }
      return true;
    });
  }, [machineReportedIssues, vehicle]);

  // Machine Alerts List - strictly filtered and scoped to this vehicle.id
  const machineAlerts = useMemo(() => {
    const list: {
      id: string;
      title: string;
      desc: string;
      type: 'RED' | 'YELLOW' | 'BLUE';
      isOilAlert?: boolean;
      isIssueAlert?: boolean;
      isPreventiveAlert?: boolean;
      photoUrl?: string;
    }[] = [];

    // 1. Check real-time oil change status directly for this vehicle
    const oilStatus = calculateOilChangeStatus(vehicle);
    const unitWord = oilStatus.unit === 'km' ? 'quilômetros' : 'horas';

    if (oilStatus.isOilActive) {
      if (oilStatus.status === 'ATRASADA') {
        list.push({
          id: `oil-alert-${vehicle.id}`,
          title: `🔴 Troca de óleo vencida: ${vehicle.model}`,
          desc: `Veículo: ${vehicle.model} (${vehicle.patrimonyCode || vehicle.licensePlate || 'Frota'}). Vencida há ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')} ${unitWord}. Troca prevista para ${oilStatus.nextMeter.toLocaleString('pt-BR')} ${oilStatus.unit}.`,
          type: 'RED',
          isOilAlert: true
        });
      } else if (oilStatus.status === 'PROXIMA') {
        list.push({
          id: `oil-alert-${vehicle.id}`,
          title: `🟡 Troca de óleo próxima: ${vehicle.model}`,
          desc: `Veículo: ${vehicle.model} (${vehicle.patrimonyCode || vehicle.licensePlate || 'Frota'}). Faltam ${oilStatus.remaining.toLocaleString('pt-BR')} ${unitWord} para a troca de óleo (prevista para ${oilStatus.nextMeter.toLocaleString('pt-BR')} ${oilStatus.unit}).`,
          type: 'YELLOW',
          isOilAlert: true
        });
      }
    }

    // 2. Direct Smart Alerts - MUST STRICTLY MATCH alert.equipmentId === vehicle.id
    if (alerts && alerts.length > 0) {
      const vehicleSpecificAlerts = alerts.filter(a => 
        !a.resolved && 
        a.equipmentId === vehicle.id
      );

      vehicleSpecificAlerts.forEach(alt => {
        // Se for alerta de MACHINE_ISSUE, não duplicar: os defeitos em aberto são apresentados de forma rica e unificada abaixo
        if (alt.type === 'MACHINE_ISSUE' || alt.id.startsWith('alt-iss-')) {
          return;
        }

        const isOilType = alt.type === 'OIL_CHANGE_DUE' || 
                          (alt.title && (alt.title.toLowerCase().includes('óleo') || alt.title.toLowerCase().includes('oleo')));
        // If it's an oil alert and vehicle oil is already in day, ignore stale/residual alert
        if (isOilType && oilStatus.status === 'EM_DIA') {
          return;
        }
        // If we already added the calculated oil alert, don't duplicate
        if (isOilType && list.some(l => l.isOilAlert)) {
          return;
        }

        const isOilOverdue = oilStatus.status === 'ATRASADA';
        list.push({
          id: alt.id,
          title: isOilType
            ? (isOilOverdue ? `🔴 Troca de óleo vencida: ${vehicle.model}` : `🟡 Troca de óleo próxima: ${vehicle.model}`)
            : alt.title,
          desc: alt.description,
          type: isOilType ? (isOilOverdue ? 'RED' : 'YELLOW') : (alt.severity === 'ALTA' ? 'RED' : 'YELLOW'),
          isOilAlert: Boolean(isOilType)
        });
      });
    }

    // 3. Overdue or upcoming preventive maintenance items strictly for THIS vehicle
    machinePreventiveItems.forEach(item => {
      const isMotorOilItem = item.itemKey === 'TROCA_OLEO_MOTOR' || item.itemKey === 'FILTRO_OLEO' || item.itemName?.toLowerCase().includes('óleo do motor') || item.itemName?.toLowerCase().includes('oleo do motor');
      
      // If this preventive item is motor oil and vehicle tracks oil via oilStatus, do not conflict with oilStatus
      if (isMotorOilItem && oilStatus.isOilActive) {
        if (oilStatus.status === 'EM_DIA') return;
        if (list.some(l => l.isOilAlert)) return; // Already represented above
        
        if (oilStatus.status === 'PROXIMA') {
          list.push({
            id: `prev-${item.id}`,
            title: `🟡 Troca de óleo próxima: ${item.itemName}`,
            desc: `Faltam ${oilStatus.remaining.toLocaleString('pt-BR')} ${unitWord} para a troca de óleo (${oilStatus.nextMeter.toLocaleString('pt-BR')}${oilStatus.unit}).`,
            type: 'YELLOW',
            isPreventiveAlert: true,
            isOilAlert: true
          });
          return;
        }
      }

      const st = getPreventiveStatus(item);
      if (st.status === 'RED') {
        list.push({
          id: `prev-${item.id}`,
          title: `⚠️ Manutenção Atrasada: ${item.itemName}`,
          desc: `Ultrapassou o horímetro previsto (${item.nextScheduledHourmeter}h) em ${Math.abs(st.hoursRemaining)} horas!`,
          type: 'RED',
          isPreventiveAlert: true
        });
      } else if (st.status === 'YELLOW') {
        list.push({
          id: `prev-${item.id}`,
          title: `⏰ Manutenção Próxima: ${item.itemName}`,
          desc: `Faltam apenas ${st.hoursRemaining} horas para atingir o limite de ${item.nextScheduledHourmeter}h.`,
          type: 'YELLOW',
          isPreventiveAlert: true
        });
      }
    });

    // 4. Defeitos relatados estritamente para ESTA máquina (Unificado com foto e sem duplicidade de alertas)
    if (openIssues.length === 1) {
      const singleIssue = openIssues[0];
      const photo = singleIssue.photoUrls?.[0] || singleIssue.photoUrl;
      list.push({
        id: `issue-${singleIssue.id}`,
        title: `⚠️ Defeito Relatado: ${vehicle.model}`,
        desc: `Operador ${singleIssue.reportedByUserName} relatou: "${singleIssue.description}" • ${formatDateBR(singleIssue.dateTime)}`,
        type: 'RED',
        isIssueAlert: true,
        photoUrl: photo
      });
    } else if (openIssues.length > 1) {
      const firstWithPhoto = openIssues.find(i => (i.photoUrls && i.photoUrls.length > 0) || i.photoUrl);
      const photo = firstWithPhoto?.photoUrls?.[0] || firstWithPhoto?.photoUrl;
      list.push({
        id: `issues-${vehicle.id}`,
        title: `🚨 ${openIssues.length} Defeitos Relatados: ${vehicle.model}`,
        desc: openIssues.map(i => `${i.reportedByUserName}: "${i.description}"`).join(' • '),
        type: 'RED',
        isIssueAlert: true,
        photoUrl: photo
      });
    }

    if (vehicle.status === 'EM_MANUTENCAO') {
      list.push({
        id: `status-${vehicle.id}`,
        title: `🛠️ Equipamento em Manutenção`,
        desc: `Esta máquina (${vehicle.model}) está atualmente sinalizada como em manutenção preventiva/corretiva.`,
        type: 'YELLOW'
      });
    }

    return list;
  }, [machinePreventiveItems, openIssues, vehicle, currentMeter, alerts]);

  // Combined timeline of events
  const combinedTimeline = useMemo(() => {
    const events: {
      id: string;
      date: string;
      type: 'FUEL' | 'MAINTENANCE' | 'ISSUE' | 'STATUS';
      title: string;
      description: string;
      user: string;
      value?: string;
      photoUrl?: string;
      rawObj: any;
    }[] = [];

    machineFuelLogs.forEach(f => {
      events.push({
        id: `f-${f.id}`,
        date: f.dateTime,
        type: 'FUEL',
        title: `Abastecimento (${f.liters}L)`,
        description: `Posto: ${f.gasStationName} • Horímetro/KM: ${f.hourmeterAtFueling || f.kmAtFueling || 'N/I'}`,
        user: f.driverOrOperatorName,
        value: undefined,
        photoUrl: f.dashboardPhotoUrl,
        rawObj: f
      });
    });

    machineMaintenanceLogs.forEach(m => {
      const eventDate = m.dateTime || (m as any).createdAt || m.date;
      events.push({
        id: `m-${m.id}`,
        date: eventDate,
        type: 'MAINTENANCE',
        title: `Manutenção: ${m.title}`,
        description: `Horímetro/KM: ${m.kmOrHourAtService}h • Serv: ${m.description} (${m.supplierOrWorkshop})`,
        user: m.performedBy || 'Técnico',
        value: (canEdit && m.cost > 0) ? formatCurrency(m.cost) : undefined,
        rawObj: m
      });
    });

    machineReportedIssues.forEach(i => {
      events.push({
        id: `i-${i.id}`,
        date: i.dateTime,
        type: 'ISSUE',
        title: `Problema: ${i.status === 'RESOLVIDO' ? 'RESOLVIDO' : 'ABERTO'}`,
        description: `"${i.description}"`,
        user: i.reportedByUserName,
        photoUrl: i.photoUrl,
        rawObj: i
      });
    });

    return events.sort((a, b) => {
      const parseTime = (str: string) => {
        if (!str) return 0;
        const trimmed = str.trim();
        // Se for data pura YYYY-MM-DD, trata ao meio-dia para ordenação estável
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          const [y, m, d] = trimmed.split('-').map(Number);
          return new Date(y, m - 1, d, 12, 0, 0).getTime();
        }
        // Se for string ISO sem offset (ex: 2026-09-07T14:30), adiciona o fuso de Brasília -03:00
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
          const t = new Date(`${trimmed}-03:00`).getTime();
          if (!isNaN(t)) return t;
        }
        const t = new Date(trimmed).getTime();
        return isNaN(t) ? 0 : t;
      };
      return parseTime(b.date) - parseTime(a.date);
    });
  }, [machineFuelLogs, machineMaintenanceLogs, machineReportedIssues]);

  // Preventive service submit
  const handleRecordSubmit = () => {
    if (!recordingItem) return;
    onRecordPreventiveService(vehicle.id, recordingItem.itemKey, recordHourmeter, recordNotes);
    setActionSuccessMsg(`Serviço de ${recordingItem.itemName} registrado no horímetro ${recordHourmeter}h!`);
    setRecordingItem(null);
    setRecordNotes('');
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Save Oil Change Configuration & Reference Hourmeter / Km
  const handleSaveOilConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingOilConfig(true);
    try {
      const isVehicleKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
      const intervalVal = Math.max(1, Number(oilConfigInterval) || (isVehicleKm ? 10000 : 300));
      const advanceVal = Math.max(0, Number(oilConfigAdvance) || (isVehicleKm ? 1000 : 50));
      const refVal = Math.max(0, Number(oilConfigRefHourmeter) || 0);

      await setOilChangeConfigAndReference(vehicle.id, {
        active: oilConfigActive,
        intervalHours: !isVehicleKm ? intervalVal : undefined,
        intervalKm: isVehicleKm ? intervalVal : undefined,
        warningAdvanceHours: !isVehicleKm ? advanceVal : undefined,
        warningAdvanceKm: isVehicleKm ? advanceVal : undefined,
        referenceHourmeter: !isVehicleKm ? refVal : undefined,
        referenceKm: isVehicleKm ? refVal : undefined,
        isKm: isVehicleKm
      });
      setActionSuccessMsg('Configuração de troca de óleo atualizada com sucesso!');
      setIsOilConfigOpen(false);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Erro ao salvar configuração de troca de óleo:', err);
      alert('Erro ao salvar configuração de troca de óleo.');
    } finally {
      setIsSavingOilConfig(false);
    }
  };

  // Save Direct Oil Change
  const handleSaveDirectOilChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDirectOil(true);
    const isVehicleKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
    try {
      await recordOilChange(
        vehicle.id,
        directOilHourmeter,
        directOilDate,
        directOilCost,
        directOilNotes,
        {
          oilType: directOilType,
          oilQuantityLiters: directOilLiters > 0 ? directOilLiters : undefined,
          filtersReplaced: directOilFilters,
          performedBy: directOilPerformedBy || currentUser.name,
          supplierOrWorkshop: directOilSupplier,
          isKm: isVehicleKm
        }
      );
      setActionSuccessMsg(`Troca de óleo registrada com sucesso no ${isVehicleKm ? 'KM' : 'horímetro'} ${directOilHourmeter.toLocaleString('pt-BR')}${isVehicleKm ? ' km' : 'h'}!`);
      setIsDirectOilChangeOpen(false);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Erro ao registrar troca de óleo:', err);
      alert('Erro ao registrar troca de óleo.');
    } finally {
      setIsSavingDirectOil(false);
    }
  };

  // Open form to add new maintenance
  const handleOpenAddMaintenance = () => {
    setEditingMntId(null);
    setMntType('TROCA_OLEO');
    setMntTitle('');
    setMntDate(getTodayDateSaoPaulo());
    setMntMeter(vehicle.currentHourmeter || vehicle.currentKm || 0);
    setMntDesc('');
    setMntPerformedBy(currentUser?.name || '');
    setMntSupplier('Oficina Interna AndradeAgro');
    setMntCost(0);
    setMntNotes('');
    setIsMntFormOpen(true);
  };

  // Open form to edit maintenance (Restrito estritamente ao perfil MANUTENCAO)
  const handleOpenEditMaintenance = (m: MaintenanceLog) => {
    if (!canManageTimeline) {
      alert('Acesso negado: Somente o perfil MANUTENÇÃO possui permissão para editar registros da linha do tempo.');
      return;
    }
    setEditingMntId(m.id);
    setMntType(m.type);
    setMntTitle(m.title);
    setMntDate(m.date);
    setMntMeter(m.kmOrHourAtService);
    setMntDesc(m.description);
    setMntPerformedBy(m.performedBy);
    setMntSupplier(m.supplierOrWorkshop);
    setMntCost(m.cost);
    setMntNotes(m.notes || '');
    setIsMntFormOpen(true);
  };

  // Save Maintenance Form
  const handleSaveMaintenanceForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mntTitle.trim()) {
      alert('Por favor, preencha o título do serviço.');
      return;
    }

    const safeDateTime = createTimestampForDateSaoPaulo(mntDate);

    if (editingMntId) {
      if (!canManageTimeline) {
        alert('Acesso negado: Somente o perfil MANUTENÇÃO possui permissão para alterar registros da linha do tempo.');
        return;
      }
      if (onUpdateMaintenance) {
        onUpdateMaintenance(editingMntId, {
          type: mntType,
          title: mntTitle,
          date: mntDate,
          dateTime: safeDateTime,
          kmOrHourAtService: mntMeter,
          description: mntDesc,
          performedBy: mntPerformedBy,
          supplierOrWorkshop: mntSupplier,
          cost: mntCost,
          notes: mntNotes
        });
        setActionSuccessMsg('Registro de manutenção atualizado com sucesso!');
      }
    } else {
      if (onAddMaintenance) {
        const isKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
        const isOilService = mntType === 'TROCA_OLEO';
        const interval = isKm 
          ? (isOilService ? (Number(vehicle.oilChangeIntervalKm) || Number(vehicle.maintenanceIntervalKm) || 10000) : (Number(vehicle.maintenanceIntervalKm) || 10000))
          : (isOilService ? (Number(vehicle.oilChangeIntervalHours) || Number(vehicle.maintenanceIntervalHours) || 300) : (Number(vehicle.maintenanceIntervalHours) || 300));

        onAddMaintenance({
          equipmentId: vehicle.id,
          equipmentName: `${vehicle.model} (${vehicle.patrimonyCode || vehicle.licensePlate || 'MÁQUINA'})`,
          equipmentPlateOrCode: vehicle.patrimonyCode || vehicle.licensePlate || vehicle.id,
          date: mntDate,
          dateTime: safeDateTime,
          createdAt: getNowSaoPauloISO(),
          type: mntType,
          title: mntTitle,
          description: mntDesc,
          kmOrHourAtService: mntMeter,
          nextServiceKmOrHour: mntMeter + interval,
          cost: Number(mntCost) || 0,
          supplierOrWorkshop: mntSupplier || 'Oficina Interna',
          performedBy: mntPerformedBy || currentUser.name,
          status: 'CONCLUIDO',
          notes: mntNotes
        });
        setActionSuccessMsg('Novo registro de manutenção gravado no histórico!');
      }
    }

    setIsMntFormOpen(false);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleDeleteMnt = (id: string) => {
    if (!canManageTimeline) {
      alert('Acesso negado: Somente o perfil MANUTENÇÃO possui permissão para excluir registros da linha do tempo.');
      return;
    }
    if (confirm('Tem certeza que deseja excluir este registro de manutenção?')) {
      if (onDeleteMaintenance) {
        onDeleteMaintenance(id);
        setActionSuccessMsg('Registro de manutenção removido.');
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      
      {/* Mobile Floating Action Bar for Touch/Small Screens */}
      <div className="fixed top-2 left-2 right-2 z-[100] flex sm:hidden items-center justify-between gap-1.5 bg-[#064E3B] text-white p-2 rounded-2xl shadow-2xl border border-[#FACC15]/40 backdrop-blur-md">
        <button
          onClick={handleDismiss}
          className="px-2.5 py-2 rounded-xl bg-[#FACC15] text-[#064E3B] font-black text-xs flex items-center gap-1 shadow-md active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <span className="text-[11px] font-black text-[#FACC15] truncate max-w-[120px] px-1 text-center">
          {vehicle.model}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {(!vehicle.fuelType || vehicle.fuelType !== 'NENHUM') && (
            <button
              onClick={() => {
                if (onOpenFuelingModalWithEquipment) {
                  onOpenFuelingModalWithEquipment(vehicle.id);
                } else if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('andradeagro:open-fueling', { detail: { vehicleId: vehicle.id } }));
                }
              }}
              className="px-2.5 py-2 rounded-xl bg-[#FACC15] hover:bg-yellow-400 text-[#064E3B] font-black text-xs flex items-center gap-1 shadow-md active:scale-95 border border-amber-300"
              title={`Abastecer ${vehicle.model}`}
            >
              <Fuel className="w-3.5 h-3.5 text-[#064E3B]" />
              <span>Abastecer</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center shadow-md active:scale-95"
            title="Fechar Ficha"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`relative w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col mt-16 sm:mt-0 ${
        darkMode ? 'bg-slate-900 text-slate-100 border border-emerald-900/60' : 'bg-white text-slate-900'
      }`}>

        {/* Top Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-emerald-900/60 bg-[#064E3B] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black shadow-md shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-[#FACC15] block">
                FICHA DIGITAL DA MÁQUINA • TEMPO REAL
              </span>
              <h2 className="text-base sm:text-lg font-black truncate max-w-xs sm:max-w-md">
                {vehicle.model} ({vehicle.patrimonyCode || vehicle.licensePlate || 'MÁQUINA'})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-transform active:scale-95 shrink-0"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              onClick={handleDismiss}
              className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95 shrink-0"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">

          {/* Toast Notification */}
          {actionSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* 1. Identification Header Card */}
          <div className={`p-4 rounded-3xl border space-y-3 ${
            darkMode ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-200 dark:bg-emerald-900 border border-slate-300 dark:border-emerald-700 shrink-0 shadow-sm">
                  {vehicle.photoUrl ? (
                    <img 
                      src={vehicle.photoUrl} 
                      alt={vehicle.model} 
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Truck className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#064E3B] text-[#FACC15]">
                      {vehicle.category}
                    </span>

                    {vehicle.machineSubtype && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-800/80 text-emerald-100 border border-emerald-600/50">
                        {getMachineSubtypeName(vehicle.machineSubtype)}
                      </span>
                    )}

                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      vehicle.status === 'ATIVO' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : vehicle.status === 'EM_MANUTENCAO'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {vehicle.status === 'ATIVO' ? '🟢 ATIVA' : vehicle.status === 'EM_MANUTENCAO' ? '🟡 EM MANUTENÇÃO' : '🔴 PARADA'}
                    </span>

                    {onUpdateVehicleStatus && (
                      <select
                        value={vehicle.status}
                        onChange={(e) => onUpdateVehicleStatus(vehicle.id, e.target.value as any)}
                        className={`text-[10px] font-bold py-0.5 px-1 rounded-md border outline-none cursor-pointer ${
                          darkMode ? 'bg-emerald-900 border-emerald-700 text-white' : 'bg-white border-slate-200'
                        }`}
                      >
                        <option value="ATIVO">Mudar p/ Ativa</option>
                        <option value="EM_MANUTENCAO">Mudar p/ Em Manutenção</option>
                        <option value="INATIVO">Mudar p/ Parada</option>
                      </select>
                    )}
                  </div>

                  <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {vehicle.model}
                  </h1>
                  
                  <p className="text-xs text-slate-500 dark:text-emerald-300 font-medium truncate">
                    {vehicle.manufacturer} • Ano {vehicle.year} • Setor: <strong>{getSectorName(vehicle.sector)}</strong>
                  </p>
                </div>
              </div>

              {/* Action Buttons: The 3 Main Accesses (Abastecimento, Manutenção, Defeito) */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                {/* 1. REGISTRAR ABASTECIMENTO */}
                {(!vehicle.fuelType || vehicle.fuelType !== 'NENHUM') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenFuelingModalWithEquipment) {
                        onOpenFuelingModalWithEquipment(vehicle.id);
                      } else if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('andradeagro:open-fueling', { detail: { vehicleId: vehicle.id } }));
                      }
                    }}
                    className="w-full sm:w-auto min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#FACC15] hover:bg-yellow-400 text-[#064E3B] font-black text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-yellow-500/20 transition-all active:scale-95 border-2 border-amber-300 cursor-pointer"
                    title={`Registrar abastecimento de ${vehicle.model}`}
                  >
                    <Fuel className="w-4 h-4 text-[#064E3B] shrink-0" />
                    <span>REGISTRAR ABASTECIMENTO</span>
                  </button>
                )}

                {/* 2. REGISTRAR MANUTENÇÃO */}
                <button
                  type="button"
                  onClick={handleOpenAddMaintenance}
                  className="w-full sm:w-auto min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 border border-emerald-700/70 cursor-pointer"
                  title={`Registrar manutenção de ${vehicle.model}`}
                >
                  <Wrench className="w-4 h-4 text-[#FACC15] shrink-0" />
                  <span>REGISTRAR MANUTENÇÃO</span>
                </button>

                {/* 3. INFORMAR DEFEITO */}
                <button
                  type="button"
                  onClick={() => setIsReportProblemOpen(true)}
                  className="w-full sm:w-auto min-h-[46px] px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  title={`Informar defeito em ${vehicle.model}`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>INFORMAR DEFEITO</span>
                </button>
              </div>

            </div>

            {/* Spec Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
                <span className="text-[10px] text-slate-500 block">Horímetro / KM Atual:</span>
                <strong className="text-slate-900 dark:text-slate-100 text-sm font-black">
                  {vehicle.category === 'VEICULO' 
                    ? `${vehicle.currentKm.toLocaleString('pt-BR')} km`
                    : `${vehicle.currentHourmeter || 0} Horas`}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
                <span className="text-[10px] text-slate-500 block">Combustível / Tanque:</span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {vehicle.fuelType === 'NENHUM' ? 'Não se aplica' : `${vehicle.tankCapacityLiters}L (${getFuelTypeName(vehicle.fuelType)})`}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
                <span className="text-[10px] text-slate-500 block">Operador Responsável:</span>
                <strong className="text-amber-600 dark:text-amber-400">
                  {vehicle.assignedOperatorName || 'Não atribuído'}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-white dark:bg-emerald-900/60 border">
                <span className="text-[10px] text-slate-500 block">Código Patrimônio:</span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {vehicle.patrimonyCode || vehicle.licensePlate || 'PAT-00'}
                </strong>
              </div>
            </div>

            {/* Quick Oil Status Callout - Sincronizado com a Frota */}
            {(() => {
              const oilStatus = calculateOilChangeStatus(vehicle);
              if (!oilStatus.isOilActive) return null;
              const unitFull = oilStatus.unit === 'km' ? 'quilômetros' : 'horas';

              let statusBg = 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300';
              let statusTitle = 'Em dia';
              let statusText = `Faltam ${oilStatus.remaining.toLocaleString('pt-BR')} ${unitFull} para a próxima troca de óleo`;

              if (oilStatus.status === 'ATRASADA') {
                statusBg = 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300';
                statusTitle = 'Troca de óleo vencida';
                statusText = oilStatus.hoursOrKmOverdue > 0
                  ? `Vencida há ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')} ${unitFull}`
                  : `Limite de troca de óleo atingido (${oilStatus.nextMeter.toLocaleString('pt-BR')} ${oilStatus.unit})`;
              } else if (oilStatus.status === 'PROXIMA') {
                statusBg = 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200';
                statusTitle = 'Troca de óleo próxima';
                statusText = `Faltam ${oilStatus.remaining.toLocaleString('pt-BR')} ${unitFull} para a troca de óleo`;
              }

              return (
                <div className={`p-2.5 px-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${statusBg}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
                      {statusTitle}:
                    </span>
                    <span className="font-extrabold">
                      {statusText}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-90 font-medium sm:text-right shrink-0">
                    Próxima troca aos <strong>{oilStatus.nextMeter.toLocaleString('pt-BR')} {oilStatus.unit}</strong>
                  </div>
                </div>
              );
            })()}

            {/* Capacidades Operacionais Dinâmicas */}
            {(() => {
              const capacities = getConsolidatedCapacities(vehicle);
              if (capacities.length === 0) return null;
              return (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Capacidades & Reservatórios da Máquina:
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {capacities.length} {capacities.length === 1 ? 'capacidade cadastrada' : 'capacidades cadastradas'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {capacities.map((cap, i) => (
                      <div
                        key={cap.id || i}
                        className={`p-2 rounded-xl border text-xs flex flex-col justify-between ${
                          cap.type === 'PULVERIZACAO' 
                            ? 'bg-cyan-50 dark:bg-cyan-950/70 border-cyan-300 dark:border-cyan-800' 
                            : cap.type === 'COMBUSTIVEL'
                              ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800'
                              : 'bg-white dark:bg-emerald-900/60 border-slate-200 dark:border-emerald-800'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-300 font-semibold truncate">
                          <span>{getCapacityTypeEmoji(cap.type)}</span>
                          <span className="truncate">{cap.name}</span>
                        </div>
                        <div className="mt-1">
                          <strong className="text-sm font-black text-slate-900 dark:text-slate-100">
                            {cap.value.toLocaleString('pt-BR')} {cap.unit}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 2. Automated Live Machine Alerts */}
          {machineAlerts.length > 0 && (
            <div className="space-y-2">
              {machineAlerts.map((alt, idx) => (
                <div 
                  key={alt.id || idx}
                  onClick={() => {
                    if (alt.isIssueAlert) {
                      setActiveTab('ISSUES');
                    } else if (alt.isPreventiveAlert) {
                      setActiveTab('PREVENTIVE');
                    } else {
                      setSelectedAlertDetail(alt);
                    }
                  }}
                  className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all shadow-sm ${
                    alt.type === 'RED'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 hover:border-red-500/60 hover:bg-red-500/20'
                      : alt.type === 'YELLOW'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200 hover:border-amber-500/60 hover:bg-amber-500/20'
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200 hover:border-blue-500/60 hover:bg-blue-500/20'
                  }`}
                  role="button"
                  title="Clique para ver detalhes do alerta desta máquina"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <div className="flex-1 min-w-0">
                      <strong className="font-extrabold block text-slate-100">{alt.title}</strong>
                      <span className="text-[11px] opacity-90 block text-slate-200">{alt.desc}</span>
                      {alt.photoUrl && (
                        <div className="mt-2 relative inline-block">
                          <img
                            src={alt.photoUrl}
                            alt="Foto do defeito relatado"
                            className="w-32 h-24 sm:w-44 sm:h-28 object-cover rounded-xl border border-red-500/50 shadow-sm"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold opacity-80 pl-2">
                    <span className="hidden sm:inline">Ver detalhes</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-emerald-900/60 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setActiveTab('PREVENTIVE')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'PREVENTIVE'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <Wrench className="w-4 h-4 text-[#FACC15]" />
              <span>Manutenção Preventiva ({machinePreventiveItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <FileText className="w-4 h-4 text-[#FACC15]" />
              <span>Histórico de Manutenções ({machineMaintenanceLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('TIMELINE')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'TIMELINE'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <Clock className="w-4 h-4 text-[#FACC15]" />
              <span>Linha do Tempo</span>
            </button>

            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'OVERVIEW'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#FACC15]" />
              <span>Indicadores & Custos</span>
            </button>

            <button
              onClick={() => setActiveTab('ISSUES')}
              className={`px-3.5 py-2 rounded-2xl font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'ISSUES'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : 'text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/40'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-[#FACC15]" />
              <span>Problemas ({openIssues.length > 0 ? `${openIssues.length} pendente(s)` : '0 pendentes'})</span>
            </button>
          </div>

          {/* TAB 1: CONTROLE DE MANUTENÇÃO PREVENTIVA */}
          {activeTab === 'PREVENTIVE' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Highlight Banner for Oil Change Control (Synchronized with Fleet/Vehicle Control) */}
                  {(() => {
                    const oilStatus = calculateOilChangeStatus(vehicle);
                    const isOilActive = oilStatus.isOilActive;
                    const curH = oilStatus.currentMeter;
                    const interval = oilStatus.interval;
                    const advance = oilStatus.advance;
                    const lastH = oilStatus.lastMeter;
                    const nextH = oilStatus.nextMeter;
                    const rem = oilStatus.remaining;
                    const hoursInCycle = oilStatus.metersInCycle;
                    const progressPercent = oilStatus.progressPercent;
                    const unit = oilStatus.unit;
                    const unitFull = unit === 'km' ? 'quilômetros' : 'horas';

                    let containerClasses = darkMode 
                      ? 'bg-emerald-950/50 border-emerald-500/30' 
                      : 'bg-emerald-50/40 border-emerald-300';
                    let iconWrapperClass = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
                    let iconFillClass = 'fill-emerald-600 dark:fill-emerald-400';
                    let badgeColor = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                    let badgeLabel = `EM DIA • FALTAM ${rem.toLocaleString('pt-BR')} ${unit.toUpperCase()}`;
                    let barColor = 'bg-emerald-500';

                    if (!isOilActive) {
                      containerClasses = darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200';
                      iconWrapperClass = 'bg-slate-500/20 text-slate-400';
                      iconFillClass = 'fill-slate-400';
                      badgeColor = 'bg-slate-500/20 text-slate-400 border-slate-500/30';
                      badgeLabel = 'CONTROLE DESATIVADO';
                      barColor = 'bg-slate-400';
                    } else if (oilStatus.status === 'ATRASADA') {
                      containerClasses = darkMode ? 'bg-red-950/60 border-red-500/40' : 'bg-red-50/80 border-red-300';
                      iconWrapperClass = 'bg-red-500/20 text-red-500';
                      iconFillClass = 'fill-red-500';
                      badgeColor = 'bg-red-600 text-white font-extrabold animate-pulse shadow-md border-red-700';
                      badgeLabel = `TROCA DE ÓLEO VENCIDA • ATRASO DE ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')} ${unit.toUpperCase()}`;
                      barColor = 'bg-red-500';
                    } else if (oilStatus.status === 'PROXIMA') {
                      containerClasses = darkMode ? 'bg-amber-950/60 border-amber-500/40' : 'bg-amber-50/80 border-amber-300';
                      iconWrapperClass = 'bg-amber-500/20 text-amber-500';
                      iconFillClass = 'fill-amber-500';
                      badgeColor = 'bg-amber-500 text-gray-950 font-extrabold shadow-md border-amber-600';
                      badgeLabel = `TROCA DE ÓLEO PRÓXIMA • FALTAM ${rem.toLocaleString('pt-BR')} ${unit.toUpperCase()}`;
                      barColor = 'bg-amber-500';
                    }

                    return (
                      <div className={`p-4 sm:p-5 rounded-3xl border shadow-sm relative overflow-hidden transition-all ${containerClasses}`}>
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5 border-black/10 dark:border-white/10">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconWrapperClass}`}>
                                <Droplet className={`w-5 h-5 ${iconFillClass}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                                    Controle de Troca de Óleo {unit === 'km' ? 'por Quilometragem' : 'por Horímetro'}
                                  </h3>
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300">
                                    Ciclo {interval.toLocaleString('pt-BR')}{unit}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                  {oilStatus.status === 'ATRASADA'
                                    ? `Atenção: limite de troca atingido (${nextH.toLocaleString('pt-BR')} ${unit}). Troca de óleo vencida há ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')} ${unitFull}.`
                                    : oilStatus.status === 'PROXIMA'
                                      ? `Faltam ${rem.toLocaleString('pt-BR')} ${unitFull} para a troca de óleo programada (meta de ${nextH.toLocaleString('pt-BR')} ${unit}).`
                                      : `Monitoramento preventivo em dia. Próxima troca aos ${nextH.toLocaleString('pt-BR')} ${unit}.`}
                                </p>
                              </div>
                            </div>

                            <span className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wide border self-start sm:self-auto ${badgeColor}`}>
                              {badgeLabel}
                            </span>
                          </div>

                          {/* 4 Metric Cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="p-3 rounded-2xl bg-white/60 dark:bg-black/20 border border-emerald-900/20">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
                                {unit === 'km' ? 'Quilometragem Atual' : 'Horímetro Atual'}
                              </span>
                              <span className="text-base font-black text-slate-900 dark:text-emerald-200">
                                {curH.toLocaleString('pt-BR')} {unit}
                              </span>
                            </div>

                            <div className="p-3 rounded-2xl bg-white/60 dark:bg-black/20 border border-emerald-900/20">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
                                Última Troca / Ref.
                              </span>
                              <span className="text-base font-black text-slate-900 dark:text-emerald-200">
                                {lastH.toLocaleString('pt-BR')} {unit}
                              </span>
                              {oilStatus.lastDate && (
                                <span className="text-[9px] text-slate-400 block mt-0.5">
                                  {formatDateBR(oilStatus.lastDate)}
                                </span>
                              )}
                            </div>

                            <div className="p-3 rounded-2xl bg-white/60 dark:bg-black/20 border border-emerald-900/20">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
                                Intervalo Definido
                              </span>
                              <span className="text-base font-black text-slate-900 dark:text-emerald-200">
                                {interval.toLocaleString('pt-BR')} {unit}
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                Alerta com {advance}{unit}
                              </span>
                            </div>

                            <div className="p-3 rounded-2xl bg-white/60 dark:bg-black/20 border border-emerald-900/20">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
                                Próxima Troca
                              </span>
                              <span className={`text-base font-black ${
                                oilStatus.status === 'ATRASADA' 
                                  ? 'text-red-500 font-extrabold' 
                                  : oilStatus.status === 'PROXIMA' 
                                    ? 'text-amber-500' 
                                    : 'text-emerald-600 dark:text-emerald-300'
                              }`}>
                                {nextH.toLocaleString('pt-BR')} {unit}
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                {oilStatus.status === 'ATRASADA' 
                                  ? `Vencida há ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')}${unit}` 
                                  : `Faltam ${rem.toLocaleString('pt-BR')}${unit}`}
                              </span>
                            </div>
                          </div>

                        {/* Progress Bar of the Current Cycle */}
                        {isOilActive && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-500 dark:text-emerald-300/80">
                                Progresso do ciclo atual: {hoursInCycle.toLocaleString('pt-BR')}{unit} / {interval.toLocaleString('pt-BR')}{unit} trabalhadas
                              </span>
                              <span className="text-slate-700 dark:text-emerald-200">
                                {Math.round(progressPercent)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-black/40 h-2.5 rounded-full overflow-hidden p-0.5 border border-black/10 dark:border-white/10">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${Math.min(100, Math.max(3, progressPercent))}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Action buttons (MANUTENCAO only) */}
                        {canEdit && (
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                const isKm = oilStatus.unit === 'km' || vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
                                setOilConfigActive(vehicle.oilChangeControlActive !== false);
                                setOilConfigInterval(
                                  isKm
                                    ? (vehicle.oilChangeIntervalKm || vehicle.maintenanceIntervalKm || 10000)
                                    : (vehicle.oilChangeIntervalHours || vehicle.maintenanceIntervalHours || 300)
                                );
                                setOilConfigAdvance(
                                  isKm
                                    ? (vehicle.oilChangeWarningAdvanceKm !== undefined ? vehicle.oilChangeWarningAdvanceKm : (vehicle.maintenanceWarningAdvanceKm || 1000))
                                    : (vehicle.oilChangeWarningAdvanceHours !== undefined ? vehicle.oilChangeWarningAdvanceHours : (vehicle.maintenanceWarningAdvanceHours || 50))
                                );
                                setOilConfigRefHourmeter(
                                  isKm
                                    ? (vehicle.lastOilChangeKm !== undefined ? vehicle.lastOilChangeKm : (vehicle.currentKm || 0))
                                    : (vehicle.lastOilChangeHourmeter !== undefined ? vehicle.lastOilChangeHourmeter : (vehicle.currentHourmeter || 0))
                                );
                                setIsOilConfigOpen(true);
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-emerald-900/50 hover:bg-slate-100 dark:hover:bg-emerald-800 text-slate-700 dark:text-emerald-200 border border-emerald-800/30 flex items-center gap-1.5 transition-colors"
                            >
                              <Wrench className="w-3.5 h-3.5 text-amber-500" />
                              <span>Configurar Intervalo & Referência</span>
                            </button>

                            <button
                              onClick={() => {
                                const isKm = oilStatus.unit === 'km' || vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
                                setDirectOilHourmeter(isKm ? (vehicle.currentKm || 0) : (vehicle.currentHourmeter || 0));
                                setDirectOilDate(getTodayDateSaoPaulo());
                                setDirectOilPerformedBy(currentUser?.name || '');
                                setIsDirectOilChangeOpen(true);
                              }}
                              className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-gray-950 flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Registrar Troca de Óleo Realizada</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              {/* Direct Oil Change Modal inside Digital Sheet */}
              {isDirectOilChangeOpen && (
                (() => {
                  const isKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
                  const cycleInterval = isKm
                    ? (Number(vehicle.oilChangeIntervalKm) || Number(vehicle.maintenanceIntervalKm) || 10000)
                    : (Number(vehicle.oilChangeIntervalHours) || Number(vehicle.maintenanceIntervalHours) || 300);
                  const currentUnit = isKm ? 'km' : 'h';
                  const currentOfficial = isKm ? (vehicle.currentKm || 0) : (vehicle.currentHourmeter || 0);

                  return (
                    <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3.5 animate-in fade-in">
                      <div className="flex items-center justify-between border-b pb-2 border-amber-500/30">
                        <h4 className="font-black text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                          <Droplet className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span>Registrar Troca de Óleo - {vehicle.model}</span>
                        </h4>
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                          Ciclo: {cycleInterval.toLocaleString('pt-BR')} {isKm ? 'KM' : 'Horas'}
                        </span>
                      </div>

                      <form onSubmit={handleSaveDirectOilChange} className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                              {isKm ? 'Quilometragem Atual na Troca (km) *' : 'Horímetro Atual no Momento da Troca (h) *'}
                            </label>
                            <input
                              type="number"
                              step={isKm ? '1' : '0.1'}
                              min="0"
                              required
                              value={directOilHourmeter}
                              onChange={(e) => setDirectOilHourmeter(parseFloat(e.target.value) || 0)}
                              className={`w-full p-2.5 rounded-xl border font-black text-sm ${
                                darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                              }`}
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Próxima troca será calculada para: <strong>{(directOilHourmeter + cycleInterval).toLocaleString('pt-BR')} {currentUnit}</strong>
                            </p>
                            {directOilHourmeter < currentOfficial && (
                              <p className="text-[10px] text-amber-500 font-bold mt-1">
                                ⚠️ Atenção: O valor digitado ({directOilHourmeter.toLocaleString('pt-BR')}{currentUnit}) é menor que o valor atual oficial ({currentOfficial.toLocaleString('pt-BR')}{currentUnit}). O medidor oficial do veículo será mantido no maior valor.
                              </p>
                            )}
                          </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                          Data do Serviço *
                        </label>
                        <input
                          type="date"
                          required
                          value={directOilDate}
                          onChange={(e) => setDirectOilDate(e.target.value)}
                          className={`w-full p-2.5 rounded-xl border ${
                            darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                          Tipo de Óleo Utilizado
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 15W40 Mineral, 15W40 Semi-sintético..."
                          value={directOilType}
                          onChange={(e) => setDirectOilType(e.target.value)}
                          className={`w-full p-2 rounded-xl border ${
                            darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                          Quantidade de Óleo (Litros)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Ex: 20"
                          value={directOilLiters}
                          onChange={(e) => setDirectOilLiters(parseFloat(e.target.value) || 0)}
                          className={`w-full p-2 rounded-xl border ${
                            darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                        Filtros Substituídos
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Filtro lubrificante + Filtro de combustível + Filtro de ar..."
                        value={directOilFilters}
                        onChange={(e) => setDirectOilFilters(e.target.value)}
                        className={`w-full p-2 rounded-xl border ${
                          darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                          Mecânico / Responsável
                        </label>
                        <input
                          type="text"
                          value={directOilPerformedBy}
                          onChange={(e) => setDirectOilPerformedBy(e.target.value)}
                          className={`w-full p-2 rounded-xl border ${
                            darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                          Oficina / Fornecedor
                        </label>
                        <input
                          type="text"
                          value={directOilSupplier}
                          onChange={(e) => setDirectOilSupplier(e.target.value)}
                          className={`w-full p-2 rounded-xl border ${
                            darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                          Custo Total (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={directOilCost}
                          onChange={(e) => setDirectOilCost(parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className={`w-full p-2 rounded-xl border ${
                            darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                        Observações Adicionais
                      </label>
                      <textarea
                        rows={2}
                        value={directOilNotes}
                        onChange={(e) => setDirectOilNotes(e.target.value)}
                        placeholder="Ex: Óleo e filtros substituídos conforme especificação do fabricante."
                        className={`w-full p-2 rounded-xl border resize-none ${
                          darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
                      <button
                        type="button"
                        onClick={() => setIsDirectOilChangeOpen(false)}
                        className="px-3.5 py-2 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-emerald-900/40 text-slate-600 dark:text-slate-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingDirectOil}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-black shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isSavingDirectOil ? 'Gravando...' : (isKm ? 'Confirmar e Atualizar KM' : 'Confirmar e Atualizar Horímetro')}
                      </button>
                    </div>
                  </form>
                </div>
              );
            })())}

              {/* Oil Config Modal inside Digital Sheet */}
              {isOilConfigOpen && (() => {
                const isKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
                return (
                  <div className="p-4 sm:p-5 rounded-3xl bg-emerald-900/30 border-2 border-emerald-500/40 space-y-3.5 animate-in fade-in">
                    <div className="flex items-center justify-between border-b pb-2 border-emerald-500/30">
                      <h4 className="font-black text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-emerald-500" />
                        <span>Configuração do Plano de Troca de Óleo {isKm ? '(Quilometragem)' : '(Horímetro)'} - {vehicle.model}</span>
                      </h4>
                    </div>

                    <form onSubmit={handleSaveOilConfig} className="space-y-3 text-xs">
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={oilConfigActive}
                            onChange={(e) => setOilConfigActive(e.target.checked)}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                          />
                          <span className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                            Manter controle automático de troca de óleo ativado para este {isKm ? 'veículo' : 'equipamento'}
                          </span>
                        </label>
                      </div>

                      {oilConfigActive && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {isKm ? (
                            <>
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                                  Intervalo Padrão (Quilômetros - KM) *
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  required
                                  value={oilConfigInterval}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                      setOilConfigInterval('');
                                    } else {
                                      const parsed = parseInt(val, 10);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        setOilConfigInterval(parsed);
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    if (!oilConfigInterval || Number(oilConfigInterval) <= 0) {
                                      setOilConfigInterval(10000);
                                    }
                                  }}
                                  placeholder="Ex: 10000, 15000, 20000, 30000..."
                                  className={`w-full p-2.5 rounded-xl border font-bold text-sm ${
                                    darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                                  }`}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Sem limite máximo: 10.000, 15.000, 20.000, 30.000 km ou mais.
                                </p>
                              </div>

                              <div>
                                <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                                  Aviso Prévio (KM de Antecedência)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={oilConfigAdvance}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                      setOilConfigAdvance('');
                                    } else {
                                      const parsed = parseInt(val, 10);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        setOilConfigAdvance(parsed);
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    if (oilConfigAdvance === '' || isNaN(Number(oilConfigAdvance)) || Number(oilConfigAdvance) < 0) {
                                      setOilConfigAdvance(1000);
                                    }
                                  }}
                                  placeholder="Ex: 1000"
                                  className={`w-full p-2.5 rounded-xl border font-bold ${
                                    darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                                  }`}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Gera alerta amarelo com antecedência</p>
                              </div>

                              <div>
                                <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                                  KM de Referência da Última Troca
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={oilConfigRefHourmeter}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                      setOilConfigRefHourmeter('');
                                    } else {
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        setOilConfigRefHourmeter(parsed);
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    if (oilConfigRefHourmeter === '' || isNaN(Number(oilConfigRefHourmeter)) || Number(oilConfigRefHourmeter) < 0) {
                                      setOilConfigRefHourmeter(0);
                                    }
                                  }}
                                  className={`w-full p-2.5 rounded-xl border font-bold ${
                                    darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                                  }`}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Próxima troca: <strong>{((Number(oilConfigRefHourmeter) || 0) + (Number(oilConfigInterval) || 10000)).toLocaleString('pt-BR')} km</strong>
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                                  Intervalo Padrão (Horas)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={oilConfigInterval}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                      setOilConfigInterval('');
                                    } else {
                                      const parsed = parseInt(val, 10);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        setOilConfigInterval(parsed);
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    if (!oilConfigInterval || Number(oilConfigInterval) <= 0) {
                                      setOilConfigInterval(300);
                                    }
                                  }}
                                  className={`w-full p-2.5 rounded-xl border font-bold ${
                                    darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                                  }`}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Padrão agrícola: 300 horas</p>
                              </div>

                              <div>
                                <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                                  Aviso Prévio (Horas de Antecedência)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={oilConfigAdvance}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                      setOilConfigAdvance('');
                                    } else {
                                      const parsed = parseInt(val, 10);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        setOilConfigAdvance(parsed);
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    if (oilConfigAdvance === '' || isNaN(Number(oilConfigAdvance)) || Number(oilConfigAdvance) < 0) {
                                      setOilConfigAdvance(50);
                                    }
                                  }}
                                  className={`w-full p-2.5 rounded-xl border font-bold ${
                                    darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                                  }`}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Gera alerta amarelo com antecedência</p>
                              </div>

                              <div>
                                <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">
                                  Horímetro de Referência da Última Troca (h)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={oilConfigRefHourmeter}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                      setOilConfigRefHourmeter('');
                                    } else {
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        setOilConfigRefHourmeter(parsed);
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    if (oilConfigRefHourmeter === '' || isNaN(Number(oilConfigRefHourmeter)) || Number(oilConfigRefHourmeter) < 0) {
                                      setOilConfigRefHourmeter(0);
                                    }
                                  }}
                                  className={`w-full p-2.5 rounded-xl border font-bold ${
                                    darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-300'
                                  }`}
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Próxima troca: <strong>{((Number(oilConfigRefHourmeter) || 0) + (Number(oilConfigInterval) || 300)).toLocaleString('pt-BR')}h</strong>
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-500/20">
                        <button
                          type="button"
                          onClick={() => setIsOilConfigOpen(false)}
                          className="px-3.5 py-2 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-emerald-900/40 text-slate-600 dark:text-slate-300"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingOilConfig}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          {isSavingOilConfig ? 'Salvando...' : 'Salvar Configuração'}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    Outros Itens de Manutenção Preventiva da Máquina
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Horímetro / KM Atual: <strong>{currentMeter} {vehicle.category === 'VEICULO' ? 'KM' : 'Horas'}</strong>
                  </p>
                </div>

                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-xl">
                  {machinePreventiveItems.length} Itens Adicionais Monitorados
                </span>
              </div>

              {/* Grid of preventive items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {machinePreventiveItems.map(item => {
                  const st = getPreventiveStatus(item);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border space-y-3 relative overflow-hidden transition-all ${
                        darkMode ? 'bg-emerald-950/50 border-emerald-900' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {item.itemKey.replace('_', ' ')}
                          </span>
                          <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                            {item.itemName}
                          </h4>
                        </div>

                        <span className={`px-2.5 py-1 rounded-xl font-black text-[10px] uppercase shrink-0 shadow-xs ${st.color}`}>
                          {st.label}
                        </span>
                      </div>

                      <div className="space-y-1.5 bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-black/5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Última Troca / Serviço:</span>
                          <strong className="text-slate-800 dark:text-emerald-200">
                            {item.lastServiceHourmeter}h ({item.lastServiceDate ? formatDateBR(item.lastServiceDate) : 'Sem data'})
                          </strong>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Próxima Troca Programada:</span>
                          <strong className="text-slate-800 dark:text-emerald-200">{item.nextScheduledHourmeter}h</strong>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Horas Faltantes:</span>
                          <strong className={st.hoursRemaining <= 0 ? 'text-red-500 font-black' : st.hoursRemaining <= 50 ? 'text-amber-500 font-bold' : 'text-emerald-600 font-bold'}>
                            {st.hoursRemaining <= 0 ? `Vencida há ${Math.abs(st.hoursRemaining)}h` : `${st.hoursRemaining} horas`}
                          </strong>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 dark:bg-emerald-900 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            st.status === 'RED' ? 'bg-red-500' : st.status === 'YELLOW' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(5, (1 - st.hoursRemaining / item.intervalHours) * 100))}%`
                          }}
                        />
                      </div>

                      {canEdit && (
                        <button
                          onClick={() => setRecordingItem(item)}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5 text-[#FACC15]" />
                          <span>Registrar Troca / Serviço Realizado</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick recording sub-form for preventive item */}
              {recordingItem && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                  <h4 className="font-black text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span>Registrar Serviço: {recordingItem.itemName}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">Horímetro Atual no Serviço (h):</label>
                      <input
                        type="number"
                        value={recordHourmeter}
                        onChange={(e) => setRecordHourmeter(Number(e.target.value))}
                        className={`w-full p-2.5 rounded-xl border font-bold ${
                          darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-emerald-200 mb-1">Observações / Detalhes das Peças:</label>
                      <input
                        type="text"
                        placeholder="Ex: Troca com óleo Mobil HD e filtro original..."
                        value={recordNotes}
                        onChange={(e) => setRecordNotes(e.target.value)}
                        className={`w-full p-2.5 rounded-xl border text-xs ${
                          darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setRecordingItem(null)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleRecordSubmit}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-md"
                    >
                      Gravar Manutenção Preventiva
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HISTÓRICO DE MANUTENÇÕES */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                    <span>Histórico Completo de Manutenções</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Acesso para funcionários e administradores.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddMaintenance}
                  className="px-3.5 py-2 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs flex items-center gap-1.5 shadow-md transition-transform active:scale-95 border border-emerald-700/60"
                >
                  <Plus className="w-4 h-4 text-[#FACC15]" />
                  <span>+ Registrar Manutenção</span>
                </button>
              </div>

              {/* Section 1: Special Highlight for Oil & Filter Changes */}
              <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Histórico de Trocas de Óleo ({oilChangeLogs.length})</span>
                  </h4>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    Ciclo padrão: {isVehicleKm ? (vehicle.oilChangeIntervalKm || vehicle.maintenanceIntervalKm || 10000).toLocaleString('pt-BR') + ' KM' : (vehicle.oilChangeIntervalHours || vehicle.maintenanceIntervalHours || 300).toLocaleString('pt-BR') + ' Horas'}
                  </span>
                </div>

                {oilChangeLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">Nenhum registro específico de troca de óleo cadastrado ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {oilChangeLogs.map(m => (
                      <div key={m.id} className="p-3.5 rounded-2xl bg-white dark:bg-emerald-950/90 border border-amber-500/20 shadow-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-black text-xs text-slate-900 dark:text-slate-100 block">{m.title}</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {isVehicleKm ? 'Quilometragem' : 'Horímetro'}: <strong>{m.kmOrHourAtService?.toLocaleString('pt-BR')} {isVehicleKm ? 'km' : 'h'}</strong>
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-emerald-900/50 text-slate-600 dark:text-emerald-300">
                            {m.dateTime ? formatDateTimeBR(m.dateTime) : formatDateBR(m.date)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 dark:bg-black/20 p-2 rounded-xl border border-black/5 dark:border-white/5">
                          {m.oilType && (
                            <div>
                              <span className="text-slate-400 text-[10px] block">Óleo:</span>
                              <strong className="text-slate-800 dark:text-emerald-200">{m.oilType}</strong>
                            </div>
                          )}
                          {m.oilQuantityLiters && (
                            <div>
                              <span className="text-slate-400 text-[10px] block">Volume:</span>
                              <strong className="text-slate-800 dark:text-emerald-200">{m.oilQuantityLiters} Litros</strong>
                            </div>
                          )}
                          {m.filtersReplaced && (
                            <div className="col-span-2">
                              <span className="text-slate-400 text-[10px] block">Filtros:</span>
                              <strong className="text-slate-800 dark:text-emerald-200">{m.filtersReplaced}</strong>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-400 text-[10px] block">Mecânico:</span>
                            <span className="text-slate-700 dark:text-slate-300">{m.performedBy || 'Não inf.'}</span>
                          </div>
                          {canEdit && (
                            <div>
                              <span className="text-slate-400 text-[10px] block">Valor:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-bold">{m.cost > 0 ? formatCurrency(m.cost) : 'Oficina Interna'}</span>
                            </div>
                          )}
                        </div>

                        {m.description && <p className="text-[10px] text-slate-500 italic">"{m.description}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: All Maintenance Logs List */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs text-slate-700 dark:text-emerald-200">
                  Todas as Manutenções Realizadas ({machineMaintenanceLogs.length})
                </h4>

                {machineMaintenanceLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-3xl">
                    Nenhum registro de manutenção encontrado para esta máquina.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {machineMaintenanceLogs.map(log => (
                      <div 
                        key={log.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border text-xs space-y-2 relative"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md font-black text-[9px] uppercase bg-emerald-700 text-white">
                              {log.type.replace('_', ' ')}
                            </span>
                            <h5 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                              {log.title}
                            </h5>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-bold">
                              🗓️ {log.dateTime ? formatDateTimeBR(log.dateTime) : formatDateBR(log.date)}
                            </span>

                            {/* Maintenance role controls - Exclusivo perfil MANUTENCAO */}
                            {canManageTimeline && (
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() => handleOpenEditMaintenance(log)}
                                  className="p-1 rounded bg-slate-200 dark:bg-emerald-800 hover:bg-slate-300 text-slate-700 dark:text-emerald-100"
                                  title="Editar Manutenção"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMnt(log.id)}
                                  className="p-1 rounded bg-red-100 dark:bg-red-950 hover:bg-red-200 text-red-600 dark:text-red-300"
                                  title="Excluir Manutenção"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-slate-700 dark:text-emerald-200 font-medium">
                          {log.description}
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-emerald-900">
                          <div>
                            <span className="block text-[10px]">Horímetro/KM:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{log.kmOrHourAtService}</strong>
                          </div>

                          <div>
                            <span className="block text-[10px]">Mecânico / Resp.:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{log.performedBy || 'Não informado'}</strong>
                          </div>

                          <div>
                            <span className="block text-[10px]">Oficina / Fornecedor:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{log.supplierOrWorkshop || 'Interno'}</strong>
                          </div>

                          {canEdit && (
                            <div>
                              <span className="block text-[10px]">Custo Registrado:</span>
                              <strong className="text-[#064E3B] dark:text-[#FACC15]">{log.cost > 0 ? formatCurrency(log.cost) : 'R$ 0,00'}</strong>
                            </div>
                          )}
                        </div>

                        {log.notes && (
                          <p className="text-[10px] text-slate-500 italic bg-white/50 dark:bg-black/20 p-2 rounded-xl">
                            Obs: {log.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LINHA DO TEMPO */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                <span>Linha do Tempo Integrada da Máquina ({combinedTimeline.length})</span>
              </h3>

              {combinedTimeline.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-3xl">
                  Nenhum evento registrado no histórico desta máquina.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-emerald-900/60 pr-1 max-h-96 overflow-y-auto">
                  {combinedTimeline.map(item => (
                    <div key={item.id} className="relative pl-8 space-y-1">
                      <div className={`absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 bg-white dark:bg-emerald-950 ${
                        item.type === 'FUEL' 
                          ? 'border-[#064E3B] text-[#064E3B]' 
                          : item.type === 'MAINTENANCE' 
                            ? 'border-amber-500 text-amber-500' 
                            : 'border-red-500 text-red-500'
                      }`} />

                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 dark:text-slate-100">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {formatDateTimeBR(item.date)}
                          </span>
                        </div>

                        <p className="text-slate-600 dark:text-emerald-300">
                          {item.description}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-emerald-900">
                          <span>Responsável: <strong>{item.user}</strong></span>
                          {item.value && <strong className="text-[#064E3B] dark:text-[#FACC15]">{item.value}</strong>}
                        </div>

                        {item.photoUrl && (
                          <div className="mt-2 w-24 h-20 rounded-xl overflow-hidden border">
                            <img src={item.photoUrl} alt="Anexo" className="w-full h-full object-cover" />
                          </div>
                        )}

                        {/* Controles de edição e exclusão na Linha do Tempo: estritamente exclusivos para perfil MANUTENCAO */}
                        {item.type === 'MAINTENANCE' && canManageTimeline && (
                          <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-emerald-900">
                            <button
                              onClick={() => handleOpenEditMaintenance(item.rawObj as MaintenanceLog)}
                              className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-emerald-800 hover:bg-slate-300 text-slate-700 dark:text-emerald-100 flex items-center gap-1 text-[10px] font-bold shadow-xs active:scale-95 transition-all"
                              title="Editar registro da linha do tempo"
                            >
                              <Edit className="w-3 h-3 text-[#FACC15]" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => handleDeleteMnt((item.rawObj as MaintenanceLog).id)}
                              className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/80 hover:bg-red-200 text-red-600 dark:text-red-300 flex items-center gap-1 text-[10px] font-bold shadow-xs active:scale-95 transition-all"
                              title="Excluir registro da linha do tempo"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INDICADORES OPERACIONAIS */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                  <span>Indicadores Operacionais da Máquina</span>
                </h3>
              </div>

              {(() => {
                const oilStatus = calculateOilChangeStatus(vehicle);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Horas / KM Acumulado:</span>
                      <strong className="text-xl font-black text-[#064E3B] dark:text-[#FACC15]">
                        {vehicle.category === 'VEICULO' ? `${vehicle.currentKm.toLocaleString('pt-BR')} km` : `${vehicle.currentHourmeter || 0} h`}
                      </strong>
                      <p className="text-[10px] text-slate-500">Total trabalhado</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Consumo Mensal:</span>
                      <strong className="text-xl font-black text-slate-900 dark:text-slate-100">
                        {litersConsumedMonth.toLocaleString('pt-BR')} L
                      </strong>
                      <p className="text-[10px] text-slate-500">Total de litros consumidos no mês</p>
                    </div>

                    <div className={`p-4 rounded-2xl border space-y-1 shadow-sm ${
                      !oilStatus.isOilActive 
                        ? 'bg-slate-50 dark:bg-emerald-950/30 border-slate-200 dark:border-emerald-900' 
                        : oilStatus.status === 'ATRASADA'
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800'
                          : oilStatus.status === 'PROXIMA'
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                    }`}>
                      <span className={`text-[10px] font-black block uppercase ${
                        !oilStatus.isOilActive
                          ? 'text-slate-400'
                          : oilStatus.status === 'ATRASADA'
                            ? 'text-red-600 dark:text-red-400'
                            : oilStatus.status === 'PROXIMA'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {!oilStatus.isOilActive
                          ? 'Controle de Óleo'
                          : oilStatus.status === 'ATRASADA'
                            ? 'Troca de Óleo Vencida'
                            : oilStatus.status === 'PROXIMA'
                              ? 'Troca de Óleo Próxima'
                              : 'Troca de Óleo Em Dia'}
                      </span>
                      <strong className={`text-xl font-black ${
                        !oilStatus.isOilActive
                          ? 'text-slate-500'
                          : oilStatus.status === 'ATRASADA'
                            ? 'text-red-600 dark:text-red-400'
                            : oilStatus.status === 'PROXIMA'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-800 dark:text-emerald-200'
                      }`}>
                        {oilStatus.isOilActive 
                          ? (oilStatus.status === 'ATRASADA' 
                              ? `Vencida há ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')} ${oilStatus.unit}` 
                              : `Faltam ${oilStatus.remaining.toLocaleString('pt-BR')} ${oilStatus.unit}`) 
                          : 'Desativado'}
                      </strong>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {oilStatus.isOilActive ? `Próxima troca aos: ${oilStatus.nextMeter.toLocaleString('pt-BR')} ${oilStatus.unit}` : 'Sem plano ativo'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Fuel className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                      <span>Último Abastecimento</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {lastFueling ? formatDateTimeBR(lastFueling.dateTime) : 'Sem registros'}
                    </span>
                  </div>
                  {lastFueling ? (
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{lastFueling.liters} Litros ({getFuelTypeName(lastFueling.fuelType)})</p>
                      <p className="text-[11px] text-slate-500">Operador: {lastFueling.driverOrOperatorName}</p>
                      <p className="text-[11px] text-slate-500">Posto: {lastFueling.gasStationName}</p>
                    </div>
                  ) : (
                    <p className="text-slate-400">Nenhum abastecimento gravado.</p>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-amber-500" />
                      <span>Última Manutenção</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {lastMaintenance ? formatDateBR(lastMaintenance.date) : 'Sem registros'}
                    </span>
                  </div>
                  {lastMaintenance ? (
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{lastMaintenance.title}</p>
                      <p className="text-[11px] text-slate-500">Técnico: {lastMaintenance.performedBy} ({lastMaintenance.supplierOrWorkshop})</p>
                      <p className="text-[11px] text-slate-500">Horímetro: {lastMaintenance.kmOrHourAtService}h</p>
                    </div>
                  ) : (
                    <p className="text-slate-400">Nenhuma manutenção gravada.</p>
                  )}
                </div>
              </div>

              {/* RECHARTS GRAPHS FOR TECHNICAL ANALYSIS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs pt-2">
                {/* Chart 1: Abastecimentos e Litros Consumidos */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border border-slate-200 dark:border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-emerald-900/60">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Fuel className="w-4 h-4 text-[#064E3B] dark:text-[#FACC15]" />
                      <span>Histórico de Consumo (Litros)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">Volume por abastecimento</span>
                  </div>

                  {fuelChartData.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
                      Sem dados de abastecimento suficientes para o gráfico.
                    </div>
                  ) : (
                    <div className="h-48 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fuelChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#042d23' : '#ffffff', 
                              borderColor: '#059669', 
                              borderRadius: '12px',
                              fontSize: '11px',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                            formatter={(value: any) => [`${value} Litros`, 'Volume']}
                          />
                          <Bar dataKey="litros" fill="#059669" radius={[6, 6, 0, 0]} name="Litros" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Chart 2: Evolução do Horímetro / KM */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border border-slate-200 dark:border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-emerald-900/60">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-[#FACC15]" />
                      <span>Evolução do Horímetro / KM</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {vehicle.category === 'VEICULO' ? 'Quilometragem' : 'Horas Operacionais'}
                    </span>
                  </div>

                  {fuelChartData.length === 0 && maintenanceChartData.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
                      Sem histórico de horímetro registrado.
                    </div>
                  ) : (
                    <div className="h-48 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={(fuelChartData.length > 0 ? fuelChartData : maintenanceChartData) as any} 
                          margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorMeter" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FACC15" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#FACC15" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#042d23' : '#ffffff', 
                              borderColor: '#eab308', 
                              borderRadius: '12px',
                              fontSize: '11px',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                            formatter={(value: any) => [
                              `${value} ${vehicle.category === 'VEICULO' ? 'km' : 'h'}`,
                              'Horímetro / KM'
                            ]}
                          />
                          <Area type="monotone" dataKey="horimetro" stroke="#FACC15" fillOpacity={1} fill="url(#colorMeter)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PROBLEMAS RELATADOS */}
          {activeTab === 'ISSUES' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span>Problemas & Defeitos Relatados</span>
                </h3>

                <button
                  onClick={() => setIsReportProblemOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Informar Novo Problema</span>
                </button>
              </div>

              {machineReportedIssues.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed rounded-3xl">
                  Nenhum problema relatado para esta máquina até o momento.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {machineReportedIssues.map(iss => {
                    const oilStatus = calculateOilChangeStatus(vehicle);
                    const isOilIssue = iss.description.toLowerCase().includes('troca de óleo') ||
                                       iss.description.toLowerCase().includes('troca de oleo') ||
                                       iss.description.toLowerCase().includes('óleo do motor') ||
                                       iss.description.toLowerCase().includes('oleo do motor') ||
                                       iss.description.toLowerCase().includes('óleo vencid') ||
                                       iss.description.toLowerCase().includes('oleo vencid');
                    const isAutoResolvedByOil = isOilIssue && oilStatus.status === 'EM_DIA';
                    const isEffectivelyOpen = iss.status === 'ABERTO' && !isAutoResolvedByOil;

                    const isTargetIssue = Boolean(initialIssueId && (iss.id === initialIssueId || `issue-${iss.id}` === initialIssueId || initialIssueId.includes(iss.id)));

                    return (
                      <div
                        key={iss.id}
                        className={`p-4 rounded-2xl border text-xs space-y-3 transition-all duration-300 ${
                          isTargetIssue
                            ? 'ring-2 ring-amber-400 bg-amber-500/10 border-amber-400 shadow-md'
                            : isEffectivelyOpen 
                              ? 'bg-red-500/10 border-red-500/30 text-slate-900 dark:text-slate-100'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md font-black text-[9px] uppercase ${
                              isEffectivelyOpen ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                            }`}>
                              {isAutoResolvedByOil ? 'RESOLVIDO (TROCA DE ÓLEO CONCLUÍDA)' : iss.status}
                            </span>
                            {isTargetIssue && (
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[9px] bg-amber-400 text-slate-950 flex items-center gap-1 animate-pulse">
                                🔔 Defeito da Notificação
                              </span>
                            )}
                            <span className="font-bold text-slate-600 dark:text-emerald-300">
                              Relatado por {iss.reportedByUserName}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-400">
                            {formatDateTimeBR(iss.dateTime)}
                          </span>
                        </div>

                        <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-sm">
                          "{iss.description}"
                        </p>

                        {/* Exibição direta da foto no card sem exigir clique prévio para visualizá-la */}
                        {(() => {
                          const photos = iss.photoUrls && iss.photoUrls.length > 0 
                            ? iss.photoUrls 
                            : (iss.photoUrl ? [iss.photoUrl] : []);
                          if (photos.length === 0) return null;

                          return (
                            <div className="pt-1 flex flex-wrap items-center gap-3">
                              <div
                                onClick={() => {
                                  setSelectedIssueForPhotos(iss);
                                  setActivePhotoIndex(0);
                                }}
                                className="relative group cursor-pointer"
                                title="Clique para ampliar a foto do defeito"
                              >
                                <img
                                  src={photos[0]}
                                  alt="Foto do defeito"
                                  className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl border-2 border-emerald-600/50 shadow-sm transition-transform group-hover:scale-105"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white text-[11px] font-bold">
                                  🔍 Ampliar
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-emerald-400 block">
                                  {photos.length > 1 ? `📷 ${photos.length} fotos anexadas` : '📷 Foto anexada pelo operador'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedIssueForPhotos(iss);
                                    setActivePhotoIndex(0);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 active:scale-95 cursor-pointer"
                                >
                                  <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>{photos.length > 1 ? `Ver Todas as ${photos.length} Fotos` : 'Ampliar em Tela Cheia'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {isEffectivelyOpen && onResolveIssue && (
                          <button
                            type="button"
                            onClick={() => {
                              const photos = iss.photoUrls && iss.photoUrls.length > 0 
                                ? iss.photoUrls 
                                : (iss.photoUrl ? [iss.photoUrl] : []);
                              
                              // Regra 19: Se possuir fotos, exibir diálogo de confirmação
                              if (photos.length > 0) {
                                setIssueToConfirmResolve(iss);
                              } else {
                                onResolveIssue(iss.id);
                                setActionSuccessMsg('Problema marcado como resolvido!');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Marcar Como Resolvido</span>
                          </button>
                        )}

                        {!isEffectivelyOpen && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold">
                            {isAutoResolvedByOil
                              ? 'Resolvido automaticamente: Troca de óleo realizada com sucesso para este veículo.'
                              : `Resolvido por ${iss.resolvedBy || 'Gestor'} em ${iss.resolvedAt ? formatDateTimeBR(iss.resolvedAt) : ''}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Inline Form: Add/Edit Maintenance Log */}
        {isMntFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm">
            <div className={`w-full max-w-lg rounded-3xl p-5 border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              darkMode ? 'bg-slate-900 text-white border-emerald-900' : 'bg-white text-slate-900 border-slate-200'
            }`}>
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-black text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#FACC15]" />
                  <span>{editingMntId ? 'Editar Registro de Manutenção' : 'Novo Registro de Manutenção'}</span>
                </h3>
                <button
                  onClick={() => setIsMntFormOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMaintenanceForm} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">Tipo de Manutenção:</label>
                  <select
                    value={mntType}
                    onChange={(e) => setMntType(e.target.value as MaintenanceType)}
                    className={`w-full p-2.5 rounded-xl border font-bold ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  >
                    <option value="TROCA_OLEO">Troca de Óleo</option>
                    <option value="TROCA_FILTROS">Troca de Filtros (Óleo, Ar, Combustível)</option>
                    <option value="REVISAO">Revisão Geral / Preventiva</option>
                    <option value="LUBRIFICACAO">Lubrificação e Engraxamento</option>
                    <option value="PNEUS">Pneus / Esteiras</option>
                    <option value="PECAS">Troca de Peças</option>
                    <option value="SERVICO_CORRETIVO">Serviço Corretivo</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Título do Serviço:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Troca de óleo do motor + filtro original"
                    value={mntTitle}
                    onChange={(e) => setMntTitle(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Data:</label>
                    <input
                      type="date"
                      required
                      value={mntDate}
                      onChange={(e) => setMntDate(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Horímetro ou KM:</label>
                    <input
                      type="number"
                      required
                      value={mntMeter}
                      onChange={(e) => setMntMeter(Number(e.target.value))}
                      className={`w-full p-2.5 rounded-xl border font-bold ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                    {mntMeter < (vehicle.category === 'VEICULO' ? (vehicle.currentKm || 0) : (vehicle.currentHourmeter || 0)) && (
                      <p className="text-[10px] text-amber-500 font-bold mt-1">
                        ⚠️ Atenção: O valor digitado ({mntMeter}) é menor que o valor atual oficial ({vehicle.category === 'VEICULO' ? (vehicle.currentKm || 0) : (vehicle.currentHourmeter || 0)}). O horímetro/odômetro oficial não será reduzido.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Descrição do Serviço Realizado:</label>
                  <textarea
                    rows={2}
                    placeholder="Descreva detalhadamente o serviço executado (opcional)..."
                    value={mntDesc}
                    onChange={(e) => setMntDesc(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Responsável / Mecânico:</label>
                    <input
                      type="text"
                      placeholder="Nome do responsável"
                      value={mntPerformedBy}
                      onChange={(e) => setMntPerformedBy(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Oficina / Fornecedor:</label>
                    <input
                      type="text"
                      placeholder="Ex: Oficina Interna"
                      value={mntSupplier}
                      onChange={(e) => setMntSupplier(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Valor / Custo (R$) (Opcional):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={mntCost}
                      onChange={(e) => setMntCost(Number(e.target.value))}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Observações:</label>
                    <input
                      type="text"
                      placeholder="Ex: Garantia de 90 dias"
                      value={mntNotes}
                      onChange={(e) => setMntNotes(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border ${
                        darkMode ? 'bg-emerald-950 border-emerald-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-emerald-900">
                  <button
                    type="button"
                    onClick={() => setIsMntFormOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-[#064E3B] text-[#FACC15] font-black text-xs shadow-md hover:bg-[#043d2e]"
                  >
                    {editingMntId ? 'Salvar Alterações' : 'Gravar Manutenção'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sub-modal: Detalhes do Alerta do Veículo */}
        {selectedAlertDetail && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 border shadow-2xl space-y-4 animate-in zoom-in-95 ${
              darkMode ? 'bg-[#04281f] border-amber-500/40 text-white' : 'bg-white border-amber-300 text-slate-900'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-amber-500/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className={`w-5 h-5 ${selectedAlertDetail.type === 'RED' ? 'text-red-500' : 'text-amber-500'}`} />
                  <h3 className="font-extrabold text-sm sm:text-base">
                    Detalhes do Alerta
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAlertDetail(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tipo do Alerta */}
              <div className={`p-3.5 rounded-2xl border space-y-1 ${
                selectedAlertDetail.type === 'RED'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-300">
                    Tipo do Alerta
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    selectedAlertDetail.type === 'RED' ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'
                  }`}>
                    {selectedAlertDetail.type === 'RED' ? 'Gravidade ALTA' : 'Gravidade MÉDIA'}
                  </span>
                </div>
                <p className="font-extrabold text-sm">
                  {selectedAlertDetail.isOilAlert 
                    ? (selectedAlertDetail.type === 'RED' ? 'Troca de Óleo Vencida' : 'Troca de Óleo Próxima') 
                    : selectedAlertDetail.title}
                </p>
                <p className="text-xs opacity-90 leading-relaxed">
                  {selectedAlertDetail.desc}
                </p>
              </div>

              {/* Veículo / Máquina Correspondente */}
              <div className={`space-y-2 p-3.5 rounded-2xl border text-xs ${
                darkMode ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-emerald-400 block">
                  Veículo / Máquina Correspondente
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-sm font-extrabold block">
                      {vehicle.model}
                    </strong>
                    <span className="text-[11px] opacity-75">
                      Identificador / Placa: <strong>{vehicle.patrimonyCode || vehicle.licensePlate || vehicle.id}</strong> • {vehicle.category === 'MAQUINA_AGRICOLA' ? 'Máquina Agrícola' : vehicle.category === 'TRATOR' ? 'Trator' : 'Veículo'} • {vehicle.manufacturer}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                    {vehicle.sector}
                  </span>
                </div>
              </div>

              {/* Informações Relevantes Exclusivas Deste Veículo */}
              {(() => {
                const oilSt = calculateOilChangeStatus(vehicle);
                return (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-3 rounded-xl border ${darkMode ? 'bg-black/30 border-emerald-900/40' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        {oilSt.unit === 'km' ? 'Odômetro Atual' : 'Horímetro Atual'}
                      </span>
                      <strong className="text-sm text-emerald-600 dark:text-emerald-200">
                        {oilSt.currentMeter.toLocaleString('pt-BR')} {oilSt.unit}
                      </strong>
                    </div>

                    <div className={`p-3 rounded-xl border ${darkMode ? 'bg-black/30 border-emerald-900/40' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        Próxima Troca Prevista
                      </span>
                      <strong className="text-sm text-amber-600 dark:text-amber-400">
                        {oilSt.nextMeter.toLocaleString('pt-BR')} {oilSt.unit}
                      </strong>
                    </div>

                    <div className={`p-3 rounded-xl border ${darkMode ? 'bg-black/30 border-emerald-900/40' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        Última Troca Registrada
                      </span>
                      <strong className="text-xs">
                        {oilSt.lastDate ? formatDateBR(oilSt.lastDate) : 'Não registrada'} ({oilSt.lastMeter.toLocaleString('pt-BR')} {oilSt.unit})
                      </strong>
                    </div>

                    <div className={`p-3 rounded-xl border ${darkMode ? 'bg-black/30 border-emerald-900/40' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        Intervalo Programado
                      </span>
                      <strong className="text-xs">
                        {oilSt.interval.toLocaleString('pt-BR')} {oilSt.unit}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* Ações */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-emerald-900/50">
                <button
                  onClick={() => setSelectedAlertDetail(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-emerald-800 text-slate-700 dark:text-emerald-200 hover:bg-slate-100 dark:hover:bg-emerald-900/50"
                >
                  Fechar
                </button>
                {selectedAlertDetail.isOilAlert && canEdit && (
                  <button
                    onClick={() => {
                      setSelectedAlertDetail(null);
                      const isKm = vehicle.category === 'VEICULO' || vehicle.maintenanceControlType === 'QUILOMETRAGEM';
                      setDirectOilHourmeter(isKm ? (vehicle.currentKm || 0) : (vehicle.currentHourmeter || 0));
                      setDirectOilDate(getTodayDateSaoPaulo());
                      setDirectOilPerformedBy(currentUser?.name || '');
                      setIsDirectOilChangeOpen(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registrar Troca de Óleo Deste Veículo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sub-modal: Informar Problema */}
        {/* Modal para Visualização de Fotos do Defeito (Regra 8) */}
        {selectedIssueForPhotos && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className={`w-full max-w-2xl rounded-3xl p-5 border shadow-2xl space-y-4 max-h-[90vh] flex flex-col ${
              darkMode ? 'bg-[#042d23] border-emerald-900 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm">
                      Fotos do Defeito • {vehicle.model}
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Relatado por {selectedIssueForPhotos.reportedByUserName} em {formatDateTimeBR(selectedIssueForPhotos.dateTime)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIssueForPhotos(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-emerald-900/50"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <p className="text-xs font-medium text-slate-700 dark:text-emerald-200 bg-slate-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-slate-200/80 dark:border-emerald-900">
                "{selectedIssueForPhotos.description}"
              </p>

              {/* Image Viewer */}
              {(() => {
                const photos = selectedIssueForPhotos.photoUrls && selectedIssueForPhotos.photoUrls.length > 0
                  ? selectedIssueForPhotos.photoUrls
                  : (selectedIssueForPhotos.photoUrl ? [selectedIssueForPhotos.photoUrl] : []);
                const currentPhoto = photos[activePhotoIndex] || photos[0];

                return (
                  <div className="space-y-3 flex-1 flex flex-col items-center justify-center min-h-[220px]">
                    <div className="relative w-full max-h-[50vh] flex items-center justify-center rounded-2xl overflow-hidden bg-black/40 border border-slate-200 dark:border-emerald-800">
                      {currentPhoto ? (
                        <img
                          src={currentPhoto}
                          alt={`Foto do defeito ${activePhotoIndex + 1}`}
                          className="max-w-full max-h-[50vh] object-contain rounded-xl"
                        />
                      ) : (
                        <div className="p-8 text-center text-xs text-slate-400">
                          Nenhuma foto disponível
                        </div>
                      )}

                      {photos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActivePhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all"
                            title="Foto anterior"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActivePhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all"
                            title="Próxima foto"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {photos.length > 1 && (
                      <div className="flex items-center gap-2">
                        {photos.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActivePhotoIndex(idx)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                              activePhotoIndex === idx
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-emerald-950/60 text-slate-600 dark:text-emerald-300'
                            }`}
                          >
                            Foto {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIssueForPhotos(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-emerald-950/60 font-bold text-xs text-slate-700 dark:text-emerald-200 hover:bg-slate-200 dark:hover:bg-emerald-900"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação para Resolução com Exclusão de Fotos (Regra 19) */}
        {issueToConfirmResolve && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
            <div className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4 ${
              darkMode ? 'bg-[#042d23] border-emerald-900 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    Resolver este defeito?
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Confirmação de finalização
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-emerald-200 leading-relaxed">
                As fotos anexadas a este defeito serão excluídas permanentemente.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIssueToConfirmResolve(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = issueToConfirmResolve.id;
                    setIssueToConfirmResolve(null);
                    if (onResolveIssue) {
                      onResolveIssue(id);
                      setActionSuccessMsg('Problema marcado como resolvido e fotos removidas!');
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
                >
                  Resolver defeito
                </button>
              </div>
            </div>
          </div>
        )}

        <ReportProblemModal
          isOpen={isReportProblemOpen}
          onClose={() => setIsReportProblemOpen(false)}
          vehicle={vehicle}
          currentUser={currentUser}
          onSubmit={(data) => {
            onReportProblemSubmit(data);
            setActionSuccessMsg('Problema registrado com sucesso! Administradores notificados.');
            setTimeout(() => setActionSuccessMsg(null), 4000);
          }}
          darkMode={darkMode}
        />
      </div>
    </div>
  );
};

export const MachineDigitalSheetModalComponent: React.FC<MachineDigitalSheetModalProps> = (props) => {
  const { isOpen, vehicle: propVehicle, vehicles = [] } = props;
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setDataVersion(v => v + 1);
    window.addEventListener('andradeagro_data_updated', handleUpdate);
    return () => window.removeEventListener('andradeagro_data_updated', handleUpdate);
  }, []);

  const vehicle = useMemo(() => {
    if (!propVehicle) return propVehicle;
    if (vehicles && vehicles.length > 0) {
      const found = vehicles.find(v => v.id === propVehicle.id);
      if (found) return found;
    }
    const fromCache = getVehicles().find(v => v.id === propVehicle.id);
    if (fromCache) return fromCache;
    return propVehicle;
  }, [propVehicle, vehicles, dataVersion]);

  if (!isOpen || !vehicle) return null;

  return <MachineDigitalSheetInner {...props} vehicle={vehicle} />;
};

export const MachineDigitalSheetModal = React.memo(MachineDigitalSheetModalComponent);
