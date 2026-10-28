import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wrench, Plus, Search, Filter, Calendar, CheckCircle2, 
  Clock, AlertTriangle, DollarSign, X, FileText, ChevronRight,
  Edit, Trash2, Droplets
} from 'lucide-react';
import { MaintenanceLog, MaintenanceType, Vehicle, User, canEditSystemData } from '../types';
import { formatCurrency, formatDateBR, getTodayDateSaoPaulo, createTimestampForDateSaoPaulo, getNowSaoPauloISO } from '../utils/calculations';

interface MaintenanceViewProps {
  maintenanceLogs: MaintenanceLog[];
  vehicles: Vehicle[];
  users: User[];
  currentUser: User;
  onAddMaintenance: (m: Omit<MaintenanceLog, 'id'>) => void;
  onUpdateMaintenance: (id: string, fields: Partial<MaintenanceLog>) => void;
  onDeleteMaintenance?: (id: string) => void;
  darkMode: boolean;
  highlightedMaintenanceId?: string | null;
  initialEquipmentId?: string | null;
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  onClearHighlight?: () => void;
}

export const MaintenanceViewComponent: React.FC<MaintenanceViewProps> = ({
  maintenanceLogs,
  vehicles,
  users,
  currentUser,
  onAddMaintenance,
  onUpdateMaintenance,
  onDeleteMaintenance,
  darkMode,
  highlightedMaintenanceId,
  initialEquipmentId,
  onOpenDigitalSheet,
  onClearHighlight
}) => {
  const canManageMaintenance = currentUser.role === 'MANUTENCAO';
  const canAdd = canEditSystemData(currentUser.role);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState(() => {
    if (initialEquipmentId) {
      const eq = vehicles.find(v => v.id === initialEquipmentId || v.licensePlate === initialEquipmentId || v.patrimonyCode === initialEquipmentId);
      return eq ? (eq.patrimonyCode || eq.licensePlate || eq.model) : '';
    }
    return '';
  });
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(highlightedMaintenanceId || null);
  const highlightedRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightedMaintenanceId) {
      setActiveHighlightId(highlightedMaintenanceId);
      setTimeout(() => {
        if (highlightedRef.current) {
          highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);

      const timer = setTimeout(() => {
        setActiveHighlightId(null);
        if (onClearHighlight) onClearHighlight();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [highlightedMaintenanceId, onClearHighlight]);

  // Form State
  const [equipmentId, setEquipmentId] = useState(vehicles[0]?.id || '');
  const [date, setDate] = useState(() => getTodayDateSaoPaulo());
  const [type, setType] = useState<MaintenanceType>('REVISAO');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kmOrHourAtService, setKmOrHourAtService] = useState<number>(0);
  const [nextServiceKmOrHour, setNextServiceKmOrHour] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [supplierOrWorkshop, setSupplierOrWorkshop] = useState('Oficina Interna AndradeAgro');
  const [performedBy, setPerformedBy] = useState(currentUser.name || users[0]?.name || 'Técnico Responsável');
  const [notes, setNotes] = useState('');

  // Sync hourmeter/km whenever selected equipment changes in form
  useEffect(() => {
    if (!editingId && equipmentId) {
      const eq = vehicles.find(v => v.id === equipmentId);
      if (eq) {
        const val = eq.currentHourmeter || eq.currentKm || 0;
        const isKm = eq.category === 'VEICULO' || eq.maintenanceControlType === 'QUILOMETRAGEM';
        const interval = isKm 
          ? (Number(eq.maintenanceIntervalKm) || 10000)
          : (Number(eq.maintenanceIntervalHours) || Number(eq.oilChangeIntervalHours) || 300);
        setKmOrHourAtService(val);
        setNextServiceKmOrHour(val + interval);
      }
    }
  }, [equipmentId, editingId, vehicles]);

  const handleOpenAdd = () => {
    setEditingId(null);
    const firstEq = vehicles[0];
    const initialMeter = firstEq ? (firstEq.currentHourmeter || firstEq.currentKm || 0) : 0;
    const isKm = firstEq?.category === 'VEICULO' || firstEq?.maintenanceControlType === 'QUILOMETRAGEM';
    const interval = isKm 
      ? (Number(firstEq?.maintenanceIntervalKm) || 10000)
      : (Number(firstEq?.maintenanceIntervalHours) || Number(firstEq?.oilChangeIntervalHours) || 300);

    setEquipmentId(firstEq?.id || '');
    setDate(getTodayDateSaoPaulo());
    setType('REVISAO');
    setTitle('');
    setDescription('');
    setKmOrHourAtService(initialMeter);
    setNextServiceKmOrHour(initialMeter + interval);
    setCost(0);
    setSupplierOrWorkshop('Oficina Interna AndradeAgro');
    setPerformedBy(currentUser.name || 'Técnico Responsável');
    setNotes('');
    setShowModal(true);
  };

  const handleOpenEdit = (m: MaintenanceLog) => {
    if (!canManageMaintenance) {
      alert('Acesso negado: Somente usuários com perfil de MANUTENÇÃO possuem permissão para editar registros de manutenção.');
      return;
    }
    const eq = vehicles.find(v => v.id === m.equipmentId);
    const isKm = eq?.category === 'VEICULO' || eq?.maintenanceControlType === 'QUILOMETRAGEM';
    const interval = isKm 
      ? (Number(eq?.maintenanceIntervalKm) || 10000)
      : (Number(eq?.maintenanceIntervalHours) || Number(eq?.oilChangeIntervalHours) || 300);

    setEditingId(m.id);
    setEquipmentId(m.equipmentId);
    setDate(m.date);
    setType(m.type);
    setTitle(m.title);
    setDescription(m.description);
    setKmOrHourAtService(m.kmOrHourAtService);
    setNextServiceKmOrHour(m.nextServiceKmOrHour || (m.kmOrHourAtService + interval));
    setCost(m.cost);
    setSupplierOrWorkshop(m.supplierOrWorkshop || 'Oficina Interna');
    setPerformedBy(m.performedBy || currentUser.name);
    setNotes(m.notes || '');
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (!canManageMaintenance) {
      alert('Acesso negado: Somente usuários com perfil de MANUTENÇÃO possuem permissão para excluir registros de manutenção.');
      return;
    }
    const target = maintenanceLogs.find(m => m.id === id);
    const msg = target 
      ? `Tem certeza que deseja excluir o registro de manutenção "${target.title}" do equipamento ${target.equipmentName} (${target.equipmentPlateOrCode})?\n\nEsta ação é definitiva e recalibrará os contadores se for uma troca de óleo.`
      : 'Tem certeza que deseja excluir este registro de manutenção?';

    if (confirm(msg)) {
      if (onDeleteMaintenance) {
        onDeleteMaintenance(id);
      }
    }
  };

  const filteredLogs = useMemo(() => {
    return maintenanceLogs.filter(m => {
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchEquip = m.equipmentName.toLowerCase().includes(q);
        const matchPlate = m.equipmentPlateOrCode.toLowerCase().includes(q);
        if (!matchTitle && !matchEquip && !matchPlate) return false;
      }
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'OIL_CHANGE') {
          const isOil = m.type === 'TROCA_OLEO' || m.type === 'TROCA_FILTROS' || 
                        m.title.toLowerCase().includes('óleo') || m.title.toLowerCase().includes('oleo');
          if (!isOil) return false;
        } else if (m.type !== typeFilter) {
          return false;
        }
      }
      return true;
    });
  }, [maintenanceLogs, search, typeFilter]);

  const totalMaintenanceCost = filteredLogs.reduce((acc, m) => acc + m.cost, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && !canManageMaintenance) {
      alert('Acesso negado: Somente usuários com perfil de MANUTENÇÃO possuem permissão para alterar registros de manutenção.');
      return;
    }
    const eq = vehicles.find(v => v.id === equipmentId);
    if (!eq) return;

    const safeDateTime = createTimestampForDateSaoPaulo(date);

    if (editingId) {
      onUpdateMaintenance(editingId, {
        equipmentId: eq.id,
        equipmentName: eq.model,
        equipmentPlateOrCode: eq.licensePlate || eq.patrimonyCode || 'S/PLACA',
        date,
        dateTime: safeDateTime,
        type,
        title,
        description,
        kmOrHourAtService,
        nextServiceKmOrHour: nextServiceKmOrHour || undefined,
        cost,
        supplierOrWorkshop,
        performedBy,
        notes
      });
    } else {
      onAddMaintenance({
        equipmentId: eq.id,
        equipmentName: eq.model,
        equipmentPlateOrCode: eq.licensePlate || eq.patrimonyCode || 'S/PLACA',
        date,
        dateTime: safeDateTime,
        createdAt: getNowSaoPauloISO(),
        type,
        title,
        description,
        kmOrHourAtService,
        nextServiceKmOrHour: nextServiceKmOrHour || undefined,
        cost,
        supplierOrWorkshop,
        performedBy,
        status: 'CONCLUIDO',
        notes
      });
    }

    setShowModal(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-500" />
            Controle de Manutenções & Revisões
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Histórico de serviços, trocas de óleo, preventivas e registros de manutenção das máquinas.
          </p>
        </div>

        {canAdd && (
          <button
            onClick={handleOpenAdd}
            className="bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-black text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#FACC15]" />
            <span>Cadastrar Manutenção</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase">Total de Manutenções</span>
          <p className="text-xl font-black text-gray-900 dark:text-emerald-100">{filteredLogs.length}</p>
        </div>
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase font-mono">Últimas Trocas de Óleo</span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400">
            {maintenanceLogs.filter(m => m.type === 'TROCA_OLEO' || m.title.toLowerCase().includes('óleo')).length}
          </p>
        </div>
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase">Custo Total Registrado</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalMaintenanceCost)}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`p-4 rounded-2xl border space-y-3 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por título, máquina ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none ${
                darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border outline-none font-bold text-xs ${
                darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <option value="ALL">Todos os Tipos de Serviços</option>
              <option value="OIL_CHANGE">🛢️ Apenas Trocas de Óleo & Filtros</option>
              <option value="REVISAO">🔧 Revisões Preventivas</option>
              <option value="TROCA_OLEO">Troca de Óleo</option>
              <option value="TROCA_FILTROS">Troca de Filtros</option>
              <option value="PNEUS">Pneus / Esteiras</option>
              <option value="SERVICO_CORRETIVO">Serviços Corretivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Maintenance Logs List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border border-dashed rounded-2xl">
            Nenhum registro de manutenção encontrado.
          </div>
        ) : (
          filteredLogs.map(m => {
            const isHighlighted = !!activeHighlightId && (
              m.id === activeHighlightId ||
              m.equipmentId === activeHighlightId ||
              (m.title && activeHighlightId.includes(m.id))
            );
            const targetVehicle = vehicles.find(v => v.id === m.equipmentId);

            return (
              <div
                key={m.id}
                ref={isHighlighted ? highlightedRef : undefined}
                className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
                  isHighlighted
                    ? 'ring-2 ring-[#FACC15] shadow-lg shadow-amber-500/20 bg-amber-500/15 border-[#FACC15]'
                    : darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    {m.type === 'TROCA_OLEO' ? <Droplets className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 uppercase">
                        {m.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-emerald-400 font-medium">
                        🗓️ {formatDateBR(m.date)}
                      </span>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        ⏱️ {m.kmOrHourAtService} h/km
                      </span>
                      {isHighlighted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-[#FACC15] text-slate-950 animate-pulse">
                          🔧 Registro da Notificação
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100">
                      {m.title}
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                      🚜 {m.equipmentName} ({m.equipmentPlateOrCode})
                    </p>
                    <p className="text-xs text-gray-600 dark:text-emerald-200/90">
                      {m.description}
                    </p>
                    {m.notes && (
                      <p className="text-[11px] italic text-slate-500 dark:text-emerald-300">
                        Obs: {m.notes}
                      </p>
                    )}
                    <div className="text-[10px] text-gray-400 pt-0.5">
                      Mecânico: <strong>{m.performedBy || 'Não informado'}</strong> | Oficina: <strong>{m.supplierOrWorkshop || 'Interna'}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-emerald-800/10">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 dark:text-emerald-400 block">Custo</span>
                    <span className="font-black text-sm text-gray-900 dark:text-emerald-100">{formatCurrency(m.cost)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      m.status === 'CONCLUIDO' 
                        ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                        : m.status === 'EM_ANDAMENTO' 
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {m.status}
                    </span>

                    {targetVehicle && onOpenDigitalSheet && (
                      <button
                        onClick={() => onOpenDigitalSheet(targetVehicle)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-800/40 hover:bg-emerald-800/70 text-emerald-200 text-xs font-bold transition-colors"
                        title={`Abrir ficha de ${targetVehicle.model}`}
                      >
                        Ficha Técnica
                      </button>
                    )}

                    {/* Maintenance role Controls - Exclusivo Perfil MANUTENCAO */}
                    {canManageMaintenance && (
                      <div className="flex items-center gap-1 pl-2 border-l border-emerald-800/20">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="p-1.5 rounded-lg bg-emerald-800/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-800/40 transition-colors"
                          title="Editar Manutenção (Exclusivo Manutenção)"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteMaintenance && (
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 rounded-lg bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-500/40 transition-colors"
                            title="Excluir Manutenção (Exclusivo Manutenção)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New/Edit Maintenance Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-lg rounded-3xl shadow-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-[#042d23] border-emerald-900 text-slate-100' : 'bg-white border-slate-200 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-extrabold text-sm text-[#FACC15] flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                <span>{editingId ? 'Editar Registro de Manutenção' : 'Registrar Manutenção / Serviço'}</span>
              </span>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-emerald-500/10">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Máquina / Equipamento *</label>
                <select
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      [{v.category}] {v.model} ({v.licensePlate || v.patrimonyCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Data do Serviço *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Tipo de Serviço *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MaintenanceType)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs outline-none ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    <option value="REVISAO">Revisão Preventiva</option>
                    <option value="TROCA_OLEO">Troca de Óleo</option>
                    <option value="TROCA_FILTROS">Troca de Filtros</option>
                    <option value="PNEUS">Pneus / Esteiras</option>
                    <option value="SERVICO_CORRETIVO">Serviço Corretivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Título do Serviço / Resumo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de óleo 15W40 e filtro separador"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Horímetro / KM Atual *</label>
                  <input
                    type="number"
                    required
                    value={kmOrHourAtService}
                    onChange={(e) => setKmOrHourAtService(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Próxima Revisão (KM/Horas)</label>
                  <input
                    type="number"
                    value={nextServiceKmOrHour}
                    onChange={(e) => setNextServiceKmOrHour(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Mecânico / Responsável</label>
                  <input
                    type="text"
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Custo do Serviço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2.5 rounded-xl border outline-none ${
                      darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Descrição Detalhada do Serviço</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhamento das peças substituídas, óleo utilizado, etc..."
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Observações Adicionais</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Verificar reaperto após 50 horas de operação..."
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-emerald-800/20">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:bg-emerald-500/10 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#064E3B] hover:bg-[#043d2e] text-[#FACC15] font-extrabold shadow-md"
                >
                  {editingId ? 'Atualizar Registro' : 'Gravar Manutenção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export const MaintenanceView = React.memo(MaintenanceViewComponent);

