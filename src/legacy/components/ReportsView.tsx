import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, FileText, Printer, Filter, Calendar, Fuel, 
  Truck, Users, DollarSign, Download, CheckCircle2, ChevronDown, 
  ChevronUp, BarChart3, TrendingUp, PieChart as PieChartIcon, 
  ShieldAlert, Award, Layers, Compass, Zap
} from 'lucide-react';
import { FuelLog, Vehicle, GasStation, User, SystemSettings } from '../types';
import { 
  formatCurrency, formatDateTimeBR, formatDateBR, getFuelTypeName, getSectorName, 
  exportFuelLogsPDF, exportExecutiveReportPDF, exportFuelLogsExcelWithCharts, exportFuelLogsCSV, exportManagerialCSV,
  getConsumptionByCategory, getConsumptionByActivity, getEffectiveActivityName,
  getEffectiveCategoryName, getOperationTypeName, getActivityTypeName 
} from '../utils/calculations';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, PieChart as RePieChart, Pie 
} from 'recharts';

interface ReportsViewProps {
  fuelLogs: FuelLog[];
  vehicles: Vehicle[];
  gasStations: GasStation[];
  users: User[];
  currentUser?: User;
  settings: SystemSettings;
  darkMode: boolean;
}

const PALETTE_COLORS = ['#10b981', '#f59e0b', '#0ea5e9', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#84cc16'];

export const ReportsViewComponent: React.FC<ReportsViewProps> = ({
  fuelLogs = [],
  vehicles = [],
  gasStations = [],
  users = [],
  currentUser,
  settings,
  darkMode = true
}) => {
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('ALL');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');
  const [showChartsPanel, setShowChartsPanel] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Permissão financeira: Apenas ADMIN e MANUTENCAO podem visualizar valores monetários
  const canViewFinancial = useMemo(() => {
    if (!currentUser) return true;
    return currentUser.role === 'ADMIN' || currentUser.role === 'MANUTENCAO';
  }, [currentUser]);

  // Filtragem estrita baseada nos parâmetros da interface
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      if (startDate && log.dateTime.slice(0, 10) < startDate) return false;
      if (endDate && log.dateTime.slice(0, 10) > endDate) return false;
      if (selectedCategory !== 'ALL' && log.equipmentCategory !== selectedCategory) return false;
      if (selectedEquipmentId !== 'ALL' && log.equipmentId !== selectedEquipmentId) return false;
      if (selectedDriverId !== 'ALL' && log.driverOrOperatorId !== selectedDriverId) return false;
      if (selectedStationId !== 'ALL' && log.gasStationId !== selectedStationId) return false;
      return true;
    });
  }, [fuelLogs, startDate, endDate, selectedCategory, selectedEquipmentId, selectedDriverId, selectedStationId]);

  // Mapa rápido de veículos para consultar o setor
  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach(v => {
      if (v.id) map.set(v.id, v);
    });
    return map;
  }, [vehicles]);

  // RESUMO GERENCIAL COMPLETO (Calculado sobre os registros reais filtrados)
  const managerialSummary = useMemo(() => {
    const totalCount = filteredLogs.length;
    if (totalCount === 0) {
      return {
        totalCount: 0,
        totalLiters: 0,
        totalCost: 0,
        avgLiters: 0,
        avgPricePerLiter: 0,
        topEquipment: null,
        topOperator: null,
        topActivity: null,
        topOperation: null,
        topSector: null
      };
    }

    let totalLiters = 0;
    let totalCost = 0;
    const eqMap = new Map<string, { name: string; code: string; liters: number; count: number }>();
    const opMap = new Map<string, { name: string; liters: number; count: number }>();
    const actMap = new Map<string, { name: string; liters: number; count: number }>();
    const operMap = new Map<string, { name: string; liters: number; count: number }>();
    const secMap = new Map<string, { name: string; liters: number; count: number }>();

    filteredLogs.forEach(l => {
      const liters = l.liters || 0;
      totalLiters += liters;
      totalCost += (l.totalValue || 0);

      // Equipamento
      const eqKey = l.equipmentId || l.equipmentName || 'OUTRO';
      const eq = eqMap.get(eqKey) || { name: l.equipmentName || 'Equipamento', code: l.equipmentPlateOrCode || '', liters: 0, count: 0 };
      eq.liters += liters; eq.count += 1;
      eqMap.set(eqKey, eq);

      // Operador
      const opKey = l.driverOrOperatorId || l.driverOrOperatorName || 'NÃO INFORMADO';
      const op = opMap.get(opKey) || { name: l.driverOrOperatorName || 'Não Informado', liters: 0, count: 0 };
      op.liters += liters; op.count += 1;
      opMap.set(opKey, op);

      // Atividade
      const actName = getEffectiveActivityName(l);
      const act = actMap.get(actName) || { name: actName, liters: 0, count: 0 };
      act.liters += liters; act.count += 1;
      actMap.set(actName, act);

      // Operação
      const operName = getEffectiveCategoryName(l);
      const oper = operMap.get(operName) || { name: operName, liters: 0, count: 0 };
      oper.liters += liters; oper.count += 1;
      operMap.set(operName, oper);

      // Setor
      const veh = vehicleMap.get(l.equipmentId);
      const sectorRaw = veh?.sector || 'AGRICOLA';
      const sectorLabel = getSectorName(sectorRaw);
      const sec = secMap.get(sectorLabel) || { name: sectorLabel, liters: 0, count: 0 };
      sec.liters += liters; sec.count += 1;
      secMap.set(sectorLabel, sec);
    });

    const sortedEq = Array.from(eqMap.values()).sort((a, b) => b.liters - a.liters);
    const sortedOp = Array.from(opMap.values()).sort((a, b) => b.liters - a.liters);
    const sortedAct = Array.from(actMap.values()).sort((a, b) => b.liters - a.liters);
    const sortedOper = Array.from(operMap.values()).sort((a, b) => b.liters - a.liters);
    const sortedSec = Array.from(secMap.values()).sort((a, b) => b.liters - a.liters);

    const avgLiters = totalCount > 0 ? totalLiters / totalCount : 0;
    const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

    return {
      totalCount,
      totalLiters,
      totalCost,
      avgLiters,
      avgPricePerLiter,
      topEquipment: sortedEq[0] || null,
      topOperator: sortedOp[0] || null,
      topActivity: sortedAct[0] || null,
      topOperation: sortedOper[0] || null,
      topSector: sortedSec[0] || null
    };
  }, [filteredLogs, vehicleMap]);

  // Agrupamento temporal para o gráfico de Período
  const timeSeriesData = useMemo(() => {
    const map = new Map<string, { date: string; displayDate: string; liters: number; cost: number; count: number }>();
    filteredLogs.forEach(l => {
      const rawDate = (l.dateTime || '').slice(0, 10);
      if (!rawDate) return;
      const parts = rawDate.split('-');
      const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : rawDate;
      const cur = map.get(rawDate) || { date: rawDate, displayDate, liters: 0, cost: 0, count: 0 };
      cur.liters += (l.liters || 0);
      cur.cost += (l.totalValue || 0);
      cur.count += 1;
      map.set(rawDate, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        liters: Number(item.liters.toFixed(1)),
        cost: Number(item.cost.toFixed(2))
      }));
  }, [filteredLogs]);

  // Agrupamento por Atividade (Top 6)
  const activityChartData = useMemo(() => {
    const map = new Map<string, { name: string; liters: number; count: number }>();
    filteredLogs.forEach(l => {
      const name = getEffectiveActivityName(l);
      const cur = map.get(name) || { name, liters: 0, count: 0 };
      cur.liters += (l.liters || 0);
      cur.count += 1;
      map.set(name, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 6)
      .map(item => ({
        ...item,
        liters: Number(item.liters.toFixed(1))
      }));
  }, [filteredLogs]);

  // Agrupamento por Operação
  const operationChartData = useMemo(() => {
    const map = new Map<string, { name: string; liters: number; count: number }>();
    filteredLogs.forEach(l => {
      const name = getEffectiveCategoryName(l);
      const cur = map.get(name) || { name, liters: 0, count: 0 };
      cur.liters += (l.liters || 0);
      cur.count += 1;
      map.set(name, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.liters - a.liters)
      .map(item => ({
        ...item,
        liters: Number(item.liters.toFixed(1))
      }));
  }, [filteredLogs]);

  // Agrupamento por Equipamento (Top 6)
  const equipmentChartData = useMemo(() => {
    const map = new Map<string, { name: string; code: string; liters: number; count: number }>();
    filteredLogs.forEach(l => {
      const name = l.equipmentName || 'Equipamento';
      const code = l.equipmentPlateOrCode || '';
      const key = l.equipmentId || name;
      const cur = map.get(key) || { name, code, liters: 0, count: 0 };
      cur.liters += (l.liters || 0);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 6)
      .map(item => ({
        displayName: item.code ? `${item.name.slice(0, 14)} (${item.code.slice(0, 7)})` : item.name.slice(0, 18),
        liters: Number(item.liters.toFixed(1)),
        count: item.count
      }));
  }, [filteredLogs]);

  // Agrupamento por Setor
  const sectorChartData = useMemo(() => {
    const map = new Map<string, { name: string; liters: number; count: number }>();
    filteredLogs.forEach(l => {
      const veh = vehicleMap.get(l.equipmentId);
      const sectorRaw = veh?.sector || 'AGRICOLA';
      const name = getSectorName(sectorRaw);
      const cur = map.get(name) || { name, liters: 0, count: 0 };
      cur.liters += (l.liters || 0);
      cur.count += 1;
      map.set(name, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.liters - a.liters)
      .map(item => ({
        ...item,
        liters: Number(item.liters.toFixed(1))
      }));
  }, [filteredLogs, vehicleMap]);

  // Breakdowns existentes
  const categoryBreakdown = useMemo(() => getConsumptionByCategory(filteredLogs), [filteredLogs]);
  const activityBreakdown = useMemo(() => getConsumptionByActivity(filteredLogs), [filteredLogs]);

  // Exportação 1: PDF Oficial Tradicional (Tabela com Gráficos Dinâmicos no Final)
  const handleExportPDF = async () => {
    try {
      setIsExporting('pdf-oficial');
      const dateRangeStr = `${startDate ? formatDateBR(startDate) : 'Início'} a ${endDate ? formatDateBR(endDate) : 'Hoje'}`;
      let filterDesc = 'Todos os equipamentos e postos';
      if (selectedCategory !== 'ALL') filterDesc = `Categoria: ${selectedCategory}`;
      if (selectedEquipmentId !== 'ALL') {
        const eq = vehicles.find(v => v.id === selectedEquipmentId);
        filterDesc = `Equipamento: ${eq?.model || selectedEquipmentId}`;
      }
      if (selectedDriverId !== 'ALL') {
        const op = users.find(u => u.id === selectedDriverId);
        filterDesc += ` • Operador: ${op?.name || selectedDriverId}`;
      }
      if (selectedStationId !== 'ALL') {
        const st = gasStations.find(s => s.id === selectedStationId);
        filterDesc += ` • Posto: ${st?.name || selectedStationId}`;
      }

      await exportFuelLogsPDF(
        filteredLogs,
        `Relatório Oficial de Abastecimentos (${startDate || 'Início'} a ${endDate || 'Hoje'})`,
        { name: settings.companyName, slogan: settings.slogan, cnpj: settings.cnpj },
        canViewFinancial,
        {
          vehicles,
          appliedFiltersDesc: filterDesc,
          dateRangeStr
        }
      );
    } catch (err) {
      console.error('Erro ao gerar PDF Oficial:', err);
    } finally {
      setIsExporting(null);
    }
  };

  // Exportação 2: PDF Executivo Completo (Tabela Completa e Gráficos no Final)
  const handleExportExecutivePDF = async () => {
    try {
      setIsExporting('pdf-executivo');
      const dateRangeStr = `${startDate ? formatDateBR(startDate) : 'Início'} a ${endDate ? formatDateBR(endDate) : 'Hoje'}`;
      let filterDesc = 'Todos os equipamentos e postos';
      if (selectedCategory !== 'ALL') filterDesc = `Categoria: ${selectedCategory}`;
      if (selectedEquipmentId !== 'ALL') {
        const eq = vehicles.find(v => v.id === selectedEquipmentId);
        filterDesc = `Equipamento: ${eq?.model || selectedEquipmentId}`;
      }
      if (selectedDriverId !== 'ALL') {
        const op = users.find(u => u.id === selectedDriverId);
        filterDesc += ` • Operador: ${op?.name || selectedDriverId}`;
      }
      if (selectedStationId !== 'ALL') {
        const st = gasStations.find(s => s.id === selectedStationId);
        filterDesc += ` • Posto: ${st?.name || selectedStationId}`;
      }

      await exportExecutiveReportPDF({
        logs: filteredLogs,
        vehicles,
        companyInfo: { name: settings.companyName, slogan: settings.slogan, cnpj: settings.cnpj },
        dateRangeStr,
        canViewFinancial,
        appliedFiltersDesc: filterDesc
      });
    } catch (err) {
      console.error('Erro ao gerar PDF Executivo:', err);
    } finally {
      setIsExporting(null);
    }
  };

  // Exportação 3: EXCEL (.xlsx) com Gráficos Analíticos Incorporados na Mesma Planilha
  const handleExportExcel = async () => {
    try {
      setIsExporting('excel');
      const dateRangeStr = `${startDate ? formatDateBR(startDate) : 'Início'} a ${endDate ? formatDateBR(endDate) : 'Hoje'}`;
      let filterDesc = 'Todos os equipamentos e postos';
      if (selectedCategory !== 'ALL') filterDesc = `Categoria: ${selectedCategory}`;
      if (selectedEquipmentId !== 'ALL') {
        const eq = vehicles.find(v => v.id === selectedEquipmentId);
        filterDesc = `Equipamento: ${eq?.model || selectedEquipmentId}`;
      }
      if (selectedDriverId !== 'ALL') {
        const op = users.find(u => u.id === selectedDriverId);
        filterDesc += ` • Operador: ${op?.name || selectedDriverId}`;
      }
      if (selectedStationId !== 'ALL') {
        const st = gasStations.find(s => s.id === selectedStationId);
        filterDesc += ` • Posto: ${st?.name || selectedStationId}`;
      }

      await exportFuelLogsExcelWithCharts({
        logs: filteredLogs,
        vehicles,
        companyInfo: { name: settings.companyName, slogan: settings.slogan, cnpj: settings.cnpj },
        dateRangeStr,
        canViewFinancial,
        appliedFiltersDesc: filterDesc
      });
    } catch (err) {
      console.error('Erro ao gerar Excel com Gráficos:', err);
    } finally {
      setIsExporting(null);
    }
  };

  // Exportação 3: CSV Tradicional
  const handleExportCSV = () => {
    exportFuelLogsCSV(filteredLogs, 'Relatorio_AndradeAgro_Filtrado', canViewFinancial);
  };

  // Exportação 4: NOVO Relatório Gerencial Estruturado
  const handleExportManagerialCSV = () => {
    const dateRangeStr = `${startDate || 'Início'} até ${endDate || 'Hoje'}`;
    exportManagerialCSV({
      logs: filteredLogs,
      vehicles,
      dateRangeStr,
      canViewFinancial,
      companyName: settings.companyName
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header & Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Central de Relatórios & Inteligência Gerencial
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Resumos consolidados, gráficos interativos de consumo e relatórios executivos para auditoria.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão: PDF Executivo Completo */}
          <button
            onClick={handleExportExecutivePDF}
            disabled={isExporting !== null}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
            title="Gera PDF completo com cabeçalho, tabela completa e gráficos no final do documento"
          >
            <Award className="w-4 h-4 text-amber-300" />
            <span>{isExporting === 'pdf-executivo' ? 'Gerando PDF...' : 'PDF com Gráficos'}</span>
          </button>

          {/* Botão: Excel (.xlsx com Gráficos) */}
          <button
            onClick={handleExportExcel}
            disabled={isExporting !== null}
            className="bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
            title="Exporta planilha Excel (.xlsx) com tabela completa e gráficos incorporados na mesma planilha após a última linha"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-200" />
            <span>{isExporting === 'excel' ? 'Gerando Excel...' : 'Excel com Gráficos (.xlsx)'}</span>
          </button>

          {/* Botão: PDF Oficial (Tabela) */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting !== null}
            className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
            title="Gera relatório em PDF com a tabela oficial de lançamentos e resumo analítico"
          >
            <FileText className="w-4 h-4" />
            <span>{isExporting === 'pdf-oficial' ? 'Gerando Tabela...' : 'PDF Oficial (Tabela)'}</span>
          </button>

          {/* Botão Mantido: Exportar Relatório Gerencial */}
          <button
            onClick={handleExportManagerialCSV}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition active:scale-95"
            title="Exporta planilha estruturada com Resumo, Atividades, Equipamentos e Lançamentos"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Relatório Gerencial (CSV)</span>
          </button>

          {/* Botão Mantido: Exportar CSV (Lançamentos) */}
          <button
            onClick={handleExportCSV}
            className={`p-2.5 rounded-xl border text-xs font-bold transition ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-emerald-200 hover:bg-emerald-900/70' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            title="Exportar CSV de lançamentos"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrint}
            className={`p-2.5 rounded-xl border text-xs font-bold transition ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-emerald-200 hover:bg-emerald-900/70' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            title="Imprimir Relatório"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Parameters Card */}
      <div className={`p-5 rounded-2xl border space-y-4 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
      }`}>
        <div className="flex items-center justify-between font-bold text-xs text-gray-800 dark:text-emerald-200 border-b border-emerald-800/20 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-500" />
            <span>Parâmetros de Filtragem do Relatório</span>
          </div>
          <span className="text-[11px] font-normal text-emerald-400">
            {filteredLogs.length} abastecimentos localizados
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Categoria</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todas</option>
              <option value="VEICULO">Veículos</option>
              <option value="TRATOR">Tratores</option>
              <option value="MAQUINA_AGRICOLA">Máquinas Agrícolas</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Equipamento</label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todos</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.model} ({v.licensePlate || v.patrimonyCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Motorista / Operador</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-600 dark:text-emerald-300">Posto de Origem</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
            >
              <option value="ALL">Todos os Postos</option>
              {gasStations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* BLOCO VISUAL: RESUMO GERENCIAL */}
      <div className={`p-5 sm:p-6 rounded-2xl border space-y-4 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900 shadow-lg' : 'bg-white border-emerald-100 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/30 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-emerald-100">
              Resumo Gerencial
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-emerald-400">
            <span>{filteredLogs.length > 0 ? `${filteredLogs.length} abastecimentos consolidados` : 'Sem dados no período'}</span>
            {!canViewFinancial && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 flex items-center gap-1 border border-slate-700">
                <ShieldAlert className="w-3 h-3 text-amber-400" /> Valores restritos
              </span>
            )}
          </div>
        </div>

        {/* Grid de KPIs do Resumo Gerencial */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Total Litros */}
          <div className="p-3.5 rounded-xl bg-emerald-900/20 border border-emerald-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Abastecido</span>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-300">
                {managerialSummary.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
              </span>
              <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                {managerialSummary.totalCount} lançamentos
              </span>
            </div>
          </div>

          {/* Total Gasto em Reais (com restrição de perfil) */}
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Total Gasto (R$)</span>
            <div className="mt-1">
              {canViewFinancial ? (
                <>
                  <span className="text-xl sm:text-2xl font-black text-amber-400">
                    {formatCurrency(managerialSummary.totalCost)}
                  </span>
                  <span className="text-[10px] text-amber-400/80 block mt-0.5">
                    Méd. {formatCurrency(managerialSummary.avgPricePerLiter)}/L
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm sm:text-base font-bold text-slate-400 flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 text-amber-400" /> Acesso Restrito
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Somente Administrador</span>
                </>
              )}
            </div>
          </div>

          {/* Média Litros por Abastecimento */}
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Média por Abastecimento</span>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-cyan-300">
                {managerialSummary.avgLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
              </span>
              <span className="text-[10px] text-cyan-400/80 block mt-0.5">volume médio unitário</span>
            </div>
          </div>

          {/* Quantidade Total */}
          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Total de Operações</span>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-black text-indigo-300">
                {managerialSummary.totalCount}
              </span>
              <span className="text-[10px] text-indigo-400/80 block mt-0.5">registros no período</span>
            </div>
          </div>

          {/* Máquina Maior Consumo */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" /> Maior Consumo (Máquina)
            </span>
            <div className="mt-1">
              {managerialSummary.topEquipment ? (
                <>
                  <span className="text-sm font-black text-emerald-100 block truncate" title={managerialSummary.topEquipment.name}>
                    {managerialSummary.topEquipment.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                    {managerialSummary.topEquipment.liters.toLocaleString('pt-BR')} L ({managerialSummary.totalLiters > 0 ? Math.round((managerialSummary.topEquipment.liters / managerialSummary.totalLiters) * 100) : 0}%)
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">Sem dados no período</span>
              )}
            </div>
          </div>

          {/* Operador com Maior Volume */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Operador Maior Volume
            </span>
            <div className="mt-1">
              {managerialSummary.topOperator ? (
                <>
                  <span className="text-sm font-black text-emerald-100 block truncate" title={managerialSummary.topOperator.name}>
                    {managerialSummary.topOperator.name}
                  </span>
                  <span className="text-[10px] text-emerald-300 font-bold block mt-0.5">
                    {managerialSummary.topOperator.liters.toLocaleString('pt-BR')} L ({managerialSummary.topOperator.count} abastec.)
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">Sem dados no período</span>
              )}
            </div>
          </div>

          {/* Atividade com Maior Consumo */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Atividade Principal
            </span>
            <div className="mt-1">
              {managerialSummary.topActivity ? (
                <>
                  <span className="text-sm font-black text-emerald-100 block truncate" title={managerialSummary.topActivity.name}>
                    {managerialSummary.topActivity.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                    {managerialSummary.topActivity.liters.toLocaleString('pt-BR')} L ({managerialSummary.totalLiters > 0 ? Math.round((managerialSummary.topActivity.liters / managerialSummary.totalLiters) * 100) : 0}%)
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">Sem dados no período</span>
              )}
            </div>
          </div>

          {/* Setor com Maior Consumo */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Setor com Maior Consumo
            </span>
            <div className="mt-1">
              {managerialSummary.topSector ? (
                <>
                  <span className="text-sm font-black text-emerald-100 block truncate" title={managerialSummary.topSector.name}>
                    {managerialSummary.topSector.name}
                  </span>
                  <span className="text-[10px] text-cyan-400 font-bold block mt-0.5">
                    {managerialSummary.topSector.liters.toLocaleString('pt-BR')} L ({managerialSummary.totalLiters > 0 ? Math.round((managerialSummary.topSector.liters / managerialSummary.totalLiters) * 100) : 0}%)
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">Sem dados no período</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO: PAINEL GERENCIAL E GRÁFICOS INTERATIVOS (RECHARTS) */}
      <div className={`p-5 sm:p-6 rounded-2xl border space-y-4 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
      }`}>
        <div className="flex items-center justify-between border-b border-emerald-800/30 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-emerald-100">
              Painel Gerencial e Gráficos
            </h2>
          </div>
          <button
            onClick={() => setShowChartsPanel(!showChartsPanel)}
            className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 p-1.5 rounded-lg hover:bg-emerald-900/40 transition"
          >
            <span>{showChartsPanel ? 'Ocultar Gráficos' : 'Exibir Gráficos'}</span>
            {showChartsPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showChartsPanel && (
          <>
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nenhum abastecimento encontrado para os filtros selecionados. Ajuste os filtros acima para visualizar os gráficos.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                
                {/* 1. Consumo por Período (Timeline) */}
                <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> Consumo por Período (Litros)
                    </span>
                    <span className="text-[10px] text-slate-400">Linha temporal de abastecimento</span>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorLiters" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" opacity={0.5} />
                        <XAxis dataKey="displayDate" stroke="#a7f3d0" fontSize={10} tickLine={false} />
                        <YAxis stroke="#a7f3d0" fontSize={10} tickLine={false} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: '#064e3b',
                            borderColor: '#047857',
                            borderRadius: '0.75rem',
                            color: '#ecfdf5',
                            fontSize: '12px'
                          }}
                          formatter={(val: any) => [`${val} L`, 'Volume']}
                        />
                        <Area type="monotone" dataKey="liters" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLiters)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Consumo por Equipamento (Top Máquinas) */}
                <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-amber-400" /> Top Equipamentos com Maior Consumo
                    </span>
                    <span className="text-[10px] text-slate-400">Ordenado por volume</span>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={equipmentChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" opacity={0.5} horizontal={false} />
                        <XAxis type="number" stroke="#a7f3d0" fontSize={10} tickLine={false} />
                        <YAxis type="category" dataKey="displayName" stroke="#a7f3d0" fontSize={9.5} tickLine={false} width={100} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: '#064e3b',
                            borderColor: '#047857',
                            borderRadius: '0.75rem',
                            color: '#ecfdf5',
                            fontSize: '12px'
                          }}
                          formatter={(val: any) => [`${val} L`, 'Consumo']}
                        />
                        <Bar dataKey="liters" fill="#f59e0b" radius={[0, 6, 6, 0]}>
                          {equipmentChartData.map((_, index) => (
                            <Cell key={`cell-eq-${index}`} fill={index === 0 ? '#f59e0b' : '#d97706'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Consumo por Atividade Real */}
                <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-400" /> Consumo por Atividade (Litros)
                    </span>
                    <span className="text-[10px] text-slate-400">Nomes reais cadastrados</span>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" opacity={0.5} />
                        <XAxis dataKey="name" stroke="#a7f3d0" fontSize={9.5} tickLine={false} interval={0} angle={-20} textAnchor="end" />
                        <YAxis stroke="#a7f3d0" fontSize={10} tickLine={false} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: '#064e3b',
                            borderColor: '#047857',
                            borderRadius: '0.75rem',
                            color: '#ecfdf5',
                            fontSize: '12px'
                          }}
                          formatter={(val: any) => [`${val} L`, 'Volume']}
                        />
                        <Bar dataKey="liters" fill="#0ea5e9" radius={[6, 6, 0, 0]}>
                          {activityChartData.map((_, index) => (
                            <Cell key={`cell-act-${index}`} fill={PALETTE_COLORS[index % PALETTE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Consumo por Setor (Cruzamento com Cadastro de Veículos) */}
                <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-indigo-400" /> Consumo por Setor
                    </span>
                    <span className="text-[10px] text-slate-400">Cruzamento com cadastro da frota</span>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" opacity={0.5} />
                        <XAxis dataKey="name" stroke="#a7f3d0" fontSize={9.5} tickLine={false} interval={0} angle={-20} textAnchor="end" />
                        <YAxis stroke="#a7f3d0" fontSize={10} tickLine={false} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: '#064e3b',
                            borderColor: '#047857',
                            borderRadius: '0.75rem',
                            color: '#ecfdf5',
                            fontSize: '12px'
                          }}
                          formatter={(val: any) => [`${val} L`, 'Consumo']}
                        />
                        <Bar dataKey="liters" fill="#6366f1" radius={[6, 6, 0, 0]}>
                          {sectorChartData.map((_, index) => (
                            <Cell key={`cell-sec-${index}`} fill={index === 0 ? '#10b981' : PALETTE_COLORS[(index + 2) % PALETTE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>

      {/* Report Summary Overview Card (Mantido e Integrado) */}
      <div className={`p-6 rounded-2xl border ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-emerald-800/20">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Detalhamento de Lançamentos
            </span>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-emerald-100">
              {settings.companyName} - Fazenda Andrade
            </h2>
            <p className="text-xs text-gray-500 dark:text-emerald-300">
              {filteredLogs.length} registros selecionados • Período: {startDate} até {endDate}
            </p>
          </div>

          <div className="flex gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 block">Volume Total</span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{managerialSummary.totalLiters.toLocaleString('pt-BR')} L</span>
            </div>
            {canViewFinancial && (
              <div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 block">Investimento Total</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(managerialSummary.totalCost)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Category & Activity Breakdown in Report */}
        <div className="mt-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Categoria */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 space-y-2">
            <span className="text-[11px] font-black uppercase text-amber-400 block">
              🏷️ Consumo por Categoria (Litros & %)
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {categoryBreakdown.map(c => (
                <div key={c.key} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 truncate">{c.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-100">{c.liters.toLocaleString('pt-BR')} L</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300">
                      {c.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Atividade */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 space-y-2">
            <span className="text-[11px] font-black uppercase text-emerald-300 block">
              ⚙️ Consumo por Atividade / Serviço
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {activityBreakdown.map(a => (
                <div key={a.key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-bold text-slate-200 truncate">{a.activity}</span>
                    {a.isCustom && <span className="text-[9px] text-amber-400 font-bold shrink-0">⭐</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-extrabold text-slate-100">{a.liters.toLocaleString('pt-BR')} L</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200">
                      {a.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Table com Respeito às Permissões Financeiras */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b font-bold uppercase text-[10px] text-gray-500 dark:text-emerald-400">
                <th className="p-2">Data/Hora</th>
                <th className="p-2">Placa/Cód.</th>
                <th className="p-2">Equipamento</th>
                <th className="p-2">Motorista</th>
                <th className="p-2">Posto</th>
                <th className="p-2">Combustível</th>
                <th className="p-2">Litros</th>
                {canViewFinancial && <th className="p-2">R$/L</th>}
                {canViewFinancial && <th className="p-2">Total R$</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinancial ? 9 : 7} className="p-6 text-center text-slate-400">
                    Sem lançamentos registrados no período selecionado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-emerald-900/20 transition">
                    <td className="p-2 whitespace-nowrap">{formatDateTimeBR(log.dateTime)}</td>
                    <td className="p-2 font-bold text-amber-600 dark:text-amber-400">{log.equipmentPlateOrCode || '-'}</td>
                    <td className="p-2 font-semibold text-slate-200">{log.equipmentName}</td>
                    <td className="p-2 text-slate-300">{log.driverOrOperatorName}</td>
                    <td className="p-2 text-slate-300">{log.gasStationName}</td>
                    <td className="p-2 text-slate-300">{getFuelTypeName(log.fuelType)}</td>
                    <td className="p-2 font-bold text-emerald-400">{log.liters} L</td>
                    {canViewFinancial && <td className="p-2 text-slate-300">{formatCurrency(log.pricePerLiter)}</td>}
                    {canViewFinancial && <td className="p-2 font-black text-amber-400">{formatCurrency(log.totalValue)}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export const ReportsView = React.memo(ReportsViewComponent);
