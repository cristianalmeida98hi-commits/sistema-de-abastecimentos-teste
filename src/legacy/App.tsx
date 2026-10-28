/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initStorage, getCurrentUser, getUsers, getVehicles, getGasStations, 
  getFuelLogs, getMaintenanceLogs, getAlerts, getAuditLogs, getSettings,
  getMachineIssues, getPreventiveItems, addMachineIssue, resolveMachineIssue, recordPreventiveService,
  addFuelLog, updateFuelLog, deleteFuelLog, addVehicle, updateVehicle, deleteVehicle,
  addMaintenance, updateMaintenance, deleteMaintenance, addGasStation, updateGasStation, deleteGasStation, addUser,
  updateUser, deleteUser, resetUserPassword, resolveAlert, updateSettings, logoutUser,
  getStorageLoadingState, getFirestoreLoadError, StorageLoadingState, retryFirestoreConnection
} from './utils/storage';
import { User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, SystemSettings, MachineIssue, PreventiveMaintenanceItem } from './types';
import { autoSyncPushDevice } from './utils/pushNotifications';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationPermissionBanner } from './components/NotificationPermissionBanner';
import { CheckCircle2, Tractor, AlertTriangle, RefreshCw, WifiOff, Bell, X, Sparkles, Camera } from 'lucide-react';

import { LoginView } from './components/LoginView';

// Code-split dynamic views to drastically reduce initial bundle size and accelerate time-to-first-paint
const DashboardView = React.lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const FuelLogsView = React.lazy(() => import('./components/FuelLogsView').then(m => ({ default: m.FuelLogsView })));
const FleetManagementView = React.lazy(() => import('./components/FleetManagementView').then(m => ({ default: m.FleetManagementView })));
const MaintenanceView = React.lazy(() => import('./components/MaintenanceView').then(m => ({ default: m.MaintenanceView })));
const GasStationsView = React.lazy(() => import('./components/GasStationsView').then(m => ({ default: m.GasStationsView })));
const StaffView = React.lazy(() => import('./components/StaffView').then(m => ({ default: m.StaffView })));
const ReportsView = React.lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const AlertsView = React.lazy(() => import('./components/AlertsView').then(m => ({ default: m.AlertsView })));
const AuditLogsView = React.lazy(() => import('./components/AuditLogsView').then(m => ({ default: m.AuditLogsView })));
const SettingsAndAboutView = React.lazy(() => import('./components/SettingsAndAboutView').then(m => ({ default: m.SettingsAndAboutView })));
const OperatorFuelingView = React.lazy(() => import('./components/OperatorFuelingView').then(m => ({ default: m.OperatorFuelingView })));
const OperatorDigitalSheetsView = React.lazy(() => import('./components/OperatorDigitalSheetsView').then(m => ({ default: m.OperatorDigitalSheetsView })));
const QRCodeModuleView = React.lazy(() => import('./components/QRCodeModuleView').then(m => ({ default: m.QRCodeModuleView })));

// Dynamic modals loaded on demand
const FuelingFormModal = React.lazy(() => import('./components/FuelingFormModal').then(m => ({ default: m.FuelingFormModal })));
const QRCodeScannerModal = React.lazy(() => import('./components/QRCodeScannerModal').then(m => ({ default: m.QRCodeScannerModal })));
const MachineDigitalSheetModal = React.lazy(() => import('./components/MachineDigitalSheetModal').then(m => ({ default: m.MachineDigitalSheetModal })));

function ViewLoadingFallback() {
  return (
    <div className="w-full min-h-[380px] rounded-3xl bg-[#042d23]/50 border border-emerald-800/40 p-8 flex flex-col items-center justify-center space-y-4 animate-pulse">
      <div className="w-14 h-14 rounded-2xl bg-[#064E3B] border border-[#FACC15]/30 flex items-center justify-center shadow-lg">
        <Tractor className="w-7 h-7 text-[#FACC15] animate-pulse" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-bold text-white tracking-wide">Carregando módulo Andrade Agro...</p>
        <p className="text-[11px] text-emerald-300/60">Aguarde um instante</p>
      </div>
    </div>
  );
}

function LoginLoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#031d16] text-slate-100 font-sans">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#042d23] border border-emerald-800/60 shadow-2xl text-center space-y-4 animate-pulse">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-[#064E3B] border border-[#FACC15]/40 flex items-center justify-center">
          <Tractor className="w-8 h-8 text-[#FACC15]" />
        </div>
        <p className="text-xs text-emerald-300/80 font-bold">Carregando Andrade Agro...</p>
      </div>
    </div>
  );
}

