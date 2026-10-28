import React, { useMemo, useState } from 'react';
import { 
  Fuel, DollarSign, Calendar, TrendingUp, Truck, Users, 
  BarChart2, PieChart, ArrowUpRight, AlertCircle, Plus, FileText, CheckCircle2, ChevronRight,
  Settings, AlertTriangle
} from 'lucide-react';
import { FuelLog, Vehicle, Sector, SystemSettings, CentralTank, User, OperationType } from '../types';
import { 
  formatCurrency, formatDateTimeBR, getSectorName, getFuelTypeName,
  getConsumptionByCategory, getConsumptionByActivity, OPERATION_OPTIONS, CATEGORY_PALETTE 
} from '../utils/calculations';
import { getTankStatus, getCentralTanks, getCurrentUser, updateCentralTank } from '../utils/storage';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend 
} from 'recharts';
const EditCentralTankModal = React.lazy(() => 
  import('./EditCentralTankModal').then(m => ({ default: m.EditCentralTankModal }))
);

interface DashboardViewProps {
  fuelLogs: FuelLog[];
  vehicles: Vehicle[];
  settings?: SystemSettings;
  onOpenFuelingModal: () => void;
  onNavigate: (tab: string) => void;
  darkMode?: boolean;
}

const SECTOR_COLORS: Record<string, string> = {
  PREPARO_SOLO: '#15803d',
  COLHEITA: '#d97706',
  PULVERIZACAO: '#0284c7',
  LOGISTICA: '#4f46e5',
  AGRICOLA: '#16a34a',
  DIRETORIA: '#ca8a04',
  OFICINA_MANUTENCAO: '#64748b'
};

