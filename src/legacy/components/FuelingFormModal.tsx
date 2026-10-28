import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Fuel, Calendar, Clock, Truck, User as UserIcon, 
  AlertTriangle, CheckCircle2, Check, Droplet, Sparkles, Plus, Gauge, MapPin, Lock
} from 'lucide-react';
import { Vehicle, GasStation, User, FuelType, FuelLog, SystemSettings, OperationType, ActivityType, canEditSystemData } from '../types';
import { 
  calculateFuelLogMetrics, formatCurrency, getFuelTypeName, getSectorName,
  getActivitiesForOperation, OPERATION_OPTIONS, getStationFuelPrice,
  getTodayDateSaoPaulo, getCurrentTimeSaoPaulo, createTimestampForDateSaoPaulo
} from '../utils/calculations';
import { getTankStatus } from '../utils/storage';
import { validateHourmeterReading } from '../utils/hourmeterValidation';
import { VehicleSelector } from './VehicleSelector';

interface FuelingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (log: Omit<FuelLog, 'id' | 'createdAt'>) => void;
  vehicles: Vehicle[];
  gasStations: GasStation[];
  users: User[];
  currentUser: User;
  previousLogs: FuelLog[];
  settings: SystemSettings;
  preSelectedVehicleId?: string;
  darkMode: boolean;
}