export default function App() {
  // 1. All useState Hooks grouped strictly at the top
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => getUsers());
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getVehicles());
  const [gasStations, setGasStations] = useState<GasStation[]>(() => getGasStations());
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(() => getFuelLogs());
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => getMaintenanceLogs());
  const [machineIssues, setMachineIssues] = useState<MachineIssue[]>(() => getMachineIssues());
  const [preventiveItems, setPreventiveItems] = useState<PreventiveMaintenanceItem[]>(() => getPreventiveItems());
  const [alerts, setAlerts] = useState<SmartAlert[]>(() => getAlerts());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getAuditLogs());
  const [settings, setSettings] = useState<SystemSettings>(() => getSettings());
  const [storageStatus, setStorageStatus] = useState<StorageLoadingState>(() => getStorageLoadingState());

  // Main scrollable content reference
  const mainContentRef = useRef<HTMLElement>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Feedback State
  const [isFuelingModalOpen, setIsFuelingModalOpen] = useState<boolean>(false);
  const [preSelectedVehicleId, setPreSelectedVehicleId] = useState<string | undefined>(undefined);
  const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState<boolean>(false);
  const [selectedDigitalSheetVehicle, setSelectedDigitalSheetVehicle] = useState<Vehicle | null>(null);
  const [digitalSheetInitialTab, setDigitalSheetInitialTab] = useState<'PREVENTIVE' | 'HISTORY' | 'TIMELINE' | 'OVERVIEW' | 'ISSUES'>('OVERVIEW');
  const [digitalSheetInitialIssueId, setDigitalSheetInitialIssueId] = useState<string | undefined>(undefined);
  const [digitalSheetInitialAction, setDigitalSheetInitialAction] = useState<string | undefined>(undefined);
  const [highlightedTankId, setHighlightedTankId] = useState<string | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
  const [highlightedMaintenanceId, setHighlightedMaintenanceId] = useState<string | null>(null);
  const [inAppPushAlert, setInAppPushAlert] = useState<{
    title: string;
    body: string;
    data: any;
  } | null>(null);
  const [fuelingSuccessFeedback, setFuelingSuccessFeedback] = useState<{
    show: boolean;
    liters: number;
    equipmentName: string;
  } | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [loadingTakingLonger, setLoadingTakingLonger] = useState<boolean>(false);

  const darkMode = true;

  // 2. Sync state on storage/Firestore updates with non-blocking transition
  const refreshState = useCallback(() => {
    React.startTransition(() => {
      const freshUser = getCurrentUser();
      setCurrentUser(freshUser);
      setUsers(getUsers());
      setVehicles(getVehicles());
      setGasStations(getGasStations());
      setFuelLogs(getFuelLogs());
      setMaintenanceLogs(getMaintenanceLogs());
      setMachineIssues(getMachineIssues());
      setPreventiveItems(getPreventiveItems());
      setAlerts(getAlerts());
      setAuditLogs(getAuditLogs());
      setSettings(getSettings());
      setStorageStatus(getStorageLoadingState());
    });
  }, []);

  // Storage initialization, cross-platform mobile lifecycle & network listeners
  useEffect(() => {
    initStorage();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      const handleOnline = () => {
        setIsOffline(false);
        refreshState();
      };
      const handleOffline = () => setIsOffline(true);

      const handleResume = () => {
        setIsOffline(!navigator.onLine);
        refreshState();
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') handleResume();
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('andradeagro_network_status', handleResume);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pageshow', handleResume);
      window.addEventListener('focus', handleResume);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('andradeagro_network_status', handleResume);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handleResume);
        window.removeEventListener('focus', handleResume);
      };
    }
  }, [refreshState]);

  // Guarantee scroll starts at top on login, user change, or tab navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [activeTab, currentUser?.id]);

  useEffect(() => {
    window.addEventListener('andradeagro_data_updated', refreshState);
    return () => window.removeEventListener('andradeagro_data_updated', refreshState);
  }, [refreshState]);

  // Keep push notification subscriptions active and synced for any user who granted permission
  useEffect(() => {
    if (currentUser?.id) {
      autoSyncPushDevice(currentUser).catch(err => {
        console.warn('[Push Sync] Non-blocking auto sync:', err);
      });
    }
  }, [currentUser?.id]);

  // Intelligent idle prefetching of next views (optimized: mobile leaves memory and bandwidth dedicated to active view)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefetchViews = () => {
      const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        // On mobile devices, keep memory lean and load views strictly on demand when user navigates
        return;
      }
      if (currentUser?.role === 'FUNCIONARIO') {
        import('./components/OperatorDigitalSheetsView');
        import('./components/FuelingFormModal');
        import('./components/QRCodeScannerModal');
      } else if (currentUser) {
        import('./components/DashboardView');
        import('./components/FleetManagementView');
        import('./components/FuelLogsView');
        import('./components/MaintenanceView');
        import('./components/FuelingFormModal');
      }
    };
    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(prefetchViews, { timeout: 2000 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(prefetchViews, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.role]);

  // Mobile / slow connection detection: inform user and allow cached data fallback after timeout
  useEffect(() => {
    if (storageStatus === 'LOADING') {
      const timer = setTimeout(() => {
        setLoadingTakingLonger(true);
      }, 4500);

      // Safety fallback: after 7.5s, if cache has vehicles or users, transition smoothly to loaded
      const fallbackTimer = setTimeout(() => {
        const cachedVehicles = getVehicles();
        if (cachedVehicles.length > 0) {
          console.warn('[Andrade Agro Mobile] Sincronização demorada. Carregando dados do cache local...');
          setStorageStatus('LOADED_WITH_DATA');
        }
      }, 7500);

      return () => {
        clearTimeout(timer);
        clearTimeout(fallbackTimer);
      };
    } else {
      setLoadingTakingLonger(false);
    }
  }, [storageStatus]);

  // 4. Sync tab when currentUser changes or logs in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'FUNCIONARIO') {
        const allowedFuncionarioTabs = ['operator-fueling', 'digital-sheets'];
        if (!allowedFuncionarioTabs.includes(activeTab)) {
          setActiveTab('operator-fueling');
        }
      }
    }
  }, [currentUser, activeTab]);

  // 5. Listen for QR code scans or deep links via URL hash (only when data has finished loading)
  useEffect(() => {
    if (storageStatus === 'LOADING') return;

    const handleHashCheck = () => {
      const hash = window.location.hash;
      if (!hash) return;

      let matchedVehicleId: string | null = null;

      if (hash.includes('vehicle/') || hash.includes('maintenance/') || hash.includes('ficha-maquina/')) {
        const parts = hash.split('/');
        matchedVehicleId = parts[parts.length - 1];
      } else if (hash.includes('ANDRADEAGRO:')) {
        const parts = hash.split(':');
        matchedVehicleId = parts[1];
      }

      if (matchedVehicleId) {
        const found = vehicles.find(v => v.id === matchedVehicleId || v.licensePlate === matchedVehicleId || v.patrimonyCode === matchedVehicleId);
        if (found) {
          setSelectedDigitalSheetVehicle(found);
          setIsFuelingModalOpen(false);
          setIsQRScannerModalOpen(false);
        }
      }
    };

    handleHashCheck();
    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, [vehicles, storageStatus]);

  // 6. Comprehensive Deep-Linking Navigation Engine (Handles URL parameters, push clicks, and in-app alerts)
  const applyDeepLink = useCallback((params: {
    tab?: string | null;
    equipmentId?: string | null;
    sheetTab?: string | null;
    tankId?: string | null;
    issueId?: string | null;
    maintenanceId?: string | null;
    action?: string | null;
  }) => {
    if (!params) return;

    const freshUser = getCurrentUser();
    if (!freshUser) {
      // User is not logged in: persist target in sessionStorage for instant post-login redirection
      if (params.tab) sessionStorage.setItem('andradeagro_post_login_tab', params.tab);
      if (params.equipmentId) sessionStorage.setItem('andradeagro_post_login_equipment_id', params.equipmentId);
      if (params.sheetTab) sessionStorage.setItem('andradeagro_post_login_sheet_tab', params.sheetTab);
      if (params.tankId) sessionStorage.setItem('andradeagro_post_login_tank_id', params.tankId);
      if (params.issueId) sessionStorage.setItem('andradeagro_post_login_issue_id', params.issueId);
      if (params.maintenanceId) sessionStorage.setItem('andradeagro_post_login_maintenance_id', params.maintenanceId);
      if (params.action) sessionStorage.setItem('andradeagro_post_login_action', params.action);
      return;
    }

    // Role-specific navigation routing
    if (freshUser.role === 'FUNCIONARIO') {
      if (params.equipmentId) {
        const currentVehicles = getVehicles();
        const found = currentVehicles.find(v => v.id === params.equipmentId || v.licensePlate === params.equipmentId || v.patrimonyCode === params.equipmentId);
        if (found) {
          setSelectedDigitalSheetVehicle(found);
          setDigitalSheetInitialTab('OVERVIEW');
        }
      }
      return;
    }

    // User is ADMIN or MANUTENCAO
    // 1. Tab & View Routing
    if (params.tab === 'stations' || params.tab === 'gas-stations' || params.tankId) {
      setActiveTab('stations');
      if (params.tankId) {
        setHighlightedTankId(params.tankId);
      }
    } else if (params.tab === 'alerts' && !params.issueId) {
      setActiveTab('alerts');
    } else if (params.tab === 'maintenance' || params.maintenanceId || params.action === 'oil_change') {
      setActiveTab('maintenance');
      if (params.maintenanceId) {
        setHighlightedMaintenanceId(params.maintenanceId);
      }
    } else if (params.tab && ['dashboard', 'fleet', 'settings', 'staff', 'reports', 'qr-codes', 'digital-sheets', 'audit'].includes(params.tab)) {
      setActiveTab(params.tab);
    }

    // 2. Equipment Ficha & Specific Defect / Tab Opening
    let targetEquipId = params.equipmentId;
    if (!targetEquipId && params.issueId) {
      const cleanIssueId = params.issueId.startsWith('issue-') ? params.issueId.slice(6) : params.issueId;
      const issues = getMachineIssues();
      const matchIssue = issues.find(i => i.id === cleanIssueId || i.id === params.issueId);
      if (matchIssue) {
        targetEquipId = matchIssue.equipmentId;
      }
    }

    if (targetEquipId) {
      const currentVehicles = getVehicles();
      const found = currentVehicles.find(v => v.id === targetEquipId || v.licensePlate === targetEquipId || v.patrimonyCode === targetEquipId);
      if (found) {
        setSelectedDigitalSheetVehicle(found);
        if (params.issueId) {
          setDigitalSheetInitialTab('ISSUES');
          setDigitalSheetInitialIssueId(params.issueId);
          setDigitalSheetInitialAction(params.action || undefined);
        } else if (params.sheetTab && ['PREVENTIVE', 'HISTORY', 'TIMELINE', 'OVERVIEW', 'ISSUES'].includes(params.sheetTab)) {
          setDigitalSheetInitialTab(params.sheetTab as any);
        } else if (params.action === 'oil_change' || params.action === 'preventive') {
          setDigitalSheetInitialTab('PREVENTIVE');
        } else if (params.maintenanceId || params.action === 'maintenance_view') {
          setDigitalSheetInitialTab('HISTORY');
        } else {
          setDigitalSheetInitialTab('OVERVIEW');
        }
      }
    } else if (params.issueId) {
      // If equipment wasn't resolved, navigate to alerts tab as fallback
      setActiveTab('alerts');
      setHighlightedAlertId(params.issueId);
    }

    // Dismiss any blocking dialogs
    setIsFuelingModalOpen(false);
    setIsQRScannerModalOpen(false);

    // Clean URL query params safely without page reload
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  // Listen for initial URL Search Parameters (?tab=...&equipmentId=...&tankId=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const equipmentIdParam = urlParams.get('equipmentId');
    const sheetTabParam = urlParams.get('sheetTab');
    const tankIdParam = urlParams.get('tankId');
    const issueIdParam = urlParams.get('issueId');
    const maintenanceIdParam = urlParams.get('maintenanceId');
    const actionParam = urlParams.get('action');

    if (tabParam || equipmentIdParam || tankIdParam || issueIdParam || maintenanceIdParam) {
      applyDeepLink({
        tab: tabParam,
        equipmentId: equipmentIdParam,
        sheetTab: sheetTabParam,
        tankId: tankIdParam,
        issueId: issueIdParam,
        maintenanceId: maintenanceIdParam,
        action: actionParam
      });
    }
  }, [currentUser, applyDeepLink]);

  // Listen for Service Worker Messages (ANDRADEAGRO_NOTIFICATION_CLICK and ANDRADEAGRO_PUSH_EVENT)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'ANDRADEAGRO_NOTIFICATION_CLICK') {
        const urlStr = msg.url;
        const data = msg.data || {};
        if (urlStr) {
          try {
            const parsed = new URL(urlStr, window.location.origin);
            const pTab = parsed.searchParams.get('tab') || data.targetAction;
            const pEquip = parsed.searchParams.get('equipmentId') || data.equipmentId;
            const pSheetTab = parsed.searchParams.get('sheetTab') || data.sheetTab;
            const pTank = parsed.searchParams.get('tankId') || data.tankId;
            const pIssue = parsed.searchParams.get('issueId') || data.issueId;
            const pMaint = parsed.searchParams.get('maintenanceId') || data.maintenanceId;
            const pAction = parsed.searchParams.get('action');

            applyDeepLink({
              tab: pTab || undefined,
              equipmentId: pEquip || undefined,
              sheetTab: pSheetTab || undefined,
              tankId: pTank || undefined,
              issueId: pIssue || undefined,
              maintenanceId: pMaint || undefined,
              action: pAction || undefined
            });
          } catch {
            applyDeepLink(data);
          }
        } else {
          applyDeepLink(data);
        }
      } else if (msg.type === 'ANDRADEAGRO_PUSH_EVENT') {
        // Push arrived while app is open in foreground: show prominent real-time notification
        setInAppPushAlert({
          title: msg.title || 'Notificação AndradeAgro',
          body: msg.body || 'Novo evento registrado no sistema.',
          data: msg.data || {}
        });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [applyDeepLink]);

  // Handlers
  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setLoginSuccessMessage(null);

    // Retrieve post-login deep link redirection targets
    const postLoginTab = typeof window !== 'undefined' ? sessionStorage.getItem('andradeagro_post_login_tab') : null;
    const postLoginEquipmentId = typeof window !== 'undefined' ? sessionStorage.getItem('andradeagro_post_login_equipment_id') : null;
    const postLoginSheetTab = typeof window !== 'undefined' ? sessionStorage.getItem('andradeagro_post_login_sheet_tab') : null;
    const postLoginTankId = typeof window !== 'undefined' ? sessionStorage.getItem('andradeagro_post_login_tank_id') : null;
    const postLoginIssueId = typeof window !== 'undefined' ? sessionStorage.getItem('andradeagro_post_login_issue_id') : null;
    const postLoginMaintenanceId = typeof window !== 'undefined' ? sessionStorage.getItem('andradeagro_post_login_maintenance_id') : null;
    const postLoginAction = typeof window !== 'undefined' ? sessionStorage.getItem('andradeagro_post_login_action') : null;

    // Clean saved values immediately
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('andradeagro_post_login_tab');
      sessionStorage.removeItem('andradeagro_post_login_equipment_id');
      sessionStorage.removeItem('andradeagro_post_login_sheet_tab');
      sessionStorage.removeItem('andradeagro_post_login_tank_id');
      sessionStorage.removeItem('andradeagro_post_login_issue_id');
      sessionStorage.removeItem('andradeagro_post_login_maintenance_id');
      sessionStorage.removeItem('andradeagro_post_login_action');
    }

    if (postLoginTab || postLoginEquipmentId || postLoginTankId || postLoginIssueId || postLoginMaintenanceId) {
      applyDeepLink({
        tab: postLoginTab || undefined,
        equipmentId: postLoginEquipmentId || undefined,
        sheetTab: postLoginSheetTab || undefined,
        tankId: postLoginTankId || undefined,
        issueId: postLoginIssueId || undefined,
        maintenanceId: postLoginMaintenanceId || undefined,
        action: postLoginAction || undefined
      });
    } else if (user.role === 'FUNCIONARIO') {
      setActiveTab('operator-fueling');
    } else {
      setActiveTab('dashboard');
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }

    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      let matchedVehicleId: string | null = null;
      if (hash.includes('vehicle/') || hash.includes('maintenance/') || hash.includes('ficha-maquina/')) {
        const parts = hash.split('/');
        matchedVehicleId = parts[parts.length - 1];
      } else if (hash.includes('ANDRADEAGRO:')) {
        const parts = hash.split(':');
        matchedVehicleId = parts[1];
      }

      if (matchedVehicleId) {
        const currentVehicles = getVehicles();
        const found = currentVehicles.find(v => v.id === matchedVehicleId || v.licensePlate === matchedVehicleId || v.patrimonyCode === matchedVehicleId);
        if (found) {
          setSelectedDigitalSheetVehicle(found);
          setIsFuelingModalOpen(false);
          setIsQRScannerModalOpen(false);
        }
      }
    }
  };

  const handleOpenFuelingModalWithEquipment = useCallback((equipmentId: string) => {
    const currentVehicles = getVehicles();
    const eq = currentVehicles.find(v => v.id === equipmentId);
    if (eq && eq.fuelType === 'NENHUM') {
      alert('Esta máquina/equipamento não possui combustível definido e não pode ser abastecida.');
      return;
    }
    setPreSelectedVehicleId(equipmentId);
    setIsFuelingModalOpen(true);
  }, []);

  useEffect(() => {
    const handleCustomOpenFueling = (e: any) => {
      if (e?.detail?.vehicleId) {
        handleOpenFuelingModalWithEquipment(e.detail.vehicleId);
      }
    };
    window.addEventListener('andradeagro:open-fueling', handleCustomOpenFueling);
    return () => window.removeEventListener('andradeagro:open-fueling', handleCustomOpenFueling);
  }, [handleOpenFuelingModalWithEquipment]);

  const handleAddFuelLog = async (logData: Omit<FuelLog, 'id' | 'createdAt'>) => {
    try {
      await addFuelLog(logData);
      refreshState();

      if (currentUser && currentUser.role === 'FUNCIONARIO' && !selectedDigitalSheetVehicle) {
        setIsFuelingModalOpen(false);
        setFuelingSuccessFeedback({
          show: true,
          liters: logData.liters,
          equipmentName: logData.equipmentName || 'Equipamento'
        });

        setTimeout(() => {
          setFuelingSuccessFeedback(null);
          logoutUser();
          setCurrentUser(null);
          setLoginSuccessMessage(`✅ Abastecimento de ${logData.liters}L registrado com sucesso!`);
        }, 2200);
      } else {
        setIsFuelingModalOpen(false);
      }
    } catch (err: any) {
      console.error('Erro ao salvar abastecimento:', err);
      throw err;
    }
  };

  // If storage is LOADING, render Andrade Agro Loading Screen
  if (storageStatus === 'LOADING') {
    const isScanningQR = typeof window !== 'undefined' && (
      window.location.hash.includes('ficha-maquina') || 
      window.location.hash.includes('vehicle') ||
      window.location.hash.includes('ANDRADEAGRO')
    );

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#031d16] text-slate-100 font-sans">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#042d23] border border-emerald-800/60 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[#064E3B] border-2 border-[#FACC15]/40 flex items-center justify-center shadow-lg relative">
            <div className="absolute inset-0 rounded-3xl border-2 border-[#FACC15] animate-ping opacity-20" />
            <Tractor className="w-10 h-10 text-[#FACC15]" />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded-full bg-[#064E3B] text-[#FACC15] text-[10px] font-black tracking-widest uppercase border border-[#FACC15]/30">
              Andrade Agro
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              {isScanningQR ? 'Acessando Ficha da Máquina...' : 'Sincronizando Sistema Andrade Agro'}
            </h1>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              {isScanningQR
                ? 'Localizando equipamento e sincronizando histórico de manutenção e abastecimento...'
                : 'Conectando ao banco de dados e sincronizando frotas, combustíveis e manutenções em tempo real...'}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="w-full bg-emerald-950/80 rounded-full h-2 overflow-hidden border border-emerald-800/60">
              <div className="bg-gradient-to-r from-emerald-500 via-[#FACC15] to-emerald-400 h-full w-2/3 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-emerald-400/80 font-semibold px-1">
              <span>Status: Conectando</span>
              <span>Aguarde um instante</span>
            </div>
          </div>

          {loadingTakingLonger && (
            <div className="pt-2 border-t border-emerald-800/40 space-y-2.5 animate-in fade-in duration-300">
              <p className="text-[11px] text-amber-300 font-medium">
                Conexão móvel com oscilação. Deseja tentar restabelecer o sinal?
              </p>
              <button
                onClick={() => retryFirestoreConnection()}
                className="px-3.5 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border border-emerald-600/50 flex items-center justify-center gap-1.5 mx-auto transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar Reconectar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If storage is ERROR and we have NO data to display and no authenticated user, render Connection Error Screen
  if (storageStatus === 'ERROR' && vehicles.length === 0 && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#031d16] text-slate-100 font-sans">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#042d23] border border-amber-900/60 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-950/80 border border-amber-800 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">Instabilidade Temporária de Conexão</h2>
            <p className="text-xs text-amber-200/80">
              {getFirestoreLoadError() || 'Não foi possível sincronizar os dados no momento. Verifique sua conexão com a internet.'}
            </p>
          </div>
          <button
            onClick={() => retryFirestoreConnection()}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-transform active:scale-95"
          >
            Tentar Reconectar
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, render Login Screen
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        darkMode={darkMode}
        successMessage={loginSuccessMessage}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-row font-sans antialiased bg-[#031d16] text-slate-100 dark">
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
        onLogout={handleLogout}
        currentUser={currentUser}
        alerts={alerts}
        darkMode={darkMode}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Offline Status Banner */}
        {isOffline && (
          <div className="bg-emerald-950/95 border-b border-emerald-800/80 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between gap-3 shadow-md z-30">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-[#FACC15] shrink-0" />
              <span>Modo Offline: Dados locais disponíveis. O sistema sincronizará assim que a conexão retornar.</span>
            </div>
            <span className="text-[10px] uppercase font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 shrink-0">
              Offline
            </span>
          </div>
        )}

        {/* Connection Notice Banner when temporary offline or reconnecting */}
        {getFirestoreLoadError() && (
          <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-3 shadow-md z-30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Instabilidade temporária na conexão. Seus dados continuam disponíveis localmente.</span>
            </div>
            <button
              onClick={() => retryFirestoreConnection()}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] transition-all shrink-0 active:scale-95"
            >
              Reconectar
            </button>
          </div>
        )}

        {/* Top Header */}
        <Header
          currentUser={currentUser}
          onUserChanged={(u) => { setCurrentUser(u); refreshState(); }}
          onLogout={handleLogout}
          onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
          onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
          onNavigate={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
          alerts={alerts}
          vehicles={vehicles}
          onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
          darkMode={darkMode}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Content View Container */}
        <main ref={mainContentRef} className="flex-1 p-3 sm:p-6 lg:p-8 pb-safe overflow-y-auto max-w-[1600px] w-full mx-auto">
          {/* Notification Permission Opt-in Banner for Admin and Maintenance */}
          <NotificationPermissionBanner currentUser={currentUser} />

          {/* Real-time Push Alert Banner when in foreground */}
          {inAppPushAlert && (
            <div className="w-full mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-900/60 to-emerald-950 border border-amber-500/60 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                {/* Photo thumbnail if attached */}
                {(inAppPushAlert.data?.image || inAppPushAlert.data?.photoUrl) ? (
                  <div className="relative group shrink-0">
                    <img
                      src={inAppPushAlert.data.image || inAppPushAlert.data.photoUrl}
                      alt="Foto do defeito"
                      className="w-14 h-14 rounded-xl object-cover border-2 border-amber-400/80 shadow-md bg-black/40"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow">
                      <Camera className="w-3 h-3 text-slate-950" />
                    </div>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-md">
                    <Bell className="w-5 h-5 text-slate-950 animate-bounce" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-amber-300 truncate">{inAppPushAlert.title}</h4>
                  <p className="text-xs text-emerald-100 line-clamp-2 mt-0.5 whitespace-pre-line">{inAppPushAlert.body}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {inAppPushAlert.data?.issueId && (currentUser.role === 'ADMIN' || currentUser.role === 'MANUTENCAO') && (
                  <button
                    onClick={() => {
                      applyDeepLink({
                        ...inAppPushAlert.data,
                        action: 'resolve'
                      });
                      setInAppPushAlert(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolver
                  </button>
                )}
                <button
                  onClick={() => {
                    applyDeepLink(inAppPushAlert.data);
                    setInAppPushAlert(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FACC15] hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95"
                >
                  {inAppPushAlert.data?.photoUrl || inAppPushAlert.data?.image ? 'Ver Defeito e Foto' : 'Ver Agora'}
                </button>
                <button
                  onClick={() => setInAppPushAlert(null)}
                  className="p-1.5 text-emerald-400 hover:text-white rounded-lg transition-colors"
                  title="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <ErrorBoundary key={activeTab}>
            <React.Suspense fallback={<ViewLoadingFallback />}>
              {activeTab === 'operator-fueling' && (
              <OperatorFuelingView
                currentUser={currentUser}
                vehicles={vehicles}
                gasStations={gasStations}
                onAddFuelLog={handleAddFuelLog}
                userLogs={fuelLogs}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'my-fuel-logs' && (
              <FuelLogsView
                fuelLogs={fuelLogs.filter(l => l.createdById === currentUser.id || l.driverOrOperatorId === currentUser.id)}
                vehicles={vehicles}
                gasStations={gasStations}
                users={users}
                currentUser={currentUser}
                settings={settings}
                onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
                onUpdateFuelLog={async (id, fields) => { await updateFuelLog(id, fields); refreshState(); }}
                onDeleteFuelLog={(id) => deleteFuelLog(id)}
                darkMode={darkMode}
                searchQuery={searchQuery}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                fuelLogs={fuelLogs}
                vehicles={vehicles}
                settings={settings}
                onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
                onNavigate={(tab) => setActiveTab(tab)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'fuel-logs' && (
              <FuelLogsView
                fuelLogs={fuelLogs}
                vehicles={vehicles}
                gasStations={gasStations}
                users={users}
                currentUser={currentUser}
                settings={settings}
                onOpenFuelingModal={() => { setPreSelectedVehicleId(undefined); setIsFuelingModalOpen(true); }}
                onUpdateFuelLog={async (id, fields) => { await updateFuelLog(id, fields); refreshState(); }}
                onDeleteFuelLog={(id) => deleteFuelLog(id)}
                darkMode={darkMode}
                searchQuery={searchQuery}
              />
            )}

            {activeTab === 'fleet' && (
              <FleetManagementView
                vehicles={vehicles}
                users={users}
                currentUser={currentUser}
                maintenanceLogs={maintenanceLogs}
                fuelLogs={fuelLogs}
                onAddVehicle={(v) => { addVehicle(v); refreshState(); }}
                onUpdateVehicle={async (id, fields) => { await updateVehicle(id, fields); refreshState(); }}
                onDeleteVehicle={(id) => { deleteVehicle(id); refreshState(); }}
                onOpenFuelingModalWithEquipment={handleOpenFuelingModalWithEquipment}
                onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'digital-sheets' && (
              <OperatorDigitalSheetsView
                vehicles={vehicles}
                users={users}
                currentUser={currentUser}
                maintenanceLogs={maintenanceLogs}
                fuelLogs={fuelLogs}
                preventiveItems={preventiveItems}
                alerts={alerts}
                machineIssues={machineIssues}
                onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
                onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
                darkMode={darkMode}
                searchQuery={searchQuery}
              />
            )}

            {activeTab === 'qr-codes' && (
              <QRCodeModuleView
                vehicles={vehicles}
                fuelLogs={fuelLogs}
                currentUser={currentUser}
                onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
                onOpenQRScanner={() => setIsQRScannerModalOpen(true)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'maintenance' && (
              <MaintenanceView
                maintenanceLogs={maintenanceLogs}
                vehicles={vehicles}
                users={users}
                currentUser={currentUser}
                onAddMaintenance={(m) => addMaintenance(m)}
                onUpdateMaintenance={(id, fields) => {
                  if (currentUser?.role !== 'MANUTENCAO') {
                    alert('Acesso negado: Somente o perfil MANUTENÇÃO possui autorização para editar registros de manutenção.');
                    return;
                  }
                  updateMaintenance(id, fields);
                }}
                onDeleteMaintenance={(id) => {
                  if (currentUser?.role !== 'MANUTENCAO') {
                    alert('Acesso negado: Somente o perfil MANUTENÇÃO possui autorização para excluir registros de manutenção.');
                    return;
                  }
                  deleteMaintenance(id);
                }}
                highlightedMaintenanceId={highlightedMaintenanceId}
                initialEquipmentId={preSelectedVehicleId}
                onOpenDigitalSheet={(v) => { setSelectedDigitalSheetVehicle(v); setDigitalSheetInitialTab('HISTORY'); }}
                onClearHighlight={() => setHighlightedMaintenanceId(null)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'stations' && (
              <GasStationsView
                gasStations={gasStations}
                onAddStation={(stn) => addGasStation(stn)}
                onUpdateStation={(id, fields) => updateGasStation(id, fields)}
                onDeleteStation={(id) => deleteGasStation(id)}
                highlightedTankId={highlightedTankId}
                onClearHighlightTank={() => setHighlightedTankId(null)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'staff' && (
              <StaffView
                users={users}
                currentUser={currentUser}
                onAddUser={(u) => addUser(u)}
                onUpdateUser={(id, fields) => updateUser(id, fields)}
                onDeleteUser={(id) => deleteUser(id)}
                onResetPassword={(id, newPass) => resetUserPassword(id, newPass)}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView
                fuelLogs={fuelLogs}
                vehicles={vehicles}
                gasStations={gasStations}
                users={users}
                currentUser={currentUser}
                settings={settings}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertsView
                alerts={alerts}
                currentUser={currentUser}
                onResolveAlert={(id) => { resolveAlert(id); refreshState(); }}
                vehicles={vehicles}
                onOpenDigitalSheet={(v) => { setSelectedDigitalSheetVehicle(v); setDigitalSheetInitialTab('ISSUES'); }}
                highlightedAlertId={highlightedAlertId}
                onClearHighlight={() => setHighlightedAlertId(null)}
                darkMode={darkMode}
                machineIssues={machineIssues}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLogsView
                auditLogs={auditLogs}
                currentUser={currentUser}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsAndAboutView
                settings={settings}
                currentUser={currentUser}
                onUpdateSettings={(newSettings) => updateSettings(newSettings)}
                darkMode={darkMode}
              />
            )}
          </React.Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Modals */}
      <React.Suspense fallback={null}>
        {isFuelingModalOpen && (
          <FuelingFormModal
            isOpen={isFuelingModalOpen}
            onClose={() => setIsFuelingModalOpen(false)}
            onSubmit={handleAddFuelLog}
            vehicles={vehicles}
            gasStations={gasStations}
            users={users}
            currentUser={currentUser}
            previousLogs={fuelLogs}
            settings={settings}
            preSelectedVehicleId={preSelectedVehicleId}
            darkMode={darkMode}
          />
        )}

        {isQRScannerModalOpen && (
          <QRCodeScannerModal
            isOpen={isQRScannerModalOpen}
            onClose={() => setIsQRScannerModalOpen(false)}
            vehicles={vehicles}
            fuelLogs={fuelLogs}
            onOpenDigitalSheet={(v) => setSelectedDigitalSheetVehicle(v)}
            darkMode={darkMode}
          />
        )}

        {selectedDigitalSheetVehicle && (
          <MachineDigitalSheetModal
            isOpen={!!selectedDigitalSheetVehicle}
            onClose={() => {
              setSelectedDigitalSheetVehicle(null);
              setDigitalSheetInitialTab('OVERVIEW');
              setDigitalSheetInitialIssueId(undefined);
              setDigitalSheetInitialAction(undefined);
              if (typeof window !== 'undefined' && window.location.hash) {
                history.pushState("", document.title, window.location.pathname + window.location.search);
              }
            }}
            vehicle={vehicles.find(v => v.id === selectedDigitalSheetVehicle.id) || selectedDigitalSheetVehicle}
            vehicles={vehicles}
            fuelLogs={fuelLogs}
            maintenanceLogs={maintenanceLogs}
            machineIssues={machineIssues}
            preventiveItems={preventiveItems}
            alerts={alerts}
            currentUser={currentUser}
            initialTab={digitalSheetInitialTab}
            initialIssueId={digitalSheetInitialIssueId}
            initialAction={digitalSheetInitialAction}
            onOpenFuelingModalWithEquipment={handleOpenFuelingModalWithEquipment}
            onAddMaintenance={(m) => { addMaintenance(m); refreshState(); }}
            onUpdateMaintenance={(id, fields) => {
              if (currentUser?.role !== 'MANUTENCAO') {
                alert('Acesso negado: Somente o perfil MANUTENÇÃO possui permissão para editar registros da linha do tempo.');
                return;
              }
              updateMaintenance(id, fields);
              refreshState();
            }}
            onDeleteMaintenance={(id) => {
              if (currentUser?.role !== 'MANUTENCAO') {
                alert('Acesso negado: Somente o perfil MANUTENÇÃO possui permissão para excluir registros da linha do tempo.');
                return;
              }
              deleteMaintenance(id);
              refreshState();
            }}
            onReportProblemSubmit={(issueData) => { addMachineIssue(issueData); refreshState(); }}
            onRecordPreventiveService={(equipmentId, itemKey, currentHourmeter, notes) => { recordPreventiveService(equipmentId, itemKey, currentHourmeter, notes); refreshState(); }}
            onResolveIssue={(issueId) => { resolveMachineIssue(issueId); refreshState(); }}
            onUpdateVehicleStatus={(vehicleId, newStatus) => { updateVehicle(vehicleId, { status: newStatus }); refreshState(); }}
            darkMode={darkMode}
          />
        )}
      </React.Suspense>

      {/* Fueling Success Feedback Toast / Overlay (Problem 4) */}
      {fuelingSuccessFeedback?.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-emerald-950 border-2 border-amber-400 p-6 sm:p-8 rounded-3xl text-center space-y-4 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500 text-gray-950 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">✅ Abastecimento Salvo!</h3>
              <p className="text-sm font-bold text-amber-400">
                {fuelingSuccessFeedback.liters} Litros Registrados
              </p>
              <p className="text-xs text-emerald-200">
                {fuelingSuccessFeedback.equipmentName}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-900/60 rounded-xl text-[11px] text-emerald-300 font-medium">
              Redirecionando para a tela inicial...
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
