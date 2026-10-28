import React, { useState } from 'react';
import { 
  Search, Bell, Plus, LogOut, CheckCircle2, AlertTriangle, Menu, QrCode 
} from 'lucide-react';
import { User, SmartAlert, Vehicle } from '../types';

interface HeaderProps {
  currentUser: User;
  onUserChanged: (user: User) => void;
  onLogout: () => void;
  onOpenFuelingModal: () => void;
  onOpenQRScanner: () => void;
  onNavigate: (tab: string) => void;
  alerts: SmartAlert[];
  vehicles?: Vehicle[];
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  darkMode?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleMobileMenu?: () => void;
}

export const HeaderComponent: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onOpenFuelingModal,
  onOpenQRScanner,
  onNavigate,
  alerts = [],
  vehicles = [],
  onOpenDigitalSheet,
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
}) => {
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const unresolvedAlerts = React.useMemo(() => (alerts || []).filter(a => !a.resolved), [alerts]);

  React.useEffect(() => {
    if (!showAlertsDropdown) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAlertsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showAlertsDropdown]);

  return (
    <header className="sticky top-0 z-30 border-b transition-colors pt-safe min-h-[4rem] flex items-center bg-[#04281f]/95 border-emerald-900/60 text-[#f8fafc] backdrop-blur-md">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-2 sm:py-0">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Section Title & Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {onToggleMobileMenu && (
              <button
                onClick={onToggleMobileMenu}
                className="p-2 min-h-[44px] min-w-[44px] rounded-xl border border-emerald-800 bg-emerald-900/50 text-emerald-200 hover:bg-emerald-800/60 md:hidden flex items-center justify-center shrink-0"
                title="Abrir Menu Principal"
                aria-label="Abrir Menu Principal"
              >
                <Menu className="w-5 h-5 text-[#FACC15]" />
              </button>
            )}
            <div className="flex items-center md:hidden shrink-0">
              <div className="bg-white px-2 py-1 rounded-lg shadow-xs border border-white/20 flex items-center justify-center">
                <img src="/andrade-agro-logo.png" alt="AndradeAgro" className="h-5 w-auto object-contain" />
              </div>
            </div>
            <h1 className="text-sm sm:text-lg font-bold text-slate-100 truncate">
              {currentUser.role === 'FUNCIONARIO' 
                ? 'Módulo do Operador' 
                : currentUser.role === 'MANUTENCAO' 
                  ? 'Painel de Manutenção & Frotas' 
                  : 'Painel de Gestão & Auditoria'}
            </h1>
          </div>

          {/* Quick Search Input */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Pesquisar por placa, trator, operador ou posto..."
                className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-full border border-emerald-800 transition-all outline-none bg-emerald-950/80 text-slate-100 placeholder-emerald-300/80 focus:ring-2 focus:ring-[#FACC15]/40"
              />
            </div>
          </div>

          {/* Actions & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* Quick QR Code Scanner Button */}
            <button
              onClick={onOpenQRScanner}
              className="bg-emerald-950/80 hover:bg-emerald-900 text-slate-100 font-bold text-xs px-3 sm:px-3.5 py-2 min-h-[44px] rounded-full shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-emerald-700/60"
              title="Ler QR Code da Máquina"
              aria-label="Ler QR Code"
            >
              <QrCode className="w-5 h-5 sm:w-4 sm:h-4 text-[#FACC15]" />
              <span className="hidden md:inline">Ler QR Code</span>
            </button>

            {/* Quick Fuel Log Button */}
            <button
              onClick={onOpenFuelingModal}
              className="bg-[#064E3B] hover:bg-[#043d2e] text-white font-bold text-xs px-3 sm:px-4 py-2 min-h-[44px] rounded-full shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-emerald-700/50"
            >
              <Plus className="w-5 h-5 sm:w-4 sm:h-4 text-[#C5A059]" />
              <span className="hidden sm:inline">Novo Abastecimento</span>
            </button>

            {/* Notifications Bell */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                className="w-10 h-10 sm:w-9 sm:h-9 min-h-[44px] sm:min-h-0 rounded-full border flex items-center justify-center relative transition-colors bg-emerald-900/40 border-emerald-800 text-emerald-200 hover:bg-emerald-800/60"
                title="Alertas e Notificações"
              >
                <Bell className="w-4.5 h-4.5" />
                {unresolvedAlerts.length > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-[#04281f] rounded-full"></span>
                )}
              </button>

              {/* Alerts Dropdown Popover */}
              {showAlertsDropdown && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl shadow-2xl border p-4 z-50 animate-in fade-in slide-in-from-top-2 bg-[#042d23] border-emerald-800 text-emerald-100">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-900/50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-xs">Alertas Críticos ({unresolvedAlerts.length})</span>
                    </div>
                    <button 
                      onClick={() => { setShowAlertsDropdown(false); onNavigate('alerts'); }}
                      className="text-[11px] text-[#C5A059] font-bold hover:underline"
                    >
                      Ver Todos
                    </button>
                  </div>

                  {unresolvedAlerts.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                      Nenhum alerta pendente.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {unresolvedAlerts.slice(0, 4).map(alert => {
                        const targetVehicle = alert.equipmentId && vehicles ? vehicles.find(v => v.id === alert.equipmentId) : undefined;
                        return (
                          <div 
                            key={alert.id}
                            onClick={() => {
                              setShowAlertsDropdown(false);
                              if (targetVehicle && onOpenDigitalSheet) {
                                onOpenDigitalSheet(targetVehicle);
                              } else {
                                onNavigate('alerts');
                              }
                            }}
                            className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                              alert.severity === 'ALTA' 
                                ? 'bg-red-50 border-red-100 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200' 
                                : 'bg-emerald-50 border-emerald-100 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-200'
                            }`}
                            title={targetVehicle ? `Abrir ficha técnica de ${targetVehicle.model}` : 'Ver alertas'}
                          >
                            <div className="font-semibold flex items-center justify-between mb-0.5">
                              <span>{alert.title}</span>
                              <span className="text-[10px] opacity-75">{alert.date}</span>
                            </div>
                            <p className="text-[11px] opacity-90 line-clamp-2">{alert.description}</p>
                            {alert.photoUrl && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <img
                                  src={alert.photoUrl}
                                  alt="Foto do defeito"
                                  className="w-12 h-9 object-cover rounded-lg border border-amber-500/40 shadow-xs"
                                />
                                <span className="text-[10px] text-amber-300 font-bold">Foto anexada</span>
                              </div>
                            )}
                            {targetVehicle && (
                              <span className="text-[10px] font-bold text-amber-500 mt-1 block">
                                ➜ Abrir Ficha: {targetVehicle.model} ({targetVehicle.patrimonyCode || targetVehicle.licensePlate || 'Frota'})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile Info Badge */}
            <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border bg-emerald-900/40 border-emerald-800">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                }}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-[#C5A059]/60"
              />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold leading-none text-slate-100">{currentUser.name}</p>
                <p className="text-[9px] font-bold text-[#C5A059] mt-0.5 uppercase tracking-wider">
                  {currentUser.role === 'ADMIN' ? 'Administrador' : currentUser.role === 'MANUTENCAO' ? 'Manutenção' : 'Operador'}
                </p>
              </div>
            </div>

            {/* Logout Quick Button */}
            <button
              onClick={onLogout}
              className="p-2 rounded-full border text-red-400 hover:bg-red-950/50 transition-colors border-emerald-900"
              title="Sair da Conta (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};

export const Header = React.memo(HeaderComponent);