export const FuelingFormModalComponent: React.FC<FuelingFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vehicles,
  gasStations,
  users,
  currentUser,
  previousLogs,
  settings,
  preSelectedVehicleId,
  darkMode
}) => {
  // Real-time Tank Stock Status (Sede Fazenda)
  const tankStatus = useMemo(() => getTankStatus(), [isOpen]);
  const isTankLow = tankStatus.currentStock <= 2000;

  // Filter fuelable vehicles
  const fuelableVehicles = useMemo(
    () => vehicles.filter(v => v.fuelType !== 'NENHUM'),
    [vehicles]
  );

  // Form states
  const [dateTime, setDateTime] = useState<string>(
    () => `${getTodayDateSaoPaulo()}T${getCurrentTimeSaoPaulo()}`
  );

  const [equipmentId, setEquipmentId] = useState<string>(() => {
    if (preSelectedVehicleId && vehicles.some(v => v.id === preSelectedVehicleId)) {
      return preSelectedVehicleId;
    }
    return fuelableVehicles[0]?.id || vehicles[0]?.id || '';
  });

  useEffect(() => {
    if (preSelectedVehicleId && vehicles.some(v => v.id === preSelectedVehicleId)) {
      setEquipmentId(preSelectedVehicleId);
    }
  }, [preSelectedVehicleId, vehicles]);

  const selectedEquipment = useMemo(
    () => vehicles.find(v => v.id === equipmentId) || fuelableVehicles[0],
    [vehicles, equipmentId, fuelableVehicles]
  );

  const [driverOrOperatorId, setDriverOrOperatorId] = useState<string>(
    selectedEquipment?.assignedOperatorId || currentUser?.id || users[0]?.id || ''
  );

  const [gasStationId, setGasStationId] = useState<string>(
    gasStations.find(s => s.type === 'INTERNO')?.id || gasStations[0]?.id || ''
  );

  const selectedStation = useMemo(
    () => gasStations.find(s => s.id === gasStationId) || gasStations[0],
    [gasStations, gasStationId]
  );

  const [fuelType, setFuelType] = useState<FuelType>(
    selectedEquipment?.fuelType && selectedEquipment.fuelType !== 'NENHUM' ? selectedEquipment.fuelType : 'DIESEL_S10'
  );

  // Automatically synchronize fuel type when selected equipment changes
  useEffect(() => {
    if (selectedEquipment?.fuelType && selectedEquipment.fuelType !== 'NENHUM') {
      setFuelType(selectedEquipment.fuelType);
    }
  }, [selectedEquipment?.id, selectedEquipment?.fuelType]);

  const [liters, setLiters] = useState<number | string>(50);

  const isFuncionario = currentUser.role === 'FUNCIONARIO';
  const isPrivileged = canEditSystemData(currentUser.role);

  const isExternalStation = selectedStation?.type === 'EXTERNO';

  // Base price configured on the station for the selected fuel type
  const baseStationPrice = useMemo(
    () => getStationFuelPrice(selectedStation, fuelType),
    [selectedStation, fuelType]
  );

  // Manual price state (specifically used when station is EXTERNO)
  const [manualPricePerLiter, setManualPricePerLiter] = useState<string>(() => {
    const p = getStationFuelPrice(selectedStation, fuelType);
    return p > 0 ? p.toFixed(2) : '';
  });

  const lastStationIdRef = useRef<string>(selectedStation?.id || '');
  const lastFuelTypeRef = useRef<FuelType>(fuelType);

  // Whenever selected station or fuel type changes, synchronize suggested reference price for that fuel type
  useEffect(() => {
    const stationChanged = lastStationIdRef.current !== selectedStation?.id;
    const fuelChanged = lastFuelTypeRef.current !== fuelType;

    if (stationChanged || fuelChanged) {
      lastStationIdRef.current = selectedStation?.id || '';
      lastFuelTypeRef.current = fuelType;

      const refPrice = getStationFuelPrice(selectedStation, fuelType);
      setManualPricePerLiter(refPrice > 0 ? refPrice.toFixed(2) : '');
    }
  }, [selectedStation?.id, fuelType]);

  // Strictly compute price per liter:
  // EXTERNO: user can manually type any price per liter (e.g. 5,89 or 5.89).
  // INTERNO: STRICTLY locked to the station's registered price (baseStationPrice), no manual typing allowed.
  const pricePerLiter = useMemo(() => {
    if (isExternalStation) {
      const clean = String(manualPricePerLiter).replace(',', '.').trim();
      const parsed = parseFloat(clean);
      return !isNaN(parsed) && parsed > 0 ? parsed : baseStationPrice;
    }
    return baseStationPrice;
  }, [isExternalStation, manualPricePerLiter, baseStationPrice]);

  const isKmBased = selectedEquipment?.category === 'VEICULO';
  const initialCurrentKmOrHour = isKmBased 
    ? (selectedEquipment?.currentKm || '') 
    : (selectedEquipment?.currentHourmeter || '');

  const [currentKmOrHour, setCurrentKmOrHour] = useState<number | string>(initialCurrentKmOrHour);
  const [isAuthorizedCorrection, setIsAuthorizedCorrection] = useState(false);
  const [correctionJustification, setCorrectionJustification] = useState('');
  const [operationType, setOperationType] = useState<OperationType>('GRAMA');
  const [activityType, setActivityType] = useState<ActivityType>('CORTE');
  const [observations, setObservations] = useState<string>('');

  // Available activities for currently selected operation
  const availableActivities = useMemo(() => {
    return getActivitiesForOperation(operationType);
  }, [operationType]);

  const handleOperationTypeChange = (newOp: OperationType) => {
    setOperationType(newOp);
    const newActs = getActivitiesForOperation(newOp);
    setActivityType((newActs[0]?.id || 'OUTRAS') as ActivityType);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [savedLiters, setSavedLiters] = useState<number>(0);

  // Auto-sync when equipment changes
  useEffect(() => {
    if (selectedEquipment) {
      setFuelType(selectedEquipment.fuelType || 'DIESEL_S10');
      if (selectedEquipment.assignedOperatorId) {
        setDriverOrOperatorId(selectedEquipment.assignedOperatorId);
      }
      const nextMeter = isKmBased 
        ? (selectedEquipment.currentKm || '') 
        : (selectedEquipment.currentHourmeter || '');
      setCurrentKmOrHour(nextMeter);
      setIsAuthorizedCorrection(false);
      setCorrectionJustification('');
    }
  }, [equipmentId]);

  const numLiters = Number(liters) || 0;
  const numKmOrHour = Number(currentKmOrHour) || 0;

  // Live intelligent validation of hourmeter
  const hourmeterValidation = useMemo(() => {
    if (isKmBased || !selectedEquipment) {
      return { isValid: true, isBlocking: false, warningType: 'NONE' as const };
    }
    return validateHourmeterReading({
      newHourmeter: currentKmOrHour,
      equipment: selectedEquipment,
      previousLogs,
      currentDate: dateTime,
      userRole: currentUser.role,
      isAuthorizedCorrection,
      justification: correctionJustification
    });
  }, [isKmBased, selectedEquipment, currentKmOrHour, previousLogs, dateTime, currentUser.role, isAuthorizedCorrection, correctionJustification]);

  // Calculate metrics
  const metrics = selectedEquipment ? calculateFuelLogMetrics(
    numLiters,
    pricePerLiter,
    selectedEquipment,
    numKmOrHour,
    previousLogs.filter(l => l.equipmentId === equipmentId),
    settings.suspiciousFuelMarginPercentage
  ) : {
    totalValue: numLiters * pricePerLiter,
    flaggedSuspicious: false
  };

  const selectedDriver = users.find(u => u.id === driverOrOperatorId) || currentUser;

  // Quick increment buttons helper
  const handleQuickAddLiters = (amount: number) => {
    setLiters(prev => (Number(prev) || 0) + amount);
  };

  const handleSetFullTank = () => {
    if (selectedEquipment?.tankCapacityLiters) {
      setLiters(selectedEquipment.tankCapacityLiters);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedEquipment || !selectedStation || numLiters <= 0) {
      alert('Por favor, selecione o equipamento e informe a quantidade de litros abastecidos.');
      return;
    }

    if (!isKmBased && hourmeterValidation.isBlocking) {
      alert(hourmeterValidation.message || 'Por favor, confira e corrija o horímetro no painel físico antes de continuar.');
      return;
    }

    if (isExternalStation) {
      const clean = String(manualPricePerLiter).replace(',', '.').trim();
      const parsed = parseFloat(clean);
      if (isNaN(parsed) || parsed <= 0) {
        alert(isFuncionario
          ? 'Por favor, informe o valor unitário da bomba constante no comprovante.'
          : 'Por favor, informe um preço do combustível válido maior que zero (R$/L).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const safeDateTime = dateTime && dateTime.length >= 10
        ? createTimestampForDateSaoPaulo(dateTime.slice(0, 10), dateTime.slice(11, 16))
        : createTimestampForDateSaoPaulo(getTodayDateSaoPaulo());

      await onSubmit({
        dateTime: safeDateTime,
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.model,
        equipmentCategory: selectedEquipment.category,
        equipmentPlateOrCode: selectedEquipment.licensePlate || selectedEquipment.patrimonyCode || 'S/PLACA',
        driverOrOperatorId: selectedDriver?.id || currentUser.id,
        driverOrOperatorName: selectedDriver?.name || currentUser.name,
        attendantId: currentUser.id,
        attendantName: currentUser.name,
        gasStationId: selectedStation.id,
        gasStationName: selectedStation.name,
        fuelType,
        liters: numLiters,
        pricePerLiter,
        totalValue: metrics.totalValue,
        operationType,
        activityType,
        kmAtFueling: isKmBased ? numKmOrHour : undefined,
        hourmeterAtFueling: !isKmBased ? numKmOrHour : undefined,
        isAuthorizedCorrection: !isKmBased && isAuthorizedCorrection && hourmeterValidation.details?.canAuthorizeCorrection ? true : undefined,
        correctionReason: !isKmBased && isAuthorizedCorrection && hourmeterValidation.details?.canAuthorizeCorrection ? correctionJustification.trim() : undefined,
        previousHourmeterAtCorrection: !isKmBased && isAuthorizedCorrection ? hourmeterValidation.details?.previous : undefined,
        previousKmOrHour: metrics.previousKmOrHour,
        calculatedAverageKmPerLiter: metrics.calculatedAverageKmPerLiter,
        calculatedAverageLitersPerHour: metrics.calculatedAverageLitersPerHour,
        costPerKm: metrics.costPerKm,
        costPerHour: metrics.costPerHour,
        estimatedAutonomyKmOrHours: metrics.estimatedAutonomyKmOrHours,
        observations: observations.trim() || undefined,
        flaggedSuspicious: metrics.flaggedSuspicious,
        suspiciousReason: metrics.suspiciousReason,
        createdById: currentUser.id,
        createdByName: currentUser.name
      });

      setSavedLiters(numLiters);
      setIsSavedSuccess(true);

      setTimeout(() => {
        setIsSavedSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Erro ao salvar abastecimento:', err);
      alert(`Erro ao salvar abastecimento: ${err?.message || 'Falha de comunicação.'}`);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl sm:max-w-3xl rounded-3xl shadow-2xl border flex flex-col overflow-hidden bg-[#03231b] border-emerald-800 text-slate-100 max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-emerald-800/60 bg-gradient-to-r from-[#064E3B] to-[#043327] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black shrink-0 shadow-sm">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Novo Registro de Abastecimento
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-200 font-medium">
                AndradeAgro • Lançamento Rápido e Controle de Combustível
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-2xl bg-emerald-900/60 hover:bg-emerald-800 text-white flex items-center justify-center transition-colors border border-emerald-700/60"
            title="Fechar Formulário"
            aria-label="Fechar Formulário"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation Overlay */}
        {isSavedSuccess ? (
          <div className="p-8 sm:p-12 text-center space-y-4 animate-in zoom-in-95 duration-200 my-auto">
            <div className="w-20 h-20 bg-[#FACC15] text-[#064E3B] rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-yellow-500/20 animate-bounce">
              <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl sm:text-2xl font-black text-white">
                ✅ Abastecimento Salvo com Sucesso!
              </h3>
              <p className="text-sm text-emerald-200 font-medium">
                Foram registrados <strong className="text-[#FACC15] font-extrabold">{savedLiters} Litros</strong> para o equipamento <strong>{selectedEquipment?.model}</strong>.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-900/60 border border-emerald-700 text-[#FACC15] font-black text-xs">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Atualizando estoque e sincronizando...</span>
            </div>
          </div>
        ) : (
          /* Form Content with Smooth Scroll */
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 custom-scrollbar">
            
            {/* Low Fuel Warning Banner (Problem 5: <= 2000L) */}
            {isTankLow && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/20 border-2 border-[#FACC15] text-white flex items-start sm:items-center gap-3 text-xs shadow-md">
                <div className="w-9 h-9 rounded-xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black shrink-0 shadow-sm mt-0.5 sm:mt-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="font-black uppercase tracking-wider text-[#FACC15] block text-xs">
                    ⚠️ Combustível baixo
                  </span>
                  <p className="text-xs text-slate-100 font-medium leading-relaxed">
                    O tanque da Sede Fazenda está com <strong>{Math.round(tankStatus.currentStock).toLocaleString('pt-BR')} L</strong>. O nível está abaixo do limite de 2.000 L.
                  </p>
                </div>
              </div>
            )}

            {/* 1. Vehicle Selection Component */}
            <div className="p-3.5 sm:p-4 rounded-3xl bg-[#04281f] border border-emerald-800/80 space-y-2">
              <VehicleSelector
                vehicles={fuelableVehicles}
                selectedVehicleId={equipmentId}
                onSelect={(id) => setEquipmentId(id)}
                darkMode={darkMode}
                label="Selecione o Veículo ou Máquina *"
              />
            </div>

            {/* 2. Liters & Meter Row (High Contrast & Big Inputs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-3xl bg-[#04281f] border border-emerald-800/80">
              
              {/* Liters Input & Quick Increment Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-200">
                    Litros Abastecidos *
                  </label>
                  <span className="text-[11px] font-bold text-[#FACC15]">
                    Capacidade: {selectedEquipment?.tankCapacityLiters || 0}L
                  </span>
                </div>

                <div className="relative">
                  <Droplet className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FACC15]" />
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="Ex: 50"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-emerald-700/80 bg-[#063327] text-white text-lg font-black outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 transition-all placeholder-emerald-300/40"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-sm text-[#FACC15]">
                    LITROS
                  </span>
                </div>

                {/* Quick Fill Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickAddLiters(10)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-[#FACC15] font-bold text-[11px] border border-emerald-700 transition-colors"
                  >
                    +10 L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLiters(20)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-[#FACC15] font-bold text-[11px] border border-emerald-700 transition-colors"
                  >
                    +20 L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLiters(50)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-[#FACC15] font-bold text-[11px] border border-emerald-700 transition-colors"
                  >
                    +50 L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLiters(100)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-[#FACC15] font-bold text-[11px] border border-emerald-700 transition-colors"
                  >
                    +100 L
                  </button>
                  {selectedEquipment?.tankCapacityLiters ? (
                    <button
                      type="button"
                      onClick={handleSetFullTank}
                      className="px-2.5 py-1 rounded-xl bg-[#FACC15] hover:bg-yellow-400 text-[#064E3B] font-black text-[11px] transition-colors"
                    >
                      Completar ({selectedEquipment.tankCapacityLiters}L)
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Meter Input (Km or Hourmeter) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-200">
                    {isKmBased ? 'Quilometragem (KM) *' : 'Horímetro Atual (Horas) *'}
                  </label>
                  <span className="text-[11px] font-bold text-emerald-300">
                    Anterior: {metrics.previousKmOrHour !== undefined ? `${metrics.previousKmOrHour} ${isKmBased ? 'KM' : 'h'}` : 'Primeiro'}
                  </span>
                </div>

                <div className="relative">
                  <Gauge className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FACC15]" />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={currentKmOrHour}
                    onChange={(e) => setCurrentKmOrHour(e.target.value)}
                    placeholder={isKmBased ? 'Ex: 68100' : 'Ex: 1450.5'}
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl border-2 text-lg font-black outline-none transition-all ${
                      !isKmBased && hourmeterValidation.isBlocking
                        ? 'border-red-500 bg-red-950/40 text-red-200 focus:ring-2 focus:ring-red-400'
                        : !isKmBased && hourmeterValidation.warningType === 'EQUAL_READING'
                        ? 'border-amber-500 bg-[#063327] text-amber-200 focus:ring-2 focus:ring-amber-400'
                        : 'border-emerald-700/80 bg-[#063327] text-[#FACC15] focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20'
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-sm text-slate-200">
                    {isKmBased ? 'KM' : 'HORAS'}
                  </span>
                </div>

                {/* Validação Inteligente do Horímetro (Regras A, B, C, D e Exceção de Manutenção) */}
                {!isKmBased && (
                  <div className="space-y-2 pt-1">
                    {hourmeterValidation.isBlocking && (
                      <div className="p-3.5 rounded-2xl bg-red-950/90 border-2 border-red-500/80 text-white space-y-2.5 animate-in fade-in duration-200">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-red-100 leading-relaxed">
                              {hourmeterValidation.message}
                            </p>
                            {hourmeterValidation.details && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-red-300 font-semibold">
                                <span>Última válida: <strong className="text-white">{hourmeterValidation.details.previous} h</strong></span>
                                <span>Digitada: <strong className="text-white">{hourmeterValidation.details.current} h</strong></span>
                                <span>Variação: <strong className="text-white">{hourmeterValidation.details.diff > 0 ? '+' : ''}{hourmeterValidation.details.diff} h</strong></span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Procedimento de Correção Autorizada: Exclusivo para Perfil MANUTENCAO ou ADMIN */}
                        {hourmeterValidation.details?.canAuthorizeCorrection ? (
                          <div className="mt-2 pt-2.5 border-t border-red-800/80 bg-red-900/40 p-3 rounded-xl space-y-2.5">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-[#FACC15]">
                              <input
                                type="checkbox"
                                checked={isAuthorizedCorrection}
                                onChange={(e) => setIsAuthorizedCorrection(e.target.checked)}
                                className="w-4 h-4 rounded text-yellow-500 focus:ring-yellow-400"
                              />
                              <span>🔧 Ativar Correção Técnica Autorizada (Perfil {currentUser.role})</span>
                            </label>

                            {isAuthorizedCorrection && (
                              <div className="space-y-1.5 pt-1">
                                <label className="block text-[11px] font-black text-amber-200 uppercase tracking-wide">
                                  Justificativa Obrigatória da Correção *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={correctionJustification}
                                  onChange={(e) => setCorrectionJustification(e.target.value)}
                                  placeholder="Ex: Substituição de horímetro analógico / retificação de lançamento incorreto"
                                  className="w-full px-3 py-2 rounded-xl bg-[#031d16] border border-amber-400/80 text-white text-xs outline-none focus:ring-2 focus:ring-[#FACC15]"
                                />
                                <p className="text-[10px] text-amber-200/90 font-medium">
                                  Esta liberação registrará uma entrada no histórico de auditoria com seu usuário, equipamento e data/hora.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-red-300/90 italic font-medium pt-0.5">
                            Caso o valor no painel físico da máquina realmente seja este, solicite à equipe de Manutenção a autorização de ajuste.
                          </p>
                        )}
                      </div>
                    )}

                    {hourmeterValidation.warningType === 'EQUAL_READING' && (
                      <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/70 text-amber-200 flex items-center gap-2 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{hourmeterValidation.message}</span>
                      </div>
                    )}

                    {!hourmeterValidation.isBlocking && isAuthorizedCorrection && hourmeterValidation.details?.canAuthorizeCorrection && (
                      <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 flex items-center gap-2 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0" />
                        <span>Correção técnica autorizada pela Manutenção pronta para salvar.</span>
                      </div>
                    )}

                    {!hourmeterValidation.isBlocking && !isAuthorizedCorrection && (hourmeterValidation.details?.diff || 0) > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold pt-0.5">
                        <span>Variação calculada:</span>
                        <span className="text-[#FACC15] font-black">
                          +{hourmeterValidation.details?.diff} horas
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Meter difference note for KM */}
                {isKmBased && (
                  <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold pt-1">
                    <span>Variação calculada:</span>
                    <span className="text-white font-bold">
                      +{Math.max(0, numKmOrHour - (metrics.previousKmOrHour || 0))} KM
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* 3. Operation Type & Activity (Two-Step Workflow) */}
            <div className="p-4 rounded-3xl bg-[#04281f] border border-emerald-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Tipo de Operação & Atividade Agrícola *
                </span>
                <span className="text-[10px] font-bold text-[#FACC15] bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-800">
                  Etapa 1 & 2
                </span>
              </div>

              {/* Step 1: Operation Selection */}
              <div>
                <label className="block text-[11px] font-bold text-emerald-300 mb-1.5">
                  1. Selecione o Tipo de Operação *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {OPERATION_OPTIONS.map((op) => {
                    const isSelected = operationType === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => handleOperationTypeChange(op.id)}
                        className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-[#FACC15] text-[#064E3B] font-black border-[#FACC15] shadow-md scale-[1.02]'
                            : 'bg-[#063327] hover:bg-[#063f30] text-slate-200 border-emerald-700/80 font-bold'
                        }`}
                      >
                        <span className="text-lg">{op.emoji}</span>
                        <span className="text-xs truncate w-full">{op.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Activity Selection */}
              <div className="pt-2 border-t border-emerald-800/60">
                <label className="block text-[11px] font-bold text-emerald-300 mb-1.5">
                  2. Selecione a Atividade Específica ({OPERATION_OPTIONS.find(o => o.id === operationType)?.label}) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableActivities.map((act) => {
                    const isSelected = activityType === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setActivityType(act.id as ActivityType)}
                        className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-600 text-white font-black border-emerald-400 shadow-sm'
                            : 'bg-[#063327] hover:bg-[#063f30] text-slate-200 border-emerald-700/80 font-semibold'
                        }`}
                      >
                        <span className="truncate">{act.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0 ml-1 text-[#FACC15]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Details Grid: Fuel Type, Station, Price, Driver, DateTime */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-3xl bg-[#04281f] border border-emerald-800/80">
              
              {/* Station Selection */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-200">
                  Local / Posto de Saída *
                </label>
                <select
                  value={gasStationId}
                  onChange={(e) => setGasStationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-700/80 bg-[#063327] text-white text-xs font-bold outline-none focus:border-[#FACC15] transition-all"
                >
                  {gasStations.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#03231b] text-white">
                      {s.name} ({s.type === 'INTERNO' ? 'Tanque Sede' : 'Externo'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fuel Type */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-200">
                  Combustível *
                </label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as FuelType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-700/80 bg-[#063327] text-[#FACC15] text-xs font-bold outline-none focus:border-[#FACC15] transition-all"
                >
                  <option value="DIESEL_S10" className="bg-[#03231b] text-white">Diesel S10</option>
                  <option value="DIESEL_S500" className="bg-[#03231b] text-white">Diesel S500</option>
                  <option value="GASOLINA_COMUM" className="bg-[#03231b] text-white">Gasolina Comum</option>
                  <option value="GASOLINA_GRID" className="bg-[#03231b] text-white">Gasolina Aditivada</option>
                  <option value="ETANOL" className="bg-[#03231b] text-white">Etanol Hidratado</option>
                  <option value="ARLA_32" className="bg-[#03231b] text-white">Arla 32</option>
                </select>
              </div>

              {/* Preço / Informação do Combustível */}
              {isExternalStation ? (
                isFuncionario ? (
                  /* FUNCIONÁRIO no Posto Externo: entrada discreta sem dados monetários (sem R$, sem R$/L, sem Preço, sem Valor Total) */
                  <div className="space-y-1.5 sm:col-span-2 p-3.5 rounded-2xl bg-[#03231b] border border-emerald-800/80">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-200">
                        Valor unitário da bomba (conforme cupom/bomba) *
                      </label>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-700/60">
                        Lançamento Externo
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={manualPricePerLiter}
                      onChange={(e) => setManualPricePerLiter(e.target.value)}
                      placeholder="Informe o valor numérico da bomba (ex: 5,89)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-700 bg-[#063327] text-slate-100 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all shadow-inner"
                    />
                    <p className="text-[10px] text-emerald-300/70">
                      Informe os dígitos indicados na bomba/comprovante para o processamento interno do lançamento.
                    </p>
                  </div>
                ) : (
                  /* ADMIN / MANUTENÇÃO no Posto Externo: digitação manual com R$ e conferência */
                  <div className="space-y-1 sm:col-span-2 p-3 rounded-2xl bg-[#03231b] border border-emerald-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-[#FACC15]" />
                        Preço do combustível (R$/L) *
                      </label>
                      <span className="text-[10px] font-black text-[#FACC15] bg-[#FACC15]/20 px-2.5 py-0.5 rounded-full border border-[#FACC15]/40 flex items-center gap-1">
                        Posto Externo • Digitação Manual Habilitada
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          value={manualPricePerLiter}
                          onChange={(e) => setManualPricePerLiter(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border-2 border-[#FACC15] bg-[#063327] text-[#FACC15] text-sm font-black outline-none focus:ring-2 focus:ring-[#FACC15]/30 transition-all shadow-inner"
                        />
                      </div>
                      <p className="text-[11px] text-emerald-300/80 leading-snug">
                        Você pode digitar livremente o preço praticado na bomba do posto externo para <strong>{getFuelTypeName(fuelType)}</strong> (ex: 5,89 / 6,12 / 6,20).
                      </p>
                    </div>
                  </div>
                )
              ) : (
                /* POSTO INTERNO: NÃO mostrar campo de digitação manual */
                !isFuncionario && (
                  <div className="space-y-1 sm:col-span-2 p-3 rounded-2xl bg-[#03231b] border border-emerald-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-950 flex items-center justify-center border border-emerald-700/60 shrink-0">
                        <Lock className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-200">
                          Posto Interno (Tanque Sede) • Preço Travado Automático
                        </p>
                        <p className="text-[11px] text-emerald-300/80">
                          Preço tabelado da fazenda: <strong className="text-[#FACC15]">{formatCurrency(baseStationPrice)}/L</strong> para {getFuelTypeName(fuelType)}. Não permite digitação manual.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-700/60 shrink-0">
                      Automático
                    </span>
                  </div>
                )
              )}

              {/* Driver / Operator */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-200">
                  Motorista / Operador *
                </label>
                <select
                  value={driverOrOperatorId}
                  onChange={(e) => setDriverOrOperatorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-700/80 bg-[#063327] text-white text-xs font-bold outline-none focus:border-[#FACC15] transition-all"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-[#03231b] text-white">
                      {u.name} ({u.department || u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-200">
                  Data e Hora do Abastecimento *
                </label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-700/80 bg-[#063327] text-white text-xs font-bold outline-none focus:border-[#FACC15] transition-all"
                />
              </div>

            </div>

            {/* 5. Metrics Bar: Role-gated */}
            {isPrivileged ? (
              /* ADMIN / MANUTENÇÃO: Exibe dados financeiros completos */
              <div className="p-4 rounded-3xl bg-gradient-to-r from-[#064E3B] to-[#043327] border-2 border-[#FACC15] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#FACC15] block">
                    Valor Total Estimado ({numLiters} L × {formatCurrency(pricePerLiter)}/L)
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {formatCurrency(metrics.totalValue)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-emerald-200">
                  {metrics.calculatedAverageKmPerLiter !== undefined && (
                    <div className="text-right">
                      <span className="block text-[10px] text-[#FACC15] font-black uppercase">Média Km/L</span>
                      <span className="text-sm font-extrabold text-white">{metrics.calculatedAverageKmPerLiter} km/L</span>
                    </div>
                  )}
                  {metrics.calculatedAverageLitersPerHour !== undefined && (
                    <div className="text-right">
                      <span className="block text-[10px] text-[#FACC15] font-black uppercase">Consumo L/h</span>
                      <span className="text-sm font-extrabold text-white">{metrics.calculatedAverageLitersPerHour} L/h</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* FUNCIONÁRIO: Exibição estritamente operacional, SEM dados financeiros */
              <div className="p-4 rounded-3xl bg-[#04281f] border border-emerald-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#FACC15] block">
                    Resumo Operacional
                  </span>
                  <span className="text-xl font-black text-white tracking-tight">
                    {numLiters} Litros Abastecidos
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-emerald-200">
                  {metrics.calculatedAverageKmPerLiter !== undefined && (
                    <div className="text-right">
                      <span className="block text-[10px] text-[#FACC15] font-black uppercase">Média Km/L</span>
                      <span className="text-sm font-extrabold text-white">{metrics.calculatedAverageKmPerLiter} km/L</span>
                    </div>
                  )}
                  {metrics.calculatedAverageLitersPerHour !== undefined && (
                    <div className="text-right">
                      <span className="block text-[10px] text-[#FACC15] font-black uppercase">Consumo L/h</span>
                      <span className="text-sm font-extrabold text-white">{metrics.calculatedAverageLitersPerHour} L/h</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Suspicious Consumption Alert if Triggered */}
            {metrics.flaggedSuspicious && (
              <div className="p-3.5 rounded-2xl bg-red-500/20 border border-red-500 text-red-200 flex items-center gap-3 text-xs font-bold">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <span>⚠️ {metrics.suspiciousReason}</span>
              </div>
            )}

            {/* 6. Observations / Custom Activity Field */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-200 flex items-center justify-between">
                <span>
                  {activityType === 'OUTRAS' || operationType === 'OUTROS'
                    ? '⭐ Atividade Personalizada / Observações'
                    : 'Observações / Localização do Talhão (Opcional)'}
                </span>
                {(activityType === 'OUTRAS' || operationType === 'OUTROS') && (
                  <span className="text-[10px] text-[#FACC15] font-bold">
                    Aparecerá nos gráficos de consumo por atividade
                  </span>
                )}
              </label>
              <input
                type="text"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder={
                  activityType === 'OUTRAS' || operationType === 'OUTROS'
                    ? 'Descreva a atividade específica (Ex: Poda especial de cerca, Manutenção de drenos, etc.)'
                    : 'Ex: Talhão 04 / Corte de grama bermuda / Início da manhã...'
                }
                className="w-full px-4 py-2.5 rounded-2xl border border-emerald-700/80 bg-[#04281f] text-white text-xs font-medium outline-none focus:border-[#FACC15] placeholder-emerald-300/40 transition-all"
              />
            </div>

            {/* 7. Modal Actions Footer */}
            <div className="pt-3 border-t border-emerald-800/60 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 min-h-[44px] rounded-2xl text-xs font-bold text-emerald-200 hover:text-white hover:bg-emerald-800/60 transition-colors border border-emerald-800/80"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!isKmBased && hourmeterValidation.isBlocking)}
                className={`px-6 py-3 min-h-[48px] rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all ${
                  isSubmitting || (!isKmBased && hourmeterValidation.isBlocking)
                    ? 'bg-slate-700 text-slate-400 border border-slate-600 cursor-not-allowed opacity-75'
                    : 'bg-[#FACC15] hover:bg-yellow-400 text-[#064E3B] shadow-yellow-500/20 active:scale-95 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-[#064E3B]" />
                    <span>Salvando Abastecimento...</span>
                  </>
                ) : !isKmBased && hourmeterValidation.isBlocking ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-300" />
                    <span>Corrija o Horímetro para Salvar</span>
                  </>
                ) : isAuthorizedCorrection && hourmeterValidation.details?.canAuthorizeCorrection ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#064E3B]" />
                    <span>Salvar com Correção Autorizada</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#064E3B]" />
                    <span>Salvar Abastecimento</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

export const FuelingFormModal = React.memo(FuelingFormModalComponent);
