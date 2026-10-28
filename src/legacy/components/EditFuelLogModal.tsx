import React, { useState, useEffect, useMemo } from 'react';
import { X, Fuel, AlertCircle, CheckCircle2, Lock, Save, Loader2 } from 'lucide-react';
import { FuelLog, GasStation, User, OperationType, ActivityType } from '../types';
import { 
  formatCurrency, formatDateTimeBR, getFuelTypeName, 
  OPERATION_OPTIONS, getActivitiesForOperation 
} from '../utils/calculations';

interface EditFuelLogModalProps {
  isOpen: boolean;
  log: FuelLog | null;
  gasStations: GasStation[];
  currentUser: User;
  onClose: () => void;
  onSave: (id: string, updatedFields: Partial<FuelLog>) => Promise<void> | void;
  darkMode?: boolean;
}

export const EditFuelLogModal: React.FC<EditFuelLogModalProps> = ({
  isOpen,
  log,
  gasStations,
  currentUser,
  onClose,
  onSave,
  darkMode = true,
}) => {
  // Permission verification: only ADMIN and MANUTENCAO are allowed
  const isAuthorized = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANUTENCAO';

  // Local form state - using raw strings for decimal inputs to guarantee 100% fluid typing on mobile & desktop
  const [litersInput, setLitersInput] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('');
  const [operationType, setOperationType] = useState<OperationType>('GRAMA');
  const [activityType, setActivityType] = useState<ActivityType>('CORTE');
  const [observations, setObservations] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset inputs when a new log is selected
  useEffect(() => {
    if (log && isOpen) {
      setLitersInput(log.liters !== undefined ? String(log.liters).replace('.', ',') : '');
      setPriceInput(log.pricePerLiter !== undefined ? String(log.pricePerLiter).replace('.', ',') : '');
      setOperationType((log.operationType || 'GRAMA') as OperationType);
      let initialAct = (log.activityType || 'CORTE') as ActivityType;
      if (log.operationType === 'CANA') {
        if (initialAct === 'CARREGAMENTO_CANA') initialAct = 'ADUBACAO_CANA';
        if (initialAct === 'TRANSBORDO') initialAct = 'ENLEIRAMENTO_PALHA';
      }
      setActivityType(initialAct);
      setObservations(log.observations || '');
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [log, isOpen]);

  // Available activities for selected operation
  const availableActivities = useMemo(() => {
    return getActivitiesForOperation(operationType);
  }, [operationType]);

  const handleOperationChange = (newOp: OperationType) => {
    setOperationType(newOp);
    const acts = getActivitiesForOperation(newOp);
    setActivityType((acts[0]?.id || 'OUTRAS') as ActivityType);
  };

  // Safe decimal parser that handles both ',' and '.'
  const parseDecimal = (val: string): number => {
    if (!val) return 0;
    const cleaned = val.trim().replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Live recalculated metrics - does not mutate anything, strictly calculates for live preview
  const parsedLiters = parseDecimal(litersInput);
  const parsedPrice = parseDecimal(priceInput);
  const liveTotalValue = Number((parsedLiters * parsedPrice).toFixed(2));

  if (!isOpen || !log) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // Strict Permission check
    if (!isAuthorized) {
      setErrorMessage('Acesso negado: Somente Administrador e Manutenção têm permissão para editar registros de abastecimento.');
      return;
    }

    // Input validation
    if (parsedLiters <= 0) {
      setErrorMessage('Informe uma quantidade válida de litros abastecidos.');
      return;
    }

    if (parsedPrice < 0) {
      setErrorMessage('Informe um preço por litro válido.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onSave(log.id, {
        liters: parsedLiters,
        pricePerLiter: parsedPrice,
        totalValue: liveTotalValue,
        operationType,
        activityType,
        observations: observations.trim()
      });
      onClose();
    } catch (err: any) {
      console.error('[EditFuelLogModal Error]', err);
      setErrorMessage(err?.message || 'Erro ao salvar alterações no abastecimento. Tente novamente.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className={`w-full max-w-lg rounded-3xl shadow-2xl border p-5 sm:p-6 max-h-[92vh] overflow-y-auto space-y-4 animate-in zoom-in-95 duration-150 ${
          darkMode ? 'bg-[#04281f] border-emerald-800/80 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3.5 border-emerald-800/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Editar Registro de Abastecimento
              </h3>
              <p className="text-[11px] text-emerald-400/80 font-medium">
                Altere o preço do combustível ou dados deste abastecimento
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security / RBAC Banner */}
        {!isAuthorized ? (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <strong className="block font-bold">Acesso Restrito</strong>
              <span>Somente perfis <strong>Administrador</strong> e <strong>Manutenção</strong> podem editar abastecimentos concluídos.</span>
            </div>
          </div>
        ) : null}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Equipment Identification Info (Read-only reference) */}
        <div className={`p-3.5 rounded-2xl border space-y-1 text-xs ${
          darkMode ? 'bg-black/30 border-emerald-900/60' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              Equipamento Vinculado
            </span>
            <span className="text-[10px] text-slate-400">
              {formatDateTimeBR(log.dateTime)}
            </span>
          </div>
          <p className="text-sm font-extrabold text-white">
            {log.equipmentName}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-80 pt-0.5">
            <span>Placa/Cód: <strong>{log.equipmentPlateOrCode}</strong></span>
            <span>•</span>
            <span>Posto: <strong>{log.gasStationName}</strong></span>
            <span>•</span>
            <span>Combustível: <strong>{getFuelTypeName(log.fuelType)}</strong></span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Operation & Activity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1 text-emerald-200">
                Tipo de Operação *
              </label>
              <select
                disabled={!isAuthorized || isSaving}
                value={operationType}
                onChange={(e) => handleOperationChange(e.target.value as OperationType)}
                className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                  darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white' : 'bg-gray-50 text-slate-900'
                } disabled:opacity-50`}
              >
                {OPERATION_OPTIONS.map(op => (
                  <option key={op.id} value={op.id}>{op.emoji} {op.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1 text-emerald-200">
                Atividade *
              </label>
              <select
                disabled={!isAuthorized || isSaving}
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ActivityType)}
                className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                  darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white' : 'bg-gray-50 text-slate-900'
                } disabled:opacity-50`}
              >
                {availableActivities.map(act => (
                  <option key={act.id} value={act.id}>{act.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Liters and Price inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Liters */}
            <div>
              <label className="block font-bold mb-1 text-emerald-200">
                Litros Abastecidos *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  disabled={!isAuthorized || isSaving}
                  value={litersInput}
                  onChange={(e) => setLitersInput(e.target.value)}
                  placeholder="Ex: 120,5"
                  className={`w-full p-2.5 pr-8 rounded-xl border font-black text-sm ${
                    darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white focus:border-amber-400' : 'bg-gray-50 border-gray-300 text-slate-900'
                  } outline-hidden transition-all disabled:opacity-50`}
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  L
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Aceita vírgula ou ponto (ex: 150,0)
              </span>
            </div>

            {/* Price Per Liter */}
            <div>
              <label className="block font-bold mb-1 text-emerald-200">
                Preço por Litro (R$) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  disabled={!isAuthorized || isSaving}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Ex: 6,45"
                  className={`w-full p-2.5 pr-8 rounded-xl border font-black text-sm text-amber-400 ${
                    darkMode ? 'bg-emerald-950/60 border-emerald-800 focus:border-amber-400' : 'bg-gray-50 border-gray-300'
                  } outline-hidden transition-all disabled:opacity-50`}
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-amber-500">
                  R$
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Aceita vírgula ou ponto (ex: 6,50 ou 6.50)
              </span>
            </div>
          </div>

          {/* Dynamic Dependent Recalculation Card */}
          <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
            darkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold opacity-90">Recálculo Automático do Abastecimento</span>
              <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40">
                Afeta somente este registro
              </span>
            </div>
            
            <div className="flex items-baseline justify-between pt-1">
              <div className="text-[11px] opacity-80">
                <span>{parsedLiters.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} L</span>
                <span className="mx-1.5">×</span>
                <span>R$ {parsedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}/L</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] block opacity-75 font-semibold">Novo Valor Total</span>
                <span className="text-base sm:text-lg font-black text-amber-400">
                  {formatCurrency(liveTotalValue)}
                </span>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className="block font-bold mb-1 text-emerald-200">
              Observações do Abastecimento
            </label>
            <textarea
              rows={2}
              disabled={!isAuthorized || isSaving}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Descreva correções ou justificativas da alteração..."
              className={`w-full p-2.5 rounded-xl border text-xs ${
                darkMode ? 'bg-emerald-950/60 border-emerald-800 text-white placeholder-emerald-700' : 'bg-gray-50 border-gray-300'
              } outline-hidden transition-all disabled:opacity-50`}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-emerald-800/30">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-emerald-800/60 hover:bg-emerald-500/10 text-emerald-200 font-bold text-xs transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isAuthorized || isSaving}
              className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                !isAuthorized || isSaving
                  ? 'bg-amber-500/40 text-slate-900 cursor-not-allowed opacity-60'
                  : 'bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando Alterações...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
