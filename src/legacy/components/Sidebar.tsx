import React from 'react';
import { 
  LayoutDashboard, Fuel, Truck, Wrench, Fuel as GasPump, Users, 
  FileSpreadsheet, AlertTriangle, ShieldCheck, Settings, ChevronRight,
  Leaf, QrCode, LogOut, X
} from 'lucide-react';
import { User, SmartAlert } from '../types';

interface SidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  currentUser: User;
  alerts: SmartAlert[];
  darkMode: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const SidebarComponent: React.FC<SidebarProps> = ({
  activeTab,
  onNavigate,
  onLogout,
  currentUser,
  alerts = [],
  darkMode,
  collapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const unresolvedAlertsCount = React.useMemo(() => (alerts || []).filter(a => !a.resolved).length, [alerts]);

  const navItems = React.useMemo(() => {
    return currentUser.role === 'FUNCIONARIO' 
      ? [
          { id: 'operator-fueling', label: 'Lançamento de Campo', icon: Fuel, badge: 'Rápido' },
          { id: 'digital-sheets', label: 'Fichas Digitais das Máquinas', icon: FileSpreadsheet, badge: 'Máquinas' }
        ]
      : [
          { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard, badge: null },
          { id: 'fuel-logs', label: 'Abastecimentos', icon: Fuel, badge: null },
          { id: 'fleet', label: 'Veículos & Máquinas', icon: Truck, badge: null },
          { id: 'digital-sheets', label: 'Fichas Digitais', icon: FileSpreadsheet, badge: null },
          { id: 'qr-codes', label: 'Módulo QR Code', icon: QrCode, badge: 'QR' },
          { id: 'maintenance', label: 'Manutenções Gerais', icon: Wrench, badge: null },
          { id: 'stations', label: 'Postos & Preços', icon: GasPump, badge: null },
          { id: 'staff', label: 'Equipe & Motoristas', icon: Users, badge: null },
          { id: 'reports', label: 'Relatórios', icon: FileSpreadsheet, badge: 'PDF' },
          { 
            id: 'alerts', 
            label: 'Alertas', 
            icon: AlertTriangle, 
            badge: unresolvedAlertsCount > 0 ? `${unresolvedAlertsCount}` : null,
            badgeColor: 'bg-[#FACC15] text-[#064E3B] font-bold'
          },
          { id: 'audit', label: 'Auditoria & Logs', icon: ShieldCheck, badge: null },
          { id: 'settings', label: 'Configurações', icon: Settings, badge: null },
        ];
  }, [currentUser.role, unresolvedAlertsCount]);

  const handleItemClick = (id: string) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full w-full">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex flex-col items-start gap-1 border-b border-white/10 relative">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 cursor-pointer select-none group" onClick={() => handleItemClick('dashboard')}>
            {collapsed && !isMobileOpen ? (
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1 shadow-xs border border-white/20 hover:scale-105 transition-transform" title="AndradeAgro">
                <span className="text-base font-black text-[#0B6133] tracking-tighter">AA</span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="bg-white px-3.5 py-1.5 rounded-xl shadow-xs border border-white/20 flex items-center justify-center hover:bg-white/90 transition-all">
                  <img src="/andrade-agro-logo.png" alt="AndradeAgro" className="h-7 w-auto max-w-[175px] object-contain" />
                </div>
              </div>
            )}
          </div>

          {/* Desktop collapse button or Mobile Close button */}
          {isMobileOpen ? (
            <button
              onClick={onCloseMobile}
              className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors md:hidden"
              title="Fechar Menu"
              aria-label="Fechar Menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors hidden md:block"
              title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Nav Items List */}
      <nav className="flex-1 py-4 sm:py-6 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map(item => {
          if ((item as any).adminOnly && currentUser.role !== 'ADMIN') return null;

          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              title={collapsed && !isMobileOpen ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl transition-all font-semibold text-xs sm:text-sm ${
                isActive
                  ? 'bg-white/20 text-white font-extrabold border-l-4 border-[#FACC15] shadow-inner'
                  : 'text-emerald-100/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#FACC15]' : 'text-emerald-100'}`} />
              
              {(!collapsed || isMobileOpen) && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      item.badgeColor || 'bg-white/20 text-[#FACC15] border border-white/20'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 bg-[#FACC15] rounded-full overflow-hidden border-2 border-white/30 shrink-0 flex items-center justify-center font-bold text-[#064E3B] text-xs">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')
            )}
          </div>
          {(!collapsed || isMobileOpen) && (
            <div className="overflow-hidden min-w-0">
              <p className="text-white text-xs font-bold truncate">{currentUser.name}</p>
              <p className="text-[#FACC15] text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1">
                {currentUser.role === 'ADMIN' ? '👑 Administrador' : currentUser.role === 'MANUTENCAO' ? '🔧 Manutenção' : '👷 Operador'}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className="p-2 min-h-[44px] min-w-[44px] rounded-xl hover:bg-white/10 text-emerald-100 hover:text-red-300 transition-colors shrink-0 flex items-center justify-center"
          title="Sair do Sistema"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer (Visible when isMobileOpen on small screens) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer Body */}
          <aside className={`relative w-72 max-w-[85vw] h-full pt-safe pb-safe flex flex-col shadow-2xl transition-all duration-300 ease-in-out ${
            darkMode 
              ? 'bg-[#043327] border-r border-emerald-900/40 text-slate-100' 
              : 'bg-[#064E3B] text-white'
          }`}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar (Hidden on mobile) */}
      <aside className={`hidden md:flex transition-all duration-300 ease-in-out flex-col shrink-0 shadow-xl z-20 ${
        collapsed ? 'w-20' : 'w-64'
      } ${
        darkMode 
          ? 'bg-[#043327] border-r border-emerald-900/40 text-slate-100' 
          : 'bg-[#064E3B] text-white'
      }`}>
        {sidebarContent}
      </aside>
    </>
  );
};

export const Sidebar = React.memo(SidebarComponent);

