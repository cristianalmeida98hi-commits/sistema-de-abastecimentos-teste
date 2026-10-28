import React, { useState, useEffect } from 'react';
import { 
  Fuel, X, AlertTriangle, CheckCircle2, History, ShieldAlert,
  ArrowDownRight, ArrowUpRight, Scale, Info
} from 'lucide-react';
import { CentralTank, TankMovement, User } from '../types';
import { getTankMovements, getTankStatus } from '../utils/storage';

interface EditCentralTankModalProps {
  isOpen: boolean;
  tank: CentralTank;
  currentUser: User;
  onClose: () => void;
  onSave: (
    tankId: string, 
    updates: { 
      capacityLiters: number; 
      currentStockLiters: number; 
      minStockAlertLiters: number; 
      notes?: string; 
    },
    reason?: string
  ) => Promise<void>;
  darkMode: boolean;
}

export const EditCentralTankModal: React.FC<EditCentralTankModalProps> = ({
  isOpen,
  tank,
  currentUser,
  onClose,
  onSave,
  darkMode
}) => {
  const currentStatus = getTankStatus(tank.id);

  // Form states initialized with live tank data
  const [capacity, setCapacity] = useState<string | number>(tank.capacityLiters || 10000);
  const [currentStock, setCurrentStock] = useState<string | number>(
    currentStatus ? currentStatus.currentStock : (tank.currentStockLiters || 0)
  );
  const [minStockAlert, setMinStockAlert] = useState<string | number>(tank.minStockAlertLiters || 2000);
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>(tank.notes || '');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Load latest movements for this tank
  const [movements, setMovements] = useState<TankMovement[]>([]);

  useEffect(() => {
    if (isOpen) {
      const freshStatus = getTankStatus(tank.id);
      setCapacity(tank.capacityLiters || 10000);
      setCurrentStock(freshStatus ? Math.round(freshStatus.currentStock * 100) / 100 : (tank.currentStockLiters || 0));
      setMinStockAlert(tank.minStockAlertLiters || 2000);
      setNotes(tank.notes || '');
      setReason('');
      setErrorMessage(null);
      setMovements(getTankMovements(tank.id));
    }
  }, [isOpen, tank]);

  if (!isOpen) return null;

  const numCapacity = Number(capacity) || 0;
  const numCurrentStock = Number(currentStock) || 0;
  const numMinStock = Number(minStockAlert) || 0;

  // Real-time automatic percentage calculation: (Quantidade Atual ÷ Capacidade Máxima) × 100
  const calculatedPercentage = numCapacity > 0 
    ? Math.round(((numCurrentStock / numCapacity) * 100) * 10) / 10 
    : 0;

  const isLow = numCurrentStock <= numMinStock;
  const isCritical = numCurrentStock <= Math.max(500, numMinStock * 0.25);

  const initialStockReference = currentStatus?.currentStock ?? tank.currentStockLiters;
  const hasStockChanged = Math.abs(numCurrentStock - initialStockReference) > 0.01;
  const stockDifference = numCurrentStock - initialStockReference;

  // Validation function
  const validateForm = (): boolean => {
    if (isNaN(numCapacity) || numCapacity <= 0) {
      setErrorMessage('A capacidade máxima deve ser um número positivo maior que zero.');
      return false;
    }
    if (isNaN(numCurrentStock) || numCurrentStock < 0) {
      setErrorMessage('A quantidade atual em estoque não pode ser negativa.');
      return false;
    }
    if (numCurrentStock > numCapacity) {
      setErrorMessage('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
      return false;
    }
    if (isNaN(numMinStock) || numMinStock < 0) {
      setErrorMessage('O estoque mínimo de alerta não pode ser negativo.');
      return false;
    }
    if (numMinStock > numCapacity) {
      setErrorMessage('O estoque mínimo de alerta não pode ser maior que a capacidade máxima do tanque.');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleStockChange = (val: string) => {
    setCurrentStock(val);
    const num = Number(val);
    if (!isNaN(num) && num > numCapacity && numCapacity > 0) {
      setErrorMessage('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
    } else if (!isNaN(num) && num < 0) {
      setErrorMessage('A quantidade atual em estoque não pode ser negativa.');
    } else {
      setErrorMessage(null);
    }
  };

  const handleCapacityChange = (val: string) => {
    setCapacity(val);
    const num = Number(val);
    if (!isNaN(num) && numCurrentStock > num && num > 0) {
      setErrorMessage('A quantidade atual não pode ser maior que a capacidade máxima do tanque.');
    } else {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSave(
        tank.id,
        {
          capacityLiters: numCapacity,
          currentStockLiters: numCurrentStock,
          minStockAlertLiters: numMinStock,
          notes
        },
        hasStockChanged ? (reason.trim() || 'Ajuste manual de calibração de estoque') : undefined
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao salvar alterações do tanque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div 
        id={`modal-edit-tank-${tank.id}`}
        className={`w-full max-w-2xl rounded-3xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden ${
          darkMode ? 'bg-[#03231b] border-emerald-800/80 text-slate-100' : 'bg-white border-emerald-100 text-gray-900'
        }`}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-emerald-900/40 flex items-center justify-between bg-emerald-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-bold shadow-md shrink-0">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                Configurar {tank.name}
              </h2>
              <p className="text-xs text-emerald-300 font-medium">
                Localização: <strong className="text-white">{tank.location}</strong> • Combustível: <span className="text-[#FACC15] font-bold">{tank.fuelType}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-colors"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Real-Time Live Status Card */}
          <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#FACC15]" />
                <span className="font-extrabold text-sm text-slate-100">Visão Geral em Tempo Real</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                isCritical 
                  ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                  : (isLow 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40')
              }`}>
                {isCritical ? '🔴 Estoque Crítico' : (isLow ? '⚠️ Estoque Baixo' : '🟢 Estoque Normal')}
              </span>
            </div>

            {/* Proportional summary requested by user */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider block">Estoque / Limite Físico</span>
                <span className="text-xl font-black text-slate-100">
                  {numCurrentStock.toLocaleString('pt-BR')} L <span className="text-emerald-400 text-sm font-semibold">/ {numCapacity.toLocaleString('pt-BR')} L</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider block">Percentual Calculado</span>
                <span className="text-2xl font-black text-[#FACC15]">
                  {calculatedPercentage}%
                </span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-3 bg-emerald-900/90 rounded-full overflow-hidden border border-emerald-800/80 p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  isCritical ? 'bg-red-500' : (isLow ? 'bg-amber-500' : 'bg-[#FACC15]')
                }`}
                style={{ width: `${Math.min(100, Math.max(0, calculatedPercentage))}%` }}
              />
            </div>

            {/* Alert banner if below minimum */}
            {isLow && (
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                isCritical 
                  ? 'bg-red-950/60 border-red-800/60 text-red-200' 
                  : 'bg-amber-950/60 border-amber-800/60 text-amber-200'
              }`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="text-[11px] leading-relaxed">
                  <strong>{isCritical ? '🔴 Alerta de Estoque Crítico' : '⚠️ Alerta de Estoque Baixo'}:</strong> O estoque atual de <strong>{numCurrentStock.toLocaleString('pt-BR')} L</strong> está abaixo do limite mínimo de <strong>{numMinStock.toLocaleString('pt-BR')} L</strong> configurado para este tanque.
                </div>
              </div>
            )}
          </div>

          {/* Validation Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-700/80 text-red-200 flex items-center gap-2.5 font-bold animate-shake">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Capacidade Máxima */}
              <div>
                <label className="block font-bold mb-1.5 text-slate-200">
                  Capacidade Máxima do Tanque (Litros) <span className="text-[#FACC15]">*</span>
                </label>
                <div className="relative">
                  <input
                    id={`input-capacity-${tank.id}`}
                    type="number"
                    required
                    min="100"
                    step="any"
                    value={capacity}
                    onChange={(e) => handleCapacityChange(e.target.value)}
                    placeholder="Ex: 10000"
                    className={`w-full p-3 rounded-xl border font-bold text-sm transition-colors ${
                      darkMode 
                        ? 'bg-emerald-950/60 border-emerald-800 text-white focus:border-[#FACC15] focus:outline-none' 
                        : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-emerald-600'
                    }`}
                  />
                  <span className="absolute right-3.5 top-3.5 text-emerald-400 font-black text-xs pointer-events-none">
                    LITROS
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400/80 mt-1">
                  Limite físico total de armazenamento do tanque.
                </p>
              </div>

              {/* Quantidade Atual em Estoque */}
              <div>
                <label className="block font-bold mb-1.5 text-slate-200">
                  Quantidade Atual em Estoque (Litros) <span className="text-[#FACC15]">*</span>
                </label>
                <div className="relative">
                  <input
                    id={`input-stock-${tank.id}`}
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={currentStock}
                    onChange={(e) => handleStockChange(e.target.value)}
                    placeholder="Ex: 6500"
                    className={`w-full p-3 rounded-xl border font-black text-sm transition-colors ${
                      darkMode 
                        ? 'bg-emerald-950/60 border-emerald-800 text-[#FACC15] focus:border-[#FACC15] focus:outline-none' 
                        : 'bg-gray-50 border-gray-300 text-emerald-800 focus:border-emerald-600'
                    }`}
                  />
                  <span className="absolute right-3.5 top-3.5 text-[#FACC15] font-black text-xs pointer-events-none">
                    LITROS
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400/80 mt-1">
                  Volume de combustível físico existente neste momento.
                </p>
              </div>
            </div>

            {/* Estoque Mínimo para Alerta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block font-bold mb-1.5 text-slate-200">
                  Estoque Mínimo para Alerta (Litros)
                </label>
                <div className="relative">
                  <input
                    id={`input-min-alert-${tank.id}`}
                    type="number"
                    min="0"
                    step="any"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                    placeholder="Padrão: 2000"
                    className={`w-full p-3 rounded-xl border font-bold text-xs ${
                      darkMode 
                        ? 'bg-emerald-950/60 border-emerald-800 text-amber-300 focus:border-[#FACC15] focus:outline-none' 
                        : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                  <span className="absolute right-3.5 top-3.5 text-amber-400 font-bold text-xs pointer-events-none">
                    LITROS
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400/80 mt-1">
                  Dispara alerta no sistema quando o estoque for menor ou igual a este valor.
                </p>
              </div>

              <div>
                <label className="block font-bold mb-1.5 text-slate-200">
                  Observações / Detalhes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Tanque com filtro coalescente e bomba digital..."
                  className={`w-full p-3 rounded-xl border text-xs ${
                    darkMode 
                      ? 'bg-emerald-950/60 border-emerald-800 text-white focus:border-[#FACC15] focus:outline-none' 
                      : 'bg-gray-50 border-gray-300'
                  }`}
                />
                <p className="text-[10px] text-emerald-400/80 mt-1">
                  Informações técnicas ou operacionais do ponto de abastecimento.
                </p>
              </div>
            </div>

            {/* Se o estoque foi alterado manualmente: Campo obrigatório/recomendado de Justificativa de Ajuste */}
            {hasStockChanged && (
              <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-700/60 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-amber-300 font-extrabold text-xs">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>Registro de Ajuste Manual de Estoque</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    stockDifference > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    Diferença: {stockDifference > 0 ? `+${stockDifference.toLocaleString('pt-BR')}` : stockDifference.toLocaleString('pt-BR')} L
                  </span>
                </div>

                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  A alteração manual do estoque será registrada no histórico de auditoria e movimentações com data, hora, usuário responsável (<strong>{currentUser.name}</strong>) e volumes anterior e posterior.
                </p>

                <div>
                  <label className="block font-bold mb-1 text-amber-200 text-xs">
                    Motivo / Justificativa do Ajuste <span className="text-[#FACC15]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Medição física com régua de nível, acerto de inventário mensal..."
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold ${
                      darkMode ? 'bg-emerald-950 border-amber-600/60 text-white' : 'bg-white border-amber-300'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Toggle History of Movements */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-[#FACC15] font-extrabold hover:underline flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                {showHistory ? 'Ocultar Histórico de Movimentações' : `Ver Histórico de Movimentações deste Tanque (${movements.length})`}
              </button>

              {showHistory && (
                <div className="mt-3 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-900/80 max-h-48 overflow-y-auto space-y-2">
                  {movements.length === 0 ? (
                    <p className="text-center text-emerald-400 py-3 font-medium text-[11px]">
                      Nenhuma movimentação registrada recentemente para este tanque.
                    </p>
                  ) : (
                    movements.map(m => {
                      const isEntry = m.type === 'ENTRADA';
                      const isAjuste = m.type === 'AJUSTE_MANUAL';
                      return (
                        <div 
                          key={m.id}
                          className="p-2.5 rounded-xl bg-emerald-900/40 border border-emerald-800/40 flex items-start justify-between gap-2 text-[11px]"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <div className={`p-1 rounded-lg shrink-0 ${
                              isEntry 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : (isAjuste ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300')
                            }`}>
                              {isEntry ? <ArrowDownRight className="w-3.5 h-3.5" /> : (isAjuste ? <Scale className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate">
                                {isEntry ? 'Recebimento de Combustível' : (isAjuste ? 'Ajuste Manual de Estoque' : `Abastecimento (${m.equipmentName || 'Máquina'})`)}
                              </span>
                              <span className="text-[10px] text-emerald-400 block">
                                {new Date(m.dateTime).toLocaleString('pt-BR')} • por {m.userName}
                              </span>
                              {m.notes && (
                                <p className="text-[10px] text-emerald-300/80 mt-0.5 truncate">
                                  {m.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`font-black block ${
                              isEntry ? 'text-emerald-400' : (isAjuste ? 'text-amber-300' : 'text-slate-100')
                            }`}>
                              {isEntry ? `+${m.liters.toLocaleString('pt-BR')} L` : (isAjuste ? `${m.liters.toLocaleString('pt-BR')} L` : `-${m.liters.toLocaleString('pt-BR')} L`)}
                            </span>
                            <span className="text-[10px] text-emerald-400">
                              Saldo: {m.afterStock.toLocaleString('pt-BR')} L
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-emerald-900/40 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !!errorMessage}
                className="px-6 py-2.5 rounded-xl bg-[#FACC15] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Configuração</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
