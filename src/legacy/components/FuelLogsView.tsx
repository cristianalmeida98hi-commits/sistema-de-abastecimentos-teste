import React, { useState, useMemo } from 'react';
import { 
  Fuel, Search, Filter, Download, FileSpreadsheet, FileText, Printer, 
  Trash2, Edit3, Eye, AlertCircle, CheckCircle2, ChevronRight, X, Calendar, User as UserIcon, Lock
} from 'lucide-react';
import { FuelLog, Vehicle, GasStation, User, UserRole, SystemSettings, OperationType, ActivityType, canEditSystemData } from '../types';
import { 
  formatCurrency, formatDateTimeBR, getFuelTypeName, exportFuelLogsPDF, exportFuelLogsExcelWithCharts, exportFuelLogsCSV,
  getOperationTypeName, getActivityTypeName, OPERATION_OPTIONS, getActivitiesForOperation
} from '../utils/calculations';
import { EditFuelLogModal } from './EditFuelLogModal';

interface FuelLogsViewProps {
  fuelLogs: FuelLog[];
  vehicles: Vehicle[];
  gasStations: GasStation[];
  users: User[];
  currentUser: User;
  settings: SystemSettings;
  onOpenFuelingModal: () => void;
  onUpdateFuelLog: (id: string, log: Partial<FuelLog>) => Promise<void> | void;
  onDeleteFuelLog: (id: string) => void;
  darkMode?: boolean;
  searchQuery: string;
}

