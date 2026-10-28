import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, Filter, QrCode, Truck, Wrench, 
  CheckCircle2, AlertTriangle, Clock, ChevronRight, Droplet
} from 'lucide-react';
import { Vehicle, User, MaintenanceLog, FuelLog, PreventiveMaintenanceItem, SmartAlert, MachineIssue } from '../types';
import { getSectorName } from '../utils/calculations';
import { calculateOilChangeStatus } from '../utils/maintenanceCalculations';

interface OperatorDigitalSheetsViewProps {
  vehicles: Vehicle[];
  users: User[];
  currentUser: User;
  maintenanceLogs: MaintenanceLog[];
  fuelLogs: FuelLog[];
  preventiveItems?: PreventiveMaintenanceItem[];
  alerts?: SmartAlert[];
  machineIssues?: MachineIssue[];
  onOpenDigitalSheet: (vehicle: Vehicle) => void;
  onOpenQRScanner: () => void;
  darkMode: boolean;
  searchQuery?: string;
}

export const OperatorDigitalSheetsView: React.FC<OperatorDigitalSheetsViewProps> = ({
  vehicles,
  users,
  currentUser,
  maintenanceLogs,
  fuelLogs,
  preventiveItems = [],
  alerts = [],
  machineIssues = [],
  onOpenDigitalSheet,
  onOpenQRScanner,
  darkMode,
  searchQuery = ''
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');

  const activeSearch = searchQuery || localSearch;

  // Helper to check vehicle oil change alert status using official calculations
  const getVehicleOilAlertStatus = (v: Vehicle) => {
    const oilStatus = calculateOilChangeStatus(v);
    if (!oilStatus.isOilActive) {
      return {
        hasAlert: false,
        isOverdue: false,
        isUpcoming: false,
        hoursRemaining: 0,
        hoursOrKmOverdue: 0,
        nextMeter: 0,
        unit: 'h',
        unitWord: 'horas'
      };
    }

    const unitWord = oilStatus.unit === 'km' ? 'quilômetros' : 'horas';

    return {
      hasAlert: oilStatus.status === 'ATRASADA' || oilStatus.status === 'PROXIMA',
      isOverdue: oilStatus.status === 'ATRASADA',
      isUpcoming: oilStatus.status === 'PROXIMA',
      hoursRemaining: oilStatus.remaining,
      hoursOrKmOverdue: oilStatus.hoursOrKmOverdue,
      nextMeter: oilStatus.nextMeter,
      unit: oilStatus.unit,
      unitWord
    };
  };

  // Total vehicles with overdue oil changes
  const vehiclesWithOilAlerts = useMemo(() => {
    return vehicles.filter(v => getVehicleOilAlertStatus(v).isOverdue);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (categoryFilter === 'OIL_ALERTS') {
        const oilStatus = getVehicleOilAlertStatus(v);
        if (!oilStatus.isOverdue && !oilStatus.isUpcoming) return false;
      } else if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'MAQUINA' && v.category !== 'MAQUINA_AGRICOLA' && v.category !== 'IMPLEMENTO') return false;
        if (categoryFilter === 'VEICULO' && v.category !== 'VEICULO') return false;
      }

      if (activeSearch) {
        const q = activeSearch.toLowerCase();
        const matchModel = v.model.toLowerCase().includes(q);
        const matchCode = (v.patrimonyCode || v.licensePlate || '').toLowerCase().includes(q);
        const matchBrand = v.manufacturer.toLowerCase().includes(q);
        if (!matchModel && !matchCode && !matchBrand) return false;
      }

      return true;
    });
  }, [vehicles, categoryFilter, activeSearch, alerts, preventiveItems]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Banner / Header */}
      <div className={`p-6 rounded-3xl border relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl ${
        darkMode ? 'bg-gradient-to-r from-[#043327] via-[#064E3B] to-[#042d23] border-emerald-800/80 text-white' : 'bg-[#064E3B] text-white border-emerald-900'
      }`}>
        <div className="space-y-1 max-w-2xl z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FACC15] text-[#064E3B] font-extrabold text-[11px] uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            <span>Fichas Digitais dos Equipamentos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Consulta Técnica & Histórico Individual
          </h1>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            Acesse a ficha técnica detalhada, horímetro atualizado, alertas de troca de óleo (ciclos de revisão preventiva) e histórico de manutenções de cada máquina.
          </p>
        </div>

        <button
          onClick={onOpenQRScanner}
          className="z-10 px-5 py-3.5 rounded-2xl bg-[#FACC15] hover:bg-amber-300 text-[#064E3B] font-black text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95 shrink-0"
        >
          <QrCode className="w-5 h-5 text-[#064E3B]" />
          <span>ESCANEAR QR CODE</span>
        </button>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#FACC15]/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Prominent Oil Change Alert Header Banner if any machines need oil change */}
      {vehiclesWithOilAlerts.length > 0 && (
        <div className="p-4 rounded-3xl bg-red-500/15 border-2 border-red-500/40 text-red-700 dark:text-red-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-red-800 dark:text-red-200">
                🚨 Atenção: {vehiclesWithOilAlerts.length} Equipamento(s) com Troca de Óleo Vencida!
              </h3>
              <p className="text-xs text-red-700/90 dark:text-red-300/90 font-medium">
                O limite programado de horas ou km foi atingido. Realize a troca e registre na ficha da máquina.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCategoryFilter('OIL_ALERTS')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow transition-transform active:scale-95 shrink-0"
          >
            Ver Máquinas Vencidas ({vehiclesWithOilAlerts.length})
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por trator, patrimônio, modelo ou marca..."
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-xs font-semibold outline-none transition-all ${
              darkMode 
                ? 'bg-[#042d23] border-emerald-900 text-slate-100 placeholder-emerald-600 focus:border-[#FACC15]' 
                : 'bg-white border-slate-200 text-slate-900 focus:border-[#064E3B]'
            }`}
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Todos os Equipamentos' },
            ...(vehiclesWithOilAlerts.length > 0 ? [{ id: 'OIL_ALERTS', label: `🚨 Troca de Óleo (${vehiclesWithOilAlerts.length})` }] : []),
            { id: 'MAQUINA', label: 'Máquinas & Tratores' },
            { id: 'VEICULO', label: 'Veículos & Caminhões' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3.5 py-2.5 rounded-2xl font-black text-xs transition-all whitespace-nowrap ${
                categoryFilter === cat.id
                  ? cat.id === 'OIL_ALERTS' ? 'bg-red-600 text-white shadow-md' : 'bg-[#064E3B] text-[#FACC15] shadow-md'
                  : darkMode 
                    ? 'bg-emerald-950/60 text-slate-300 hover:bg-emerald-900/60 border border-emerald-900/40' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Equipment Cards */}
      {filteredVehicles.length === 0 ? (
        <div className={`p-12 text-center rounded-3xl border border-dashed space-y-3 ${
          darkMode ? 'bg-emerald-950/20 border-emerald-900 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <Truck className="w-12 h-12 mx-auto text-slate-400 opacity-60" />
          <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
            Nenhuma máquina encontrada
          </h3>
          <p className="text-xs max-w-sm mx-auto">
            Tente modificar os termos da busca ou limpe os filtros para visualizar a frota cadastrada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map(vehicle => {
            const vehicleMntLogs = maintenanceLogs.filter(m => m.equipmentId === vehicle.id);
            const lastMnt = vehicleMntLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const oilStatus = getVehicleOilAlertStatus(vehicle);
            
            return (
              <div
                key={vehicle.id}
                onClick={() => onOpenDigitalSheet(vehicle)}
                className={`group p-4 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 hover:shadow-xl hover:-translate-y-0.5 ${
                  oilStatus.isOverdue
                    ? darkMode
                      ? 'bg-[#042d23] border-red-500/80 shadow-md shadow-red-950/40 text-slate-100'
                      : 'bg-white border-red-500 shadow-md shadow-red-100 text-slate-900'
                    : darkMode 
                      ? 'bg-[#042d23] border-emerald-900/60 hover:border-[#FACC15]/80 text-slate-100' 
                      : 'bg-white border-slate-200 hover:border-[#064E3B] text-slate-900'
                }`}
              >
                {/* Card Top: Photo + Status + Identity */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 dark:bg-emerald-950 border border-slate-300 dark:border-emerald-800 shrink-0 shadow-sm relative">
                      {vehicle.photoUrl ? (
                        <img 
                          src={vehicle.photoUrl} 
                          alt={vehicle.model} 
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Truck className="w-7 h-7" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-[#064E3B] text-[#FACC15]">
                          {vehicle.category === 'MAQUINA_AGRICOLA' ? 'MÁQUINA' : vehicle.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                          vehicle.status === 'ATIVO' 
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                            : vehicle.status === 'EM_MANUTENCAO'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                          {vehicle.status === 'ATIVO' ? '🟢 ATIVA' : vehicle.status === 'EM_MANUTENCAO' ? '🟡 MANUTENÇÃO' : '🔴 PARADA'}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate mt-1 group-hover:text-[#FACC15] transition-colors">
                        {vehicle.model}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-500 truncate">
                        Cod: {vehicle.patrimonyCode || vehicle.licensePlate || 'N/A'} • {vehicle.manufacturer}
                      </p>
                    </div>
                  </div>

                  {/* Oil Change Alert Highlight Inside Card */}
                  {oilStatus.isOverdue ? (
                    <div className="p-2.5 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <strong className="block text-[11px] font-black uppercase text-red-600 dark:text-red-400">
                          🚨 Troca de Óleo Vencida
                        </strong>
                        <span className="text-[10px] opacity-90 block">
                          {oilStatus.hoursOrKmOverdue > 0
                            ? `Excedida em ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')} ${oilStatus.unitWord}`
                            : `Limite de ${oilStatus.nextMeter.toLocaleString('pt-BR')} ${oilStatus.unit} atingido`}
                        </span>
                      </div>
                    </div>
                  ) : oilStatus.isUpcoming ? (
                    <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <strong className="block text-[11px] font-black uppercase text-amber-700 dark:text-amber-300">
                          Troca de Óleo Próxima
                        </strong>
                        <span className="text-[10px] opacity-90 block">
                          Faltam {oilStatus.hoursRemaining.toLocaleString('pt-BR')} {oilStatus.unitWord} para a troca de óleo
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Em dia
                      </span>
                      <span className="text-[10px] opacity-80 font-medium">
                        Faltam {oilStatus.hoursRemaining.toLocaleString('pt-BR')} {oilStatus.unit}
                      </span>
                    </div>
                  )}

                  {/* Meter & Sector Specs */}
                  <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border border-slate-100 dark:border-emerald-900/40">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Uso Atual:</span>
                      <strong className="font-black text-slate-900 dark:text-slate-100">
                        {vehicle.category === 'VEICULO' ? `${vehicle.currentKm} km` : `${vehicle.currentHourmeter || 0} h`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Setor:</span>
                      <strong className="font-bold text-emerald-800 dark:text-emerald-300 truncate block">
                        {getSectorName(vehicle.sector)}
                      </strong>
                    </div>
                  </div>

                  {/* Spraying Tank Badge if applicable */}
                  {(vehicle.sprayingTankCapacityLiters || 0) > 0 && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-between text-xs">
                      <span className="text-cyan-800 dark:text-cyan-300 font-bold flex items-center gap-1 text-[11px]">
                        <Droplet className="w-3.5 h-3.5 text-cyan-500" /> Tanque Pulverização:
                      </span>
                      <strong className="text-cyan-950 dark:text-cyan-100 font-black text-[11px]">
                        {vehicle.sprayingTankCapacityLiters?.toLocaleString('pt-BR')} L
                      </strong>
                    </div>
                  )}

                  {/* Last Maintenance note */}
                  <div className="text-[11px] text-slate-500 dark:text-emerald-300/80 flex items-center justify-between border-t pt-2 border-slate-100 dark:border-emerald-900/40">
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-amber-500" />
                      <span>Última Manut:</span>
                    </span>
                    <strong className="text-slate-700 dark:text-slate-200">
                      {lastMnt ? new Date(lastMnt.date).toLocaleDateString('pt-BR') : 'Sem registros'}
                    </strong>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDigitalSheet(vehicle);
                  }}
                  className={`w-full py-2.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                    oilStatus.isOverdue
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#064E3B] hover:bg-[#043327] text-[#FACC15] group-hover:bg-[#08634a]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>{oilStatus.isOverdue ? 'VER ALERTA & FICHA DIGITAL' : 'ABRIR FICHA DIGITAL'}</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