export const DashboardViewComponent: React.FC<DashboardViewProps> = ({
  fuelLogs = [],
  vehicles = [],
  settings,
  onOpenFuelingModal,
  onNavigate,
  darkMode = true
}) => {
  const [selectedTankForConfig, setSelectedTankForConfig] = useState<CentralTank | null>(null);
  const [selectedCategoryForActivity, setSelectedCategoryForActivity] = useState<string>('ALL');
  const [areChartsReady, setAreChartsReady] = useState<boolean>(false);
  const currentUser = getCurrentUser() || { id: 'usr-admin', name: 'Administrador', role: 'ADMIN' } as User;

  React.useEffect(() => {
    // Delay heavy chart mounting by 1 frame to let Bento metrics and tank cards paint at 60fps on mobile
    const id = requestAnimationFrame(() => {
      setAreChartsReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Central Tanks statuses memoized
  const centralTanks = useMemo(() => {
    return getCentralTanks();
  }, [settings, fuelLogs]);

  const centralTanksStatus = useMemo(() => {
    return centralTanks.map(tank => ({
      tank,
      status: getTankStatus(tank.id)
    }));
  }, [centralTanks, settings, fuelLogs]);

  // Date calculations & metrics memoized
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const isSameDay = (dateStr: string, refDate: Date = new Date()) => {
      if (!dateStr) return false;
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
          return dateStr.startsWith(refDate.toISOString().slice(0, 10));
        }
        return (
          d.getFullYear() === refDate.getFullYear() &&
          d.getMonth() === refDate.getMonth() &&
          d.getDate() === refDate.getDate()
        );
      } catch {
        return false;
      }
    };

    const todayLogs = fuelLogs.filter(l => isSameDay(l.dateTime, now));
    const weekLogs = fuelLogs.filter(l => new Date(l.dateTime) >= sevenDaysAgo);
    const monthLogs = fuelLogs.filter(l => new Date(l.dateTime) >= startOfMonth);
    const yearLogs = fuelLogs.filter(l => new Date(l.dateTime) >= startOfYear);

    const todayLiters = todayLogs.reduce((acc, l) => acc + (Number(l.liters) || 0), 0);
    const todaySpent = todayLogs.reduce((acc, l) => acc + (Number(l.totalValue) || 0), 0);

    const weekSpent = weekLogs.reduce((acc, l) => acc + (Number(l.totalValue) || 0), 0);
    const monthSpent = monthLogs.reduce((acc, l) => acc + (Number(l.totalValue) || 0), 0);
    const monthLiters = monthLogs.reduce((acc, l) => acc + (Number(l.liters) || 0), 0);
    const yearSpent = yearLogs.reduce((acc, l) => acc + (Number(l.totalValue) || 0), 0);

    return {
      now,
      todayLogs,
      weekLogs,
      monthLogs,
      yearLogs,
      todayLiters,
      todaySpent,
      weekSpent,
      monthSpent,
      monthLiters,
      yearSpent
    };
  }, [fuelLogs]);

  const {
    now,
    todayLogs,
    weekLogs,
    monthLogs,
    yearLogs,
    todayLiters,
    todaySpent,
    weekSpent,
    monthSpent,
    monthLiters,
    yearSpent
  } = metrics;

  // Top Consumers Calculations (Historical for general charts)
  const equipmentConsumption = useMemo(() => {
    const map = new Map<string, { name: string; plate: string; category: string; liters: number; cost: number }>();
    fuelLogs.forEach(l => {
      const existing = map.get(l.equipmentId) || {
        name: l.equipmentName,
        plate: l.equipmentPlateOrCode,
        category: l.equipmentCategory,
        liters: 0,
        cost: 0
      };
      existing.liters += Number(l.liters) || 0;
      existing.cost += Number(l.totalValue) || 0;
      map.set(l.equipmentId, existing);
    });
    return Array.from(map.values());
  }, [fuelLogs]);

  const topVehicle = useMemo(() => {
    return equipmentConsumption
      .filter(e => e.category === 'VEICULO')
      .sort((a, b) => b.liters - a.liters)[0];
  }, [equipmentConsumption]);

  const topTractorOrMachine = useMemo(() => {
    return equipmentConsumption
      .filter(e => e.category === 'TRATOR' || e.category === 'MAQUINA_AGRICOLA')
      .sort((a, b) => b.liters - a.liters)[0];
  }, [equipmentConsumption]);

  // Top Operator of TODAY (Filtered strictly to today's fuelings)
  const todayTopOperator = useMemo(() => {
    if (todayLogs.length === 0) return null;
    const map = new Map<string, { id: string; name: string; liters: number; cost: number; count: number }>();
    todayLogs.forEach(l => {
      const key = l.driverOrOperatorId || l.driverOrOperatorName || 'Operador';
      const existing = map.get(key) || {
        id: key,
        name: l.driverOrOperatorName || 'Operador',
        liters: 0,
        cost: 0,
        count: 0
      };
      existing.liters += Number(l.liters) || 0;
      existing.cost += Number(l.totalValue) || 0;
      existing.count += 1;
      map.set(key, existing);
    });
    const sorted = Array.from(map.values()).sort((a, b) => b.liters - a.liters);
    return sorted[0] || null;
  }, [todayLogs]);

  // Top Equipment of TODAY (Filtered strictly to today's fuelings)
  const todayTopEquipment = useMemo(() => {
    if (todayLogs.length === 0) return null;
    const map = new Map<string, { id: string; name: string; plate: string; category: string; liters: number; cost: number; count: number }>();
    todayLogs.forEach(l => {
      const key = l.equipmentId || l.equipmentName;
      const existing = map.get(key) || {
        id: key,
        name: l.equipmentName,
        plate: l.equipmentPlateOrCode,
        category: l.equipmentCategory,
        liters: 0,
        cost: 0,
        count: 0
      };
      existing.liters += Number(l.liters) || 0;
      existing.cost += Number(l.totalValue) || 0;
      existing.count += 1;
      map.set(key, existing);
    });
    const sorted = Array.from(map.values()).sort((a, b) => b.liters - a.liters);
    return sorted[0] || null;
  }, [todayLogs]);

  const topOperator = useMemo(() => {
    const map = new Map<string, { name: string; count: number; liters: number }>();
    fuelLogs.forEach(l => {
      const existing = map.get(l.driverOrOperatorId) || { name: l.driverOrOperatorName, count: 0, liters: 0 };
      existing.count += 1;
      existing.liters += Number(l.liters) || 0;
      map.set(l.driverOrOperatorId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.liters - a.liters)[0];
  }, [fuelLogs]);

  // Sector Data Chart
  const sectorChartData = useMemo(() => {
    const map = new Map<Sector, number>();
    fuelLogs.forEach(l => {
      const eq = vehicles.find(v => v.id === l.equipmentId);
      const sec = eq ? eq.sector : 'AGRICOLA';
      map.set(sec, (map.get(sec) || 0) + l.totalValue);
    });

    return Array.from(map.entries()).map(([sec, value]) => ({
      name: getSectorName(sec),
      key: sec,
      value: Math.round(value)
    }));
  }, [fuelLogs, vehicles]);

  // Monthly Spending History Chart
  const monthlyHistoryData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentMonthIdx = now.getMonth();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      const monthName = months[idx];
      // Generate realistic monthly aggregate from fuelLogs or fallback estimation
      const logsForMonth = fuelLogs.filter(l => {
        const d = new Date(l.dateTime);
        return d.getMonth() === idx;
      });
      const total = logsForMonth.reduce((acc, l) => acc + l.totalValue, 0);
      data.push({
        month: monthName,
        Gasto: total,
        Litros: logsForMonth.reduce((acc, l) => acc + l.liters, 0)
      });
    }

    return data;
  }, [fuelLogs]);

  // Operation Types Breakdown
  const operationTypeData = useMemo(() => {
    const map = new Map<string, { label: string; liters: number; cost: number; count: number }>();
    const labels: Record<string, string> = {
      GRAMA: '🌱 Grama',
      COLHEITA: '🌾 Colheita',
      PLANTIO: '🚜 Plantio',
      TRANSPORTE: '🚚 Transporte',
      OUTROS: '🔧 Outros'
    };

    fuelLogs.forEach(l => {
      const opKey = l.operationType || 'GRAMA';
      const existing = map.get(opKey) || { label: labels[opKey] || opKey, liters: 0, cost: 0, count: 0 };
      existing.liters += l.liters;
      existing.cost += l.totalValue;
      existing.count += 1;
      map.set(opKey, existing);
    });

    return Array.from(map.entries()).map(([key, data]) => ({
      key,
      ...data
    })).sort((a, b) => b.liters - a.liters);
  }, [fuelLogs]);

  // Consumo por Categoria (Gráfico 1: Litros e Porcentagem)
  const categoryConsumption = useMemo(() => {
    return getConsumptionByCategory(fuelLogs);
  }, [fuelLogs]);

  const totalCategoryLiters = useMemo(() => {
    return categoryConsumption.reduce((acc, c) => acc + c.liters, 0);
  }, [categoryConsumption]);

  // Consumo por Atividade / Serviço (Gráfico 2: Serviço existente / Atividade personalizada + Litros)
  const activityConsumption = useMemo(() => {
    return getConsumptionByActivity(fuelLogs, selectedCategoryForActivity);
  }, [fuelLogs, selectedCategoryForActivity]);

  const totalActivityLiters = useMemo(() => {
    return activityConsumption.reduce((acc, a) => acc + a.liters, 0);
  }, [activityConsumption]);

  // Executive summary narrative line
  const executiveSummaryText = useMemo(() => {
    if (fuelLogs.length === 0) {
      return "Nova Empresa: Nenhum abastecimento registrado ainda. Os custos estão zerados (R$ 0,00). Faça um lançamento de teste no sistema para validar os cálculos.";
    }
    const totalMonthLiters = monthLiters;
    const topOp = operationTypeData[0];
    if (!topOp) {
      return `Este mês foram consumidos ${totalMonthLiters.toLocaleString('pt-BR')} litros de combustível.`;
    }
    const topOpName = topOp.label.replace(/^[^\s]+\s*/, '').toLowerCase();
    const opName = topOperator?.name || 'Operador';

    return `Este mês foram consumidos ${totalMonthLiters.toLocaleString('pt-BR')} litros de combustível, sendo ${topOp.liters.toLocaleString('pt-BR')} litros utilizados em ${topOpName} pelo operador ${opName}.`;
  }, [fuelLogs.length, monthLiters, operationTypeData, topOperator]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Executive Operational Narrative Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#064E3B] to-[#043327] border-2 border-[#FACC15] shadow-md text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center shrink-0 font-extrabold text-lg shadow-sm">
            💡
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-[#FACC15]">
              Resumo Operacional Inteligente
            </span>
            <p className="text-sm font-extrabold text-white mt-0.5 leading-relaxed">
              "{executiveSummaryText}"
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('reports')}
          className="self-start md:self-auto px-4 py-2 bg-[#FACC15] hover:bg-yellow-400 text-[#064E3B] font-extrabold text-xs rounded-2xl shadow transition-all shrink-0"
        >
          Relatórios Detalhados
        </button>
      </div>
      
      {/* Top Bento Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Bento Stat 1: Abastecimentos Hoje */}
        <div className="p-5 rounded-3xl border shadow-sm transition-all flex flex-col justify-between bg-[#042d23] border-emerald-900/60 text-slate-100">
          <div>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              Abastecimentos (Hoje)
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-100">{todayLogs.length}</span>
              <span className="text-emerald-300 text-xs font-bold px-2 py-0.5 bg-emerald-950/80 rounded-md border border-emerald-800">
                {todayLogs.length > 0 ? `${todayLogs.length} reg` : '0 reg'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-300/90 mt-3 font-semibold">
            {todaySpent > 0 ? `Gasto hoje: ${formatCurrency(todaySpent)}` : 'Nenhum lançamento hoje'}
          </p>
        </div>

        {/* Bento Stat 2: Total Litros (Semana) */}
        <div className="p-5 rounded-3xl border shadow-sm transition-all flex flex-col justify-between bg-[#042d23] border-emerald-900/60 text-slate-100">
          <div>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              Total Litros (Semana)
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-100">
                {weekLogs.reduce((acc, l) => acc + l.liters, 0).toLocaleString('pt-BR')}
              </span>
              <span className="text-emerald-300 text-sm font-bold">L</span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-300/90 mt-3 font-semibold">
            Consumo estável vs. período anterior
          </p>
        </div>

        {/* Bento Stat 3: Gasto Mensal */}
        <div className="p-5 rounded-3xl border shadow-sm transition-all flex flex-col justify-between bg-[#042d23] border-emerald-900/60 text-slate-100">
          <div>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              Gasto Mensal
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-emerald-300">R$</span>
              <span className="text-3xl font-bold text-slate-100">
                {monthSpent.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-300 font-bold mt-3">
            {monthLiters.toLocaleString('pt-BR')}L acumulados este mês
          </p>
        </div>

        {/* Bento Stat 4: High-Impact Emerald Card - Frota Ativa */}
        <div className="bg-[#064E3B] p-5 rounded-3xl border border-[#064E3B] shadow-lg shadow-emerald-900/10 text-white flex flex-col justify-between">
          <div>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2">
              Frota & Máquinas Ativas
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#FACC15]">{vehicles.filter(v => v.status === 'ATIVO').length}</span>
              <span className="text-emerald-200 text-sm font-bold">/ {vehicles.length}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full h-2 bg-white/20 rounded-full">
              <div 
                className="h-full bg-[#FACC15] rounded-full transition-all duration-500" 
                style={{ width: `${Math.round((vehicles.filter(v => v.status === 'ATIVO').length / (vehicles.length || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-emerald-100 font-bold mt-1.5 text-right">
              {Math.round((vehicles.filter(v => v.status === 'ATIVO').length / (vehicles.length || 1)) * 100)}% em operação
            </p>
          </div>
        </div>

      </div>

      {/* Main Bento Grid Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Chart Section - 8 cols */}
        <div className="lg:col-span-8 rounded-3xl border shadow-sm p-6 flex flex-col bg-[#042d23] border-emerald-900/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="font-bold text-lg text-slate-100">Fluxo de Consumo</h3>
              <p className="text-xs text-emerald-200 font-medium">Evolução dos abastecimentos por mês e por setor</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-bold text-[#FACC15] bg-[#FACC15]/10 px-3 py-1.5 rounded-full border border-[#FACC15]/20">
              Mês Atual: {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full flex items-center justify-center">
            {areChartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyHistoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGastoBento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#064E3B" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#064E3B" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a7f3d0', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#a7f3d0', fontWeight: 600 }} tickFormatter={(v) => `R$${v/1000}k`} />
                  <Tooltip 
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Total Gasto']}
                    contentStyle={{
                      backgroundColor: '#022c22',
                      borderColor: '#065f46',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#f8fafc',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area type="monotone" dataKey="Gasto" stroke="#FACC15" strokeWidth={3} fillOpacity={1} fill="url(#colorGastoBento)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full rounded-2xl bg-emerald-950/40 animate-pulse border border-emerald-900/30" />
            )}
          </div>

          {/* Sector Bars Preview inside Bento Card */}
          <div className="mt-6 pt-4 border-t border-emerald-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sectorChartData.slice(0, 4).map((sec, idx) => (
              <div key={idx} className="bg-emerald-950/60 p-3 rounded-2xl border border-emerald-900/40">
                <p className="text-[10px] font-extrabold text-emerald-300 uppercase truncate">{sec.name}</p>
                <p className="text-sm font-bold text-slate-100 mt-0.5">{formatCurrency(sec.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Registrations Bento Card - 4 cols */}
        <div className="lg:col-span-4 rounded-3xl border shadow-sm p-6 flex flex-col justify-between bg-[#042d23] border-emerald-900/60">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-100">Últimos Registros</h3>
              <button 
                onClick={() => onNavigate('fuel-logs')}
                className="text-[11px] font-bold text-[#FACC15] hover:underline"
              >
                Ver Todos
              </button>
            </div>

            <div className="space-y-3">
              {fuelLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-emerald-950/60 rounded-2xl transition-colors hover:bg-emerald-900/40 border border-emerald-900/40">
                  <div className="w-10 h-10 bg-[#064E3B] text-white rounded-full flex items-center justify-center shrink-0 font-bold shadow-sm">
                    <Fuel className="w-5 h-5 text-[#FACC15]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-100 truncate">{log.equipmentName}</p>
                    <p className="text-[11px] text-emerald-200 uppercase font-bold truncate">
                      {log.driverOrOperatorName} • <span className="text-[#FACC15]">{log.liters}L</span>
                    </p>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-300 shrink-0">
                    {formatDateTimeBR(log.dateTime).split(' ')[1] || 'Hoje'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('fuel-logs')}
            className="mt-5 w-full py-3 bg-[#064E3B] hover:bg-[#043d2e] text-white text-xs font-bold rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 border border-emerald-700/50"
          >
            Ver Todos os Registros
          </button>
        </div>

      </div>

      {/* Tanques Centrais Section - Side by Side (Quadra & Itapeva) */}
      <div className="rounded-3xl border p-6 shadow-sm bg-[#042d23] border-emerald-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⛽</span>
              <h3 className="font-extrabold text-lg text-slate-100">Tanques Centrais</h3>
            </div>
            <p className="text-xs text-emerald-200 font-medium mt-0.5">
              Gestão e monitoramento de estoque em tempo real das sedes operacionais
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('refills')}
              className="px-3.5 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-[#FACC15] text-xs font-extrabold rounded-xl border border-emerald-700/60 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Entrada de Combustível
            </button>
            <button
              onClick={() => onNavigate('stations')}
              className="px-3.5 py-1.5 bg-[#064E3B] hover:bg-[#08634c] text-white text-xs font-extrabold rounded-xl border border-emerald-600/40 transition-colors flex items-center gap-1"
            >
              Ver Detalhes
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {centralTanksStatus.map(({ tank, status }) => {
            const isCritical = status.isCritical;
            const isLow = status.isLow;
            const statusLabel = isCritical ? '🔴 Estoque Crítico' : (isLow ? '⚠️ Estoque Baixo' : '🟢 Normal');
            const statusBadgeClass = isCritical 
              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
              : (isLow 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40');
            
            const progressColor = isCritical ? 'bg-red-500' : (isLow ? 'bg-amber-500' : 'bg-[#FACC15]');

            return (
              <div 
                key={tank.id} 
                className="p-5 rounded-2xl bg-emerald-950/70 border border-emerald-900/60 flex flex-col justify-between space-y-4 hover:border-emerald-700/60 transition-all shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⛽</span>
                      <h4 className="font-extrabold text-base text-slate-100">
                        {tank.name}
                      </h4>
                    </div>
                    <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                      Localização: <span className="text-slate-200 font-bold">{tank.location}</span> • <span className="text-[#FACC15]">{tank.fuelType}</span>
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border shrink-0 ${statusBadgeClass}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Progress & Metrics */}
                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider block">Estoque Atual / Capacidade</span>
                      <span className="text-xl font-black text-slate-100">
                        {Math.round(status.currentStock).toLocaleString('pt-BR')} L <span className="text-sm font-bold text-emerald-300">/ {status.capacity.toLocaleString('pt-BR')} L</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider block">Ocupação</span>
                      <span className="text-2xl font-black text-[#FACC15]">
                        {status.percentage}% <span className="text-xs font-bold text-emerald-300">da capacidade</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3.5 bg-emerald-900/90 rounded-full overflow-hidden border border-emerald-800/60 p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, status.percentage))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-emerald-200 font-semibold pt-1">
                    <span>Capacidade Máxima: <strong className="text-slate-100 font-extrabold">{status.capacity.toLocaleString('pt-BR')} L</strong></span>
                    <span>Mínimo de Alerta: <strong className="text-amber-300 font-extrabold">{status.minStockAlert.toLocaleString('pt-BR')} L</strong></span>
                  </div>

                  {/* Low / Critical Stock Alert Notice */}
                  {isLow && (
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                      isCritical ? 'bg-red-950/80 border-red-700/80 text-red-200' : 'bg-amber-950/80 border-amber-700/80 text-amber-200'
                    }`}>
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        🔴 Estoque baixo (Estoque atual: <strong>{Math.round(status.currentStock).toLocaleString('pt-BR')} L</strong> • Estoque mínimo: <strong>{status.minStockAlert.toLocaleString('pt-BR')} L</strong>)
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer details & actions */}
                <div className="pt-3 border-t border-emerald-900/60 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setSelectedTankForConfig(tank)}
                    className="text-[#FACC15] hover:text-amber-300 font-extrabold flex items-center gap-1.5 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurar Tanque</span>
                  </button>

                  <button
                    onClick={() => onNavigate('refills')}
                    className="text-emerald-200 hover:text-white font-bold flex items-center gap-1 transition-colors"
                  >
                    <span>Movimentações</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secondary Bento Grid Row (Alerts & Top Consumer) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Maintenance Alerts Bento Box */}
        <div className="bg-red-950/40 rounded-3xl border border-red-900/60 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              <h4 className="text-red-100 font-extrabold text-sm">Alertas Críticos & Manutenção Preventiva</h4>
            </div>
            <p className="text-red-200 text-xs font-bold mt-3">
              {vehicles.filter(v => v.status === 'EM_MANUTENCAO' || (v.status as any) === 'MANUTENCAO').length} Veículos em Manutenção Ativa
            </p>
            <p className="text-red-300 text-[11px] mt-1 font-medium leading-relaxed">
              Controle flexível por horímetro ou quilometragem para tratores, caminhões e máquinas agrícolas com planos individualizados.
            </p>
          </div>
          <button
            onClick={() => onNavigate('maintenance')}
            className="text-red-200 text-xs font-extrabold uppercase tracking-wider mt-5 flex items-center gap-1 hover:underline self-start"
          >
            Resolver & Gerenciar
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Top Consumer of TODAY Highlight Bento Box */}
        <div className="rounded-3xl border p-6 shadow-sm flex flex-col justify-between bg-[#042d23] border-emerald-900/60">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FACC15]" />
                <h4 className="text-slate-100 font-bold text-sm">Maior Consumidor de Hoje</h4>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FACC15]/20 text-[#FACC15]">
                {todayLogs.length} reg. hoje
              </span>
            </div>

            {todayTopOperator ? (
              <div className="bg-emerald-950/70 p-3.5 rounded-2xl border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-300">Funcionário / Operador:</span>
                  <span className="text-xs font-black text-[#FACC15]">{todayTopOperator.liters.toLocaleString('pt-BR')} Litros</span>
                </div>
                <p className="font-extrabold text-sm text-slate-100">{todayTopOperator.name}</p>
                <div className="flex items-center justify-between text-[11px] text-emerald-200 border-t border-emerald-900/40 pt-1.5 mt-1">
                  <span>{todayTopOperator.count} abastecimento(s) hoje</span>
                  <span className="font-bold text-slate-200">{formatCurrency(todayTopOperator.cost)}</span>
                </div>
                {todayTopEquipment && (
                  <p className="text-[10px] text-emerald-400/80 truncate">
                    Equipamento: <strong className="text-slate-200">{todayTopEquipment.name}</strong> ({todayTopEquipment.plate})
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-900/30 text-center space-y-1">
                <p className="text-xs font-extrabold text-slate-300">Nenhum abastecimento hoje</p>
                <p className="text-lg font-black text-[#FACC15]">0 Litros</p>
                <p className="text-[10px] text-emerald-300/70">Os abastecimentos do dia atual serão computados aqui automaticamente.</p>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('fuel')}
            className="text-[#FACC15] text-xs font-bold hover:underline flex items-center gap-1 mt-4 self-start"
          >
            Ver Abastecimentos de Hoje
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Operation Breakdown Row */}
      <div className="rounded-3xl border p-6 shadow-sm bg-[#042d23] border-emerald-900/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-100">Consumo por Tipo de Operação</h3>
            <p className="text-xs text-emerald-200 font-medium">Distribuição de combustível entre Grama, Colheita, Plantio e Transporte</p>
          </div>
          <span className="text-xs font-bold text-[#FACC15] bg-[#FACC15]/10 px-3 py-1 rounded-full border border-[#FACC15]/20">
            {monthLiters.toLocaleString('pt-BR')} L Totais
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {operationTypeData.map((op) => {
            const pct = Math.round((op.liters / (monthLiters || 1)) * 100);
            return (
              <div key={op.key} className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-900/40 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-100">{op.label}</span>
                  <span className="text-[10px] font-bold text-[#FACC15] bg-emerald-900 px-2 py-0.5 rounded-md">
                    {pct}%
                  </span>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-100">
                    {op.liters.toLocaleString('pt-BR')} <span className="text-xs font-bold text-emerald-400">L</span>
                  </p>
                  <p className="text-[11px] text-emerald-300 font-semibold">
                    {formatCurrency(op.cost)} • {op.count} abastecimentos
                  </p>
                </div>
                <div className="w-full h-1.5 bg-emerald-900 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FACC15] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NOVA SEÇÃO: Análise de Consumo (Gráfico 1: Por Categoria | Gráfico 2: Por Atividade / Serviço) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <h3 className="font-black text-lg text-slate-100">
                Análise Avançada de Consumo (Categoria & Atividade)
              </h3>
            </div>
            <p className="text-xs text-emerald-300 font-medium">
              Detalhamento de combustível pelo fluxo oficial: Categoria → Serviço / Atividade Personalizada → Abastecimento
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#FACC15] bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-800">
              Total Analisado: {totalCategoryLiters.toLocaleString('pt-BR')} L
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GRÁFICO 1: Consumo por Categoria (Litros e Porcentagem) - 5 cols */}
          <div className="lg:col-span-5 rounded-3xl border p-6 shadow-sm flex flex-col justify-between bg-[#042d23] border-emerald-900/60">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏷️</span>
                    <h4 className="font-extrabold text-base text-slate-100">
                      1. Consumo por Categoria
                    </h4>
                  </div>
                  <p className="text-[11px] text-emerald-300 font-medium">
                    Volume em litros e representatividade percentual (%)
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase text-[#FACC15] bg-[#FACC15]/10 px-2 py-1 rounded-md border border-[#FACC15]/20">
                  Gráfico 1
                </span>
              </div>

              {/* Donut Chart Visual */}
              <div className="h-52 w-full flex items-center justify-center my-2">
                {categoryConsumption.length > 0 ? (
                  areChartsReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={categoryConsumption}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="liters"
                          nameKey="label"
                        >
                          {categoryConsumption.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || '#10B981'} stroke="#042d23" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any, name: any, item: any) => [
                            `${Number(val).toLocaleString('pt-BR')} L (${item.payload.percentage}%)`,
                            item.payload.label
                          ]}
                          contentStyle={{
                            backgroundColor: '#022c22',
                            borderColor: '#065f46',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#f8fafc'
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-32 h-32 rounded-full border-4 border-emerald-800/40 border-t-[#FACC15] animate-spin" />
                  )
                ) : (
                  <div className="text-center text-xs text-emerald-300 font-medium">
                    Nenhum abastecimento para exibir no gráfico.
                  </div>
                )}
              </div>

              {/* Detailed Category Progress List */}
              <div className="space-y-2.5 mt-2">
                {categoryConsumption.map((cat) => (
                  <div 
                    key={cat.key} 
                    className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-900/50 space-y-1.5 transition-colors hover:bg-emerald-900/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.color || '#10B981' }} 
                        />
                        <span className="font-extrabold text-slate-100 truncate">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-slate-100">{cat.liters.toLocaleString('pt-BR')} L</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#FACC15]/20 text-[#FACC15] font-black text-[11px] border border-[#FACC15]/30">
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-emerald-900/90 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${Math.min(100, Math.max(0, cat.percentage))}%`,
                          backgroundColor: cat.color || '#FACC15'
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-900/60 flex items-center justify-between text-[11px] text-emerald-300 font-bold">
              <span>Total de Categorias: {categoryConsumption.length}</span>
              <span className="text-[#FACC15]">{totalCategoryLiters.toLocaleString('pt-BR')} L (100%)</span>
            </div>
          </div>

          {/* GRÁFICO 2: Consumo por Atividade & Serviços (Serviço + Atividade Personalizada + Litros) - 7 cols */}
          <div className="lg:col-span-7 rounded-3xl border p-6 shadow-sm flex flex-col justify-between bg-[#042d23] border-emerald-900/60">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚙️</span>
                    <h4 className="font-extrabold text-base text-slate-100">
                      2. Consumo por Atividade / Serviço
                    </h4>
                  </div>
                  <p className="text-[11px] text-emerald-300 font-medium">
                    Serviços cadastrados e atividades personalizadas ("Outros" + observação)
                  </p>
                </div>
                <span className="self-start sm:self-auto text-[10px] font-black uppercase text-[#FACC15] bg-[#FACC15]/10 px-2 py-1 rounded-md border border-[#FACC15]/20">
                  Gráfico 2
                </span>
              </div>

              {/* Interactive Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap pb-3 mb-3 border-b border-emerald-900/50">
                <button
                  onClick={() => setSelectedCategoryForActivity('ALL')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                    selectedCategoryForActivity === 'ALL'
                      ? 'bg-[#FACC15] text-[#064E3B] shadow-sm'
                      : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-900'
                  }`}
                >
                  Todas ({activityConsumption.length})
                </button>
                {OPERATION_OPTIONS.map((op) => {
                  const isSel = selectedCategoryForActivity === op.id;
                  return (
                    <button
                      key={op.id}
                      onClick={() => setSelectedCategoryForActivity(op.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        isSel
                          ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                          : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-900'
                      }`}
                    >
                      <span>{op.emoji}</span>
                      <span>{op.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Bar Chart Visual of Top Activities */}
              <div className="h-44 w-full mb-3 flex items-center justify-center">
                {activityConsumption.length > 0 ? (
                  areChartsReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={activityConsumption.slice(0, 6)}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#a7f3d0' }} />
                        <YAxis 
                          dataKey="activity" 
                          type="category" 
                          tick={{ fontSize: 10, fill: '#f8fafc', fontWeight: 'bold' }} 
                          width={95}
                        />
                        <Tooltip
                          formatter={(val: any, name: any, item: any) => [
                            `${Number(val).toLocaleString('pt-BR')} Litros (${item.payload.percentage}%)`,
                            item.payload.isCustom ? `⭐ ${item.payload.activity} (Personalizada)` : item.payload.activity
                          ]}
                          contentStyle={{
                            backgroundColor: '#022c22',
                            borderColor: '#065f46',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#f8fafc',
                          }}
                        />
                        <Bar dataKey="liters" fill="#FACC15" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full rounded-2xl bg-emerald-950/40 animate-pulse border border-emerald-900/30" />
                  )
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-emerald-300 font-medium">
                    Nenhuma atividade encontrada para a categoria selecionada.
                  </div>
                )}
              </div>

              {/* Activities List with Custom Tag highlight */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {activityConsumption.map((act, index) => (
                  <div
                    key={act.key || index}
                    className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-emerald-900/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs text-slate-100 truncate">
                          {act.activity}
                        </span>
                        {act.isCustom && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30">
                            ⭐ Atividade Personalizada
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-emerald-300 font-semibold">
                        Categoria: <span className="text-slate-200">{act.categoryLabel}</span> • {act.count} abastecimento(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <span className="text-sm font-black text-slate-100">
                        {act.liters.toLocaleString('pt-BR')} <span className="text-xs text-emerald-400 font-bold">L</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-900 text-emerald-200 font-black text-[11px] border border-emerald-700">
                        {act.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-900/60 flex items-center justify-between text-[11px] text-emerald-300 font-bold">
              <span>Atividades listadas: {activityConsumption.length}</span>
              <span className="text-[#FACC15]">Volume total: {totalActivityLiters.toLocaleString('pt-BR')} L</span>
            </div>
          </div>

        </div>
      </div>

      {/* Edit Central Tank Modal when clicked from Dashboard */}
      {selectedTankForConfig && (
        <React.Suspense fallback={null}>
          <EditCentralTankModal
            isOpen={!!selectedTankForConfig}
            tank={selectedTankForConfig}
            currentUser={currentUser}
            onClose={() => setSelectedTankForConfig(null)}
            onSave={async (tankId, updates, reason) => {
              await updateCentralTank(tankId, updates, reason);
            }}
            darkMode={darkMode}
          />
        </React.Suspense>
      )}

    </div>
  );
};

export const DashboardView = React.memo(DashboardViewComponent);