export const FuelLogsViewComponent: React.FC<FuelLogsViewProps> = ({
  fuelLogs = [],
  vehicles = [],
  gasStations = [],
  users = [],
  currentUser,
  settings,
  onOpenFuelingModal,
  onUpdateFuelLog,
  onDeleteFuelLog,
  darkMode = true,
  searchQuery
}) => {
  // Filters
  const [localSearch, setLocalSearch] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');
  const [selectedFuelType, setSelectedFuelType] = useState<string>('ALL');
  const [selectedOperationType, setSelectedOperationType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Drawer / Inspector
  const [inspectingLog, setInspectingLog] = useState<FuelLog | null>(null);

  // Edit Modal State - lightweight reference, isolated editing in EditFuelLogModal
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);

  // Combined Search
  const activeSearch = searchQuery || localSearch;

  // Filter Logic
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      // Search
      if (activeSearch) {
        const q = activeSearch.toLowerCase();
        const matchName = log.equipmentName.toLowerCase().includes(q);
        const matchPlate = log.equipmentPlateOrCode.toLowerCase().includes(q);
        const matchDriver = log.driverOrOperatorName.toLowerCase().includes(q);
        const matchStation = log.gasStationName.toLowerCase().includes(q);
        if (!matchName && !matchPlate && !matchDriver && !matchStation) return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && log.equipmentCategory !== selectedCategory) return false;

      // Equipment
      if (selectedEquipmentId !== 'ALL' && log.equipmentId !== selectedEquipmentId) return false;

      // Driver
      if (selectedDriverId !== 'ALL' && log.driverOrOperatorId !== selectedDriverId) return false;

      // Station
      if (selectedStationId !== 'ALL' && log.gasStationId !== selectedStationId) return false;

      // Fuel Type
      if (selectedFuelType !== 'ALL' && log.fuelType !== selectedFuelType) return false;

      // Operation Type
      if (selectedOperationType !== 'ALL' && (log.operationType || 'GRAMA') !== selectedOperationType) return false;

      // Dates
      if (startDate && log.dateTime.slice(0, 10) < startDate) return false;
      if (endDate && log.dateTime.slice(0, 10) > endDate) return false;

      return true;
    });
  }, [
    fuelLogs, activeSearch, selectedCategory, selectedEquipmentId, 
    selectedDriverId, selectedStationId, selectedFuelType, selectedOperationType, startDate, endDate
  ]);

  // Aggregates memoized in single pass
  const { totalLiters, totalCost, avgPrice } = useMemo(() => {
    let liters = 0;
    let cost = 0;
    for (let i = 0; i < filteredLogs.length; i++) {
      liters += filteredLogs[i].liters || 0;
      cost += filteredLogs[i].totalValue || 0;
    }
    return {
      totalLiters: liters,
      totalCost: cost,
      avgPrice: liters > 0 ? cost / liters : 0
    };
  }, [filteredLogs]);

  // Check if user can edit this log - STRICT PERMISSION: only ADMINISTRADOR and MANUTENCAO
  const canEditLog = (log?: FuelLog | null): boolean => {
    return currentUser.role === 'ADMIN' || currentUser.role === 'MANUTENCAO';
  };

  const canViewFinancial = currentUser.role === 'ADMIN' || currentUser.role === 'MANUTENCAO';

  const handleOpenEdit = (log: FuelLog) => {
    if (!canEditLog(log)) {
      alert('Acesso negado: Somente perfis Administrador e Manutenção possuem autorização para editar registros de abastecimento.');
      return;
    }
    setEditingLog(log);
  };

  const handleSaveEdit = async (id: string, updatedFields: Partial<FuelLog>) => {
    if (!canEditLog()) {
      throw new Error('Acesso negado: Somente Administrador e Manutenção têm permissão para editar abastecimentos.');
    }
    await onUpdateFuelLog(id, updatedFields);
  };

  const handleExportPDF = () => {
    exportFuelLogsPDF(
      filteredLogs,
      'Relatório Geral de Abastecimentos AndradeAgro',
      { name: settings.companyName, slogan: settings.slogan, cnpj: settings.cnpj },
      canViewFinancial,
      {
        vehicles,
        appliedFiltersDesc: 'Registro Geral de Abastecimentos',
        dateRangeStr: 'Período Completo'
      }
    );
  };

  const handleExportExcel = () => {
    exportFuelLogsExcelWithCharts({
      logs: filteredLogs,
      vehicles,
      companyInfo: { name: settings.companyName, slogan: settings.slogan, cnpj: settings.cnpj },
      dateRangeStr: 'Período Completo',
      canViewFinancial,
      appliedFiltersDesc: 'Registro Geral de Abastecimentos'
    });
  };

  const handleExportCSV = () => {
    exportFuelLogsCSV(filteredLogs, 'Abastecimentos_AndradeAgro');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Fuel className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Registro de Abastecimentos
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Controle de consumo, quilometragem, horímetros e acompanhamento de abastecimentos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenFuelingModal}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5"
          >
            + Novo Abastecimento
          </button>
          <button
            onClick={handleExportPDF}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Exportar PDF com tabela e gráficos analíticos"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF com Gráficos</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Exportar planilha Excel (.xlsx) com tabela e gráficos incorporados"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel com Gráficos</span>
          </button>
          <button
            onClick={handleExportCSV}
            className={`px-3 py-2 rounded-xl font-bold text-xs border flex items-center gap-1.5 ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-emerald-200' : 'bg-white border-gray-200 text-gray-700'
            }`}
            title="Exportar CSV de dados"
          >
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-xl border ${
          darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
        }`}>
          <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 uppercase">Registros</span>
          <p className="text-lg font-black text-gray-900 dark:text-emerald-100">{filteredLogs.length}</p>
        </div>
        <div className={`p-3.5 rounded-xl border ${
          darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
        }`}>
          <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 uppercase">Litros Filtrados</span>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{totalLiters.toLocaleString('pt-BR')} L</p>
        </div>
        <div className={`p-3.5 rounded-xl border ${
          darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
        }`}>
          <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 uppercase">Valor Total</span>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400">{formatCurrency(totalCost)}</p>
        </div>
        <div className={`p-3.5 rounded-xl border ${
          darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
        }`}>
          <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 uppercase">Preço Médio/L</span>
          <p className="text-lg font-black text-gray-900 dark:text-emerald-100">{formatCurrency(avgPrice)}</p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className={`p-4 rounded-2xl border space-y-3 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xs text-gray-800 dark:text-emerald-200">
            <Filter className="w-4 h-4 text-amber-500" />
            <span>Filtros Inteligentes de Pesquisa</span>
          </div>
          {(selectedEquipmentId !== 'ALL' || selectedCategory !== 'ALL' || selectedDriverId !== 'ALL' || startDate || endDate) && (
            <button
              onClick={() => {
                setLocalSearch('');
                setSelectedEquipmentId('ALL');
                setSelectedCategory('ALL');
                setSelectedDriverId('ALL');
                setSelectedStationId('ALL');
                setSelectedFuelType('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          
          <input
            type="text"
            placeholder="Buscar por placa, modelo ou motorista..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <option value="ALL">Todas as Categorias</option>
            <option value="VEICULO">Veículos (Placa)</option>
            <option value="TRATOR">Tratores</option>
            <option value="MAQUINA_AGRICOLA">Máquinas Agrícolas</option>
          </select>

          <select
            value={selectedEquipmentId}
            onChange={(e) => setSelectedEquipmentId(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <option value="ALL">Todos os Equipamentos</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.model} ({v.licensePlate || v.patrimonyCode})</option>
            ))}
          </select>

          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <option value="ALL">Todos os Motoristas/Operadores</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={selectedFuelType}
            onChange={(e) => setSelectedFuelType(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border outline-none font-medium ${
              darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="ALL">Todos os Combustíveis</option>
            <option value="DIESEL_S10">Diesel S10</option>
            <option value="DIESEL_S500">Diesel S500</option>
            <option value="GASOLINA_COMUM">Gasolina Comum</option>
            <option value="GASOLINA_GRID">Gasolina Aditivada</option>
            <option value="ETANOL">Etanol</option>
            <option value="ARLA_32">Arla 32</option>
          </select>

          <select
            value={selectedOperationType}
            onChange={(e) => setSelectedOperationType(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border outline-none font-medium ${
              darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="ALL">Todas as Operações</option>
            {OPERATION_OPTIONS.map(op => (
              <option key={op.id} value={op.id}>{op.emoji} {op.label}</option>
            ))}
          </select>

          <div className="flex gap-2 col-span-1 sm:col-span-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`flex-1 px-3 py-1.5 rounded-xl border outline-none font-medium ${
                darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <span className="self-center text-slate-500 font-bold">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`flex-1 px-3 py-1.5 rounded-xl border outline-none font-medium ${
                darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

        </div>
      </div>

      {/* Main Table */}
      <div className={`rounded-2xl border overflow-hidden ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b font-bold uppercase tracking-wider text-[10px] ${
                darkMode ? 'border-emerald-900 bg-emerald-900/40 text-emerald-300' : 'border-emerald-100 bg-emerald-50/60 text-emerald-900'
              }`}>
                <th className="p-3">Data/Hora</th>
                <th className="p-3">Equipamento</th>
                <th className="p-3">Motorista/Operador</th>
                <th className="p-3">Posto</th>
                <th className="p-3">Combustível</th>
                <th className="p-3">Litros</th>
                <th className="p-3">R$/L</th>
                <th className="p-3">Total R$</th>
                <th className="p-3">Rendimento</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/40">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500 dark:text-emerald-400">
                    Nenhum registro de abastecimento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="p-3 font-medium whitespace-nowrap">{formatDateTimeBR(log.dateTime)}</td>
                    <td className="p-3">
                      <p className="font-bold text-gray-900 dark:text-emerald-100">{log.equipmentName}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">{log.equipmentPlateOrCode}</span>
                        {log.operationType && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                            {getOperationTypeName(log.operationType)}
                            {log.activityType ? ` • ${getActivityTypeName(log.activityType, log.operationType)}` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-medium">{log.driverOrOperatorName}</td>
                    <td className="p-3 text-gray-600 dark:text-emerald-300">{log.gasStationName}</td>
                    <td className="p-3 font-semibold">{getFuelTypeName(log.fuelType)}</td>
                    <td className="p-3 font-extrabold text-emerald-800 dark:text-emerald-300">{log.liters} L</td>
                    <td className="p-3">{formatCurrency(log.pricePerLiter)}</td>
                    <td className="p-3 font-black text-gray-900 dark:text-emerald-100">{formatCurrency(log.totalValue)}</td>
                    <td className="p-3">
                      {log.calculatedAverageKmPerLiter ? (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{log.calculatedAverageKmPerLiter} km/L</span>
                      ) : log.calculatedAverageLitersPerHour ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">{log.calculatedAverageLitersPerHour} L/h</span>
                      ) : (
                        <span className="opacity-50">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {log.flaggedSuspicious ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          <AlertCircle className="w-3 h-3 text-amber-500" /> Suspeito
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> OK
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setInspectingLog(log)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          title="Ver Detalhes do Abastecimento"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditLog(log) && (
                          <button
                            onClick={() => handleOpenEdit(log)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            title="Editar Abastecimento"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEditSystemData(currentUser.role) && (
                          <button
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir este registro de abastecimento?')) {
                                onDeleteFuelLog(log.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspector Drawer Modal */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-xl rounded-2xl shadow-2xl border p-5 max-h-[90vh] overflow-y-auto space-y-4 ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <div className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-sm">Comprovante de Abastecimento</span>
              </div>
              <button onClick={() => setInspectingLog(null)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">{inspectingLog.equipmentName}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">Placa/Código: {inspectingLog.equipmentPlateOrCode}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <p><strong>Data/Hora:</strong> {formatDateTimeBR(inspectingLog.dateTime)}</p>
                <p><strong>Posto:</strong> {inspectingLog.gasStationName}</p>
                <p><strong>Motorista:</strong> {inspectingLog.driverOrOperatorName}</p>
                <p><strong>Atendente:</strong> {inspectingLog.attendantName}</p>
                <p><strong>Operação:</strong> {getOperationTypeName(inspectingLog.operationType)}</p>
                <p><strong>Atividade:</strong> {inspectingLog.activityType ? getActivityTypeName(inspectingLog.activityType, inspectingLog.operationType) : '-'}</p>
                <p><strong>Combustível:</strong> {getFuelTypeName(inspectingLog.fuelType)}</p>
                <p><strong>Litros:</strong> <span className="font-bold text-emerald-600">{inspectingLog.liters} L</span></p>
                <p><strong>Valor por Litro:</strong> {formatCurrency(inspectingLog.pricePerLiter)}</p>
                <p><strong>Valor Total:</strong> <span className="font-bold text-amber-500">{formatCurrency(inspectingLog.totalValue)}</span></p>
              </div>

              {inspectingLog.dashboardPhotoUrl && (
                <div>
                  <span className="font-bold block mb-1">Foto do Painel:</span>
                  <img src={inspectingLog.dashboardPhotoUrl} alt="Painel" className="w-full h-40 object-cover rounded-xl border" />
                </div>
              )}

              {inspectingLog.invoicePhotoUrl && (
                <div>
                  <span className="font-bold block mb-1">Comprovante Fiscal:</span>
                  <img src={inspectingLog.invoicePhotoUrl} alt="Comprovante" className="w-full h-40 object-cover rounded-xl border" />
                </div>
              )}

              {inspectingLog.observations && (
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-emerald-900/30 border">
                  <strong>Observações:</strong> {inspectingLog.observations}
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 rounded-xl bg-emerald-800/60 hover:bg-emerald-800 text-white font-bold text-xs transition-colors"
              >
                Fechar
              </button>
              {canEditLog(inspectingLog) && (
                <button
                  onClick={() => {
                    const target = inspectingLog;
                    setInspectingLog(null);
                    handleOpenEdit(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar Abastecimento</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Log Modal - Isolated component with fluid decimal input & zero parent re-render lag */}
      <EditFuelLogModal
        isOpen={Boolean(editingLog)}
        log={editingLog}
        gasStations={gasStations}
        currentUser={currentUser}
        onClose={() => setEditingLog(null)}
        onSave={handleSaveEdit}
        darkMode={darkMode}
      />

    </div>
  );
};

export const FuelLogsView = React.memo(FuelLogsViewComponent);
