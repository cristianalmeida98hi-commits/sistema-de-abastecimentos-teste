import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch,
  query, orderBy, limit
} from 'firebase/firestore';
import { db, safeSetDoc, safeUpdateDoc, ensureFirebaseAuth } from '../lib/firebase';
import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog, SmartAlert, AuditLog, 
  SystemSettings, MachineIssue, PreventiveMaintenanceItem, PreventiveItemKey, 
  FuelRefill, CentralTank, TankMovement, ScheduledServiceItem, MaintenanceControlType 
} from '../types';
import { 
  INITIAL_USERS, INITIAL_VEHICLES, INITIAL_GAS_STATIONS, 
  INITIAL_FUEL_LOGS, INITIAL_FUEL_REFILLS, INITIAL_MAINTENANCE_LOGS, INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS, INITIAL_SETTINGS, INITIAL_MACHINE_ISSUES, INITIAL_PREVENTIVE_ITEMS,
  INITIAL_CENTRAL_TANKS, INITIAL_TANK_MOVEMENTS 
} from '../data/seedData';
import { 
  hashPassword, verifyPassword, canManageUsers, sanitizeUserForClient 
} from './security';
import { 
  dispatchPushNotificationEvent, cleanupPushOnLogout, clearPushEventDeduplication 
} from './pushNotifications';
import { 
  getTodayDateSaoPaulo, createTimestampForDateSaoPaulo, getNowSaoPauloISO 
} from './calculations';
import { deleteDefectPhotos } from './defectPhotoService';
import { validateHourmeterReading } from './hourmeterValidation';

const SESSION_KEYS = {
  SESSION_USER: 'andradeagro_session_user_v1',
  REMEMBERED_EMAIL: 'andradeagro_remembered_email_v1',
  PERSISTENT_ADMIN_SESSION: 'andradeagro_persistent_admin_session_v1',
  PERSISTENT_SESSION: 'andradeagro_persistent_session_v2'
};

// Helper to remove any undefined fields before saving to Firestore (Firestore rejects undefined)
export function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        cleaned[key] = cleanUndefined(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned as T;
}

// In-Memory Live Cache synced directly with Firestore in real-time
let cache = {
  users: [] as User[],
  vehicles: [] as Vehicle[],
  gasStations: [] as GasStation[],
  centralTanks: [] as CentralTank[],
  tankMovements: [] as TankMovement[],
  fuelLogs: [] as FuelLog[],
  fuelRefills: [] as FuelRefill[],
  maintenanceLogs: [] as MaintenanceLog[],
  machineIssues: [] as MachineIssue[],
  preventiveItems: [] as PreventiveMaintenanceItem[],
  alerts: [] as SmartAlert[],
  auditLogs: [] as AuditLog[],
  settings: INITIAL_SETTINGS as SystemSettings
};

const CACHE_STORAGE_KEY = 'andradeagro_local_cache_v2';
let isInitialized = false;
let notifyDebounceTimer: any = null;
let alertCheckDebounceTimer: any = null;
let saveLocalCacheTimer: any = null;
let activeFirestoreUnsubscribers: (() => void)[] = [];

export type StorageLoadingState = 'LOADING' | 'LOADED_EMPTY' | 'LOADED_WITH_DATA' | 'ERROR';

let storageLoadingState: StorageLoadingState = 'LOADING';
let firestoreLoadError: string | null = null;
const loadedCollections = new Set<string>();

// Pre-load persistent local cache to guarantee zero-latency rendering and offline protection
function loadInitialCacheFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(CACHE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.users) && parsed.users.length > 0) cache.users = parsed.users;
        if (Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0) cache.vehicles = parsed.vehicles;
        if (Array.isArray(parsed.gasStations) && parsed.gasStations.length > 0) cache.gasStations = parsed.gasStations;
        if (Array.isArray(parsed.centralTanks) && parsed.centralTanks.length > 0) cache.centralTanks = parsed.centralTanks;
        if (Array.isArray(parsed.tankMovements) && parsed.tankMovements.length > 0) cache.tankMovements = parsed.tankMovements;
        if (Array.isArray(parsed.fuelLogs) && parsed.fuelLogs.length > 0) cache.fuelLogs = parsed.fuelLogs;
        if (Array.isArray(parsed.fuelRefills) && parsed.fuelRefills.length > 0) cache.fuelRefills = parsed.fuelRefills;
        if (Array.isArray(parsed.maintenanceLogs) && parsed.maintenanceLogs.length > 0) cache.maintenanceLogs = parsed.maintenanceLogs;
        if (Array.isArray(parsed.machineIssues) && parsed.machineIssues.length > 0) cache.machineIssues = parsed.machineIssues;
        if (Array.isArray(parsed.preventiveItems) && parsed.preventiveItems.length > 0) cache.preventiveItems = parsed.preventiveItems;
        if (Array.isArray(parsed.alerts)) cache.alerts = parsed.alerts;
        if (parsed.settings) cache.settings = { ...INITIAL_SETTINGS, ...parsed.settings };

        if (cache.vehicles.length > 0 || cache.users.length > 0) {
          storageLoadingState = 'LOADED_WITH_DATA';
        }
      }
    }
  } catch (e) {
    // Non-fatal, continuing to live network fetch
  }
}

// Immediately hydrate cache so initial render is instantaneous
loadInitialCacheFromStorage();

function persistLocalCacheDebounced() {
  if (typeof window === 'undefined') return;
  if (saveLocalCacheTimer) clearTimeout(saveLocalCacheTimer);
  saveLocalCacheTimer = setTimeout(() => {
    try {
      // Exclude volatile/large auditLogs from localStorage to save CPU and avoid quota issues
      const { auditLogs, ...persistentCache } = cache;
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(persistentCache));
    } catch {
      // ignore storage quota errors
    }
  }, 1200);
}

function updateLoadingStatus() {
  const hasCore = loadedCollections.has('vehicles') && loadedCollections.has('users');
  if (hasCore) {
    const hasData = cache.vehicles.length > 0 || cache.users.length > 0;
    storageLoadingState = hasData ? 'LOADED_WITH_DATA' : 'LOADED_EMPTY';
    firestoreLoadError = null;
  } else if (cache.vehicles.length > 0 || cache.users.length > 0) {
    storageLoadingState = 'LOADED_WITH_DATA';
  }
}

export function getStorageLoadingState(): StorageLoadingState {
  return storageLoadingState;
}

export function getFirestoreLoadError(): string | null {
  return firestoreLoadError;
}

export function isStorageReady(): boolean {
  return storageLoadingState === 'LOADED_WITH_DATA' || storageLoadingState === 'LOADED_EMPTY';
}

// Clean up any active listeners to prevent duplicates and memory leaks
export function clearFirestoreListeners() {
  for (const unsub of activeFirestoreUnsubscribers) {
    try {
      unsub();
    } catch {
      // ignore
    }
  }
  activeFirestoreUnsubscribers = [];
}

// Internal Firestore Listeners Setup
function setupFirestoreListeners() {
  // Prevent duplicate listeners
  clearFirestoreListeners();

  try {
    // 1. Users Subscription
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
      if (items.length > 0 || cache.users.length === 0) {
        cache.users = items;
      }
      loadedCollections.add('users');
      firestoreLoadError = null;
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => {
      console.warn('[Firestore Users Connection]', err?.message || err);
      if (cache.users.length === 0 && cache.vehicles.length === 0) {
        firestoreLoadError = 'Falha ao sincronizar usuários com o banco de dados.';
        storageLoadingState = 'ERROR';
      }
      notifyDataUpdated();
    });
    activeFirestoreUnsubscribers.push(unsubUsers);

    // 2. Vehicles / Machines Subscription
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle));
      if (items.length > 0 || cache.vehicles.length === 0) {
        cache.vehicles = items;
      }
      loadedCollections.add('vehicles');
      firestoreLoadError = null;
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => {
      console.warn('[Firestore Vehicles Connection]', err?.message || err);
      if (cache.vehicles.length === 0 && cache.users.length === 0) {
        firestoreLoadError = 'Falha ao sincronizar máquinas e equipamentos com o banco de dados.';
        storageLoadingState = 'ERROR';
      }
      notifyDataUpdated();
    });
    activeFirestoreUnsubscribers.push(unsubVehicles);

    // 3. Central Tanks Subscription (Tanques Centrais: Quadra e Itapeva)
    const unsubCentralTanks = onSnapshot(collection(db, 'central_tanks'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CentralTank));
      if (items.length > 0 || cache.centralTanks.length === 0) {
        cache.centralTanks = items;
      }
      loadedCollections.add('central_tanks');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore CentralTanks Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubCentralTanks);

    // 3.1 Tank Movements Subscription
    const unsubTankMovements = onSnapshot(collection(db, 'tank_movements'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TankMovement));
      items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      if (items.length > 0 || cache.tankMovements.length === 0) {
        cache.tankMovements = items;
      }
      loadedCollections.add('tank_movements');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore TankMovements Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubTankMovements);

    // 3.2 Gas Stations Subscription
    const unsubGasStations = onSnapshot(collection(db, 'gas_stations'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as GasStation));
      if (items.length > 0 || cache.gasStations.length === 0) {
        cache.gasStations = items;
      }
      loadedCollections.add('gas_stations');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore GasStations Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubGasStations);

    // 4. Fuel Logs Subscription
    const unsubFuelLogs = onSnapshot(collection(db, 'fuel_logs'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FuelLog));
      items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      if (items.length > 0 || cache.fuelLogs.length === 0) {
        cache.fuelLogs = items;
      }
      loadedCollections.add('fuel_logs');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore FuelLogs Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubFuelLogs);

    // 4.1 Fuel Refills Subscription
    const unsubFuelRefills = onSnapshot(collection(db, 'fuel_refills'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FuelRefill));
      items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      if (items.length > 0 || cache.fuelRefills.length === 0) {
        cache.fuelRefills = items;
      }
      loadedCollections.add('fuel_refills');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore FuelRefills Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubFuelRefills);

    // 5. Maintenance Logs Subscription
    const unsubMaintenanceLogs = onSnapshot(collection(db, 'maintenance_logs'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceLog));
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (items.length > 0 || cache.maintenanceLogs.length === 0) {
        cache.maintenanceLogs = items;
      }
      loadedCollections.add('maintenance_logs');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore MaintenanceLogs Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubMaintenanceLogs);

    // 6. Machine Issues Subscription
    const unsubIssues = onSnapshot(collection(db, 'machine_issues'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MachineIssue));
      items.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      if (items.length > 0 || cache.machineIssues.length === 0) {
        cache.machineIssues = items;
      }
      loadedCollections.add('machine_issues');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore Issues Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubIssues);

    // 7. Preventive Items Subscription
    const unsubPreventive = onSnapshot(collection(db, 'preventive_items'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PreventiveMaintenanceItem));
      if (items.length > 0 || cache.preventiveItems.length === 0) {
        cache.preventiveItems = items;
      }
      loadedCollections.add('preventive_items');
      updateLoadingStatus();
      notifyDataUpdated();
    }, (err) => console.warn('[Firestore Preventive Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubPreventive);

    // 8. Alerts Subscription
    const unsubAlerts = onSnapshot(collection(db, 'alerts'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SmartAlert));
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (items.length > 0 || cache.alerts.length === 0) {
        cache.alerts = items;
      }
      loadedCollections.add('alerts');
      notifyDataUpdated(false);
    }, (err) => console.warn('[Firestore Alerts Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubAlerts);

    // 9. Audit Logs Subscription (Otimizado: limita aos 150 registros mais recentes em tempo real, economizando banda e memória)
    const auditQuery = query(collection(db, 'audit_logs'), orderBy('dateTime', 'desc'), limit(150));
    const unsubAudit = onSnapshot(auditQuery, (snapshot) => {
      const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
      if (items.length > 0 || cache.auditLogs.length === 0) {
        cache.auditLogs = items;
      }
      loadedCollections.add('audit_logs');
      notifyDataUpdated(false);
    }, (err) => {
      console.warn('[Firestore AuditLogs Connection]', err?.message || err);
      try {
        const unsubFallback = onSnapshot(collection(db, 'audit_logs'), (snap) => {
          const fallbackItems = snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
          fallbackItems.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
          cache.auditLogs = fallbackItems.slice(0, 150);
          loadedCollections.add('audit_logs');
          notifyDataUpdated(false);
        });
        activeFirestoreUnsubscribers.push(unsubFallback);
      } catch (fallbackErr) {
        console.warn('[Firestore AuditLogs Fallback Connection]', fallbackErr);
      }
    });
    activeFirestoreUnsubscribers.push(unsubAudit);

    // 10. System Settings Subscription
    const unsubSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
      if (!snapshot.empty) {
        const configDoc = snapshot.docs.find(d => d.id === 'config') || snapshot.docs[0];
        if (configDoc) {
          cache.settings = configDoc.data() as SystemSettings;
          loadedCollections.add('settings');
          notifyDataUpdated();
        }
      }
    }, (err) => console.warn('[Firestore Settings Connection]', err?.message || err));
    activeFirestoreUnsubscribers.push(unsubSettings);

    // Verificação agendada da retenção de 90 dias de logs de auditoria (executa no máx. 1x a cada 24h)
    maybeTriggerAuditLogAutoCleanup();

  } catch (err) {
    console.error('[Firestore init error]', err);
    if (cache.vehicles.length === 0 && cache.users.length === 0) {
      firestoreLoadError = 'Falha temporária ao inicializar o banco de dados.';
      storageLoadingState = 'ERROR';
    }
    notifyDataUpdated();
  }
}

// User-invoked or automatic reconnection attempt
export function retryFirestoreConnection() {
  firestoreLoadError = null;
  if (cache.vehicles.length === 0 && cache.users.length === 0) {
    storageLoadingState = 'LOADING';
  }
  ensureFirebaseAuth().catch(() => {});
  setupFirestoreListeners();
  notifyDataUpdated();
}

// Initialize Firebase Firestore Real-Time Listeners
export function initStorage() {
  if (isInitialized && typeof window !== 'undefined') return;
  isInitialized = true;

  // Purge any legacy auth keys from previous versions to avoid auto-login glitches
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('andradeagro_remembered_user_v1');
      localStorage.removeItem('andradeagro_remembered_user');
      localStorage.removeItem('andradeagro_user');
      localStorage.removeItem('andradeagro_current_user');
    } catch (e) {
      // ignore
    }

    // Auto-reconnect when device regains network connectivity
    window.addEventListener('online', () => {
      console.log('[Andrade Agro Mobile] Conexão com a rede restabelecida. Reconectando...');
      retryFirestoreConnection();
    });

    window.addEventListener('offline', () => {
      console.warn('[Andrade Agro Mobile] Dispositivo offline. Mantendo dados e frotas do cache local.');
      window.dispatchEvent(new Event('andradeagro_network_status'));
    });

    // Mobile background suspension & PWA resume handling for Android Chrome & iOS Safari
    let lastBackgroundSuspendTime = 0;
    let lastWakeupSyncTime = 0;

    const handleMobileResume = () => {
      const now = Date.now();
      const suspendedDuration = lastBackgroundSuspendTime > 0 ? now - lastBackgroundSuspendTime : 0;
      // Resync when app was suspended for at least 3.5 seconds and at least 4 seconds have passed since last wakeup sync
      if ((suspendedDuration > 3500 || suspendedDuration === 0) && (now - lastWakeupSyncTime) > 4000) {
        lastWakeupSyncTime = now;
        lastBackgroundSuspendTime = 0;
        console.log(`[Andrade Agro Mobile] Retorno do segundo plano (${Math.round(suspendedDuration / 1000)}s). Verificando conexão e estado...`);
        ensureFirebaseAuth().catch(() => {});
        setupFirestoreListeners();
        notifyDataUpdated(false);
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        lastBackgroundSuspendTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        handleMobileResume();
      }
    });

    // Mobile bfcache restoration (back-forward cache in mobile Safari / Chrome)
    window.addEventListener('pageshow', (event) => {
      handleMobileResume();
    });

    // Window focus restoration (e.g. switching back from camera, WhatsApp or another app)
    window.addEventListener('focus', () => {
      handleMobileResume();
    });
  }

  // Attempt to ensure Firebase Auth session asynchronously without blocking real-time subscriptions
  ensureFirebaseAuth().catch(() => {});
  setupFirestoreListeners();
}

export function notifyDataUpdated(shouldCheckAlerts: boolean = true) {
  if (typeof window !== 'undefined') {
    if (notifyDebounceTimer) clearTimeout(notifyDebounceTimer);
    notifyDebounceTimer = setTimeout(() => {
      window.dispatchEvent(new Event('andradeagro_data_updated'));
      persistLocalCacheDebounced();
    }, 120);

    if (shouldCheckAlerts && isStorageReady() && cache.vehicles.length > 0) {
      if (alertCheckDebounceTimer) clearTimeout(alertCheckDebounceTimer);
      alertCheckDebounceTimer = setTimeout(() => {
        checkAutomatedAlerts();
      }, 1500);
    }
  }
}

async function seedCollection(colName: string, items: any[]) {
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      if (item.id) {
        batch.set(doc(db, colName, String(item.id)), cleanUndefined(item));
      }
    }
    await batch.commit();
  } catch (e) {
    console.error(`[Firestore Seed Error for ${colName}]`, e);
  }
}

// Getters - All reading from real-time Firebase cache
export function getUsers(): User[] {
  return cache.users;
}

export function getRememberedEmail(): string {
  try {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SESSION_KEYS.REMEMBERED_EMAIL) || '';
  } catch (err) {
    return '';
  }
}

export function clearRememberedEmail(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEYS.REMEMBERED_EMAIL);
      localStorage.removeItem('andradeagro_remembered_user_v1');
      localStorage.removeItem('andradeagro_remembered_user');
      notifyDataUpdated(false);
    }
  } catch (err) {
    console.error('Error clearing remembered email:', err);
  }
}

export function getCurrentUser(): User | null {
  try {
    if (typeof window === 'undefined') return null;

    // 1. Check active session in sessionStorage
    const sessionStr = sessionStorage.getItem(SESSION_KEYS.SESSION_USER);
    if (sessionStr) {
      const parsedUser: User = JSON.parse(sessionStr);
      if (parsedUser && parsedUser.id) {
        // Validate against fresh active cache
        const live = cache.users.find(u => u.id === parsedUser.id || u.email?.toLowerCase() === parsedUser.email?.toLowerCase());
        if (live) {
          if (live.active === false) {
            logoutUser();
            return null;
          }
          return live;
        }
        return parsedUser;
      }
    }

    // 2. Check persistent device session on this specific device/browser (iOS Safari PWA & Android)
    const persistentStr = localStorage.getItem(SESSION_KEYS.PERSISTENT_SESSION) || localStorage.getItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION);
    if (persistentStr) {
      try {
        const sessionData = JSON.parse(persistentStr);
        if (sessionData && sessionData.userId) {
          const users = getUsers();
          const live = users.find(u => 
            u.id === sessionData.userId || 
            (sessionData.email && u.email?.toLowerCase() === sessionData.email.toLowerCase())
          );

          if (live) {
            if (live.active === false) {
              logoutUser();
              return null;
            }
            const safe = sanitizeUserForClient(live);
            sessionStorage.setItem(SESSION_KEYS.SESSION_USER, JSON.stringify(safe));
            return live;
          } else {
            // Fallback during initial boot/offline before Firestore users arrive
            const fallbackUser: User = {
              id: sessionData.userId,
              name: sessionData.name || (sessionData.role === 'ADMIN' ? 'Administrador' : 'Usuário AndradeAgro'),
              email: sessionData.email || '',
              role: sessionData.role || 'FUNCIONARIO',
              department: sessionData.department || (sessionData.role === 'ADMIN' ? 'Diretoria' : 'Operação'),
              active: true
            };
            sessionStorage.setItem(SESSION_KEYS.SESSION_USER, JSON.stringify(fallbackUser));
            return fallbackUser;
          }
        } else {
          localStorage.removeItem(SESSION_KEYS.PERSISTENT_SESSION);
          localStorage.removeItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION);
        }
      } catch {
        localStorage.removeItem(SESSION_KEYS.PERSISTENT_SESSION);
        localStorage.removeItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION);
      }
    }

    return null;
  } catch (err) {
    console.error('Error reading current user session:', err);
    return null;
  }
}

export function loginUser(email: string, password: string, rememberMe: boolean): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const targetEmail = email.trim().toLowerCase();
  
  const user = users.find(u => u.email.toLowerCase() === targetEmail);

  if (!user) {
    return { success: false, error: 'E-mail não cadastrado no sistema AndradeAgro.' };
  }

  if (user.active === false) {
    return { success: false, error: 'Este usuário está inativo no sistema. Fale com a equipe de manutenção/administração.' };
  }

  const isValidPassword = verifyPassword(password, user.password);

  if (!isValidPassword) {
    return { success: false, error: 'Senha incorreta. Verifique suas credenciais.' };
  }

  // If password was in legacy unhashed format, upgrade it transparently to salted SHA-256
  if (user.password && !user.password.startsWith('$sha256$')) {
    const upgradedHash = hashPassword(password);
    user.password = upgradedHash;
    updateDoc(doc(db, 'users', user.id), { password: upgradedHash }).catch(console.error);
  }

  const safeUser = sanitizeUserForClient(user);

  // Update active session with sanitized user
  setCurrentUserSession(safeUser);

  // Handle persistence on this specific device
  if (typeof window !== 'undefined') {
    if (rememberMe) {
      localStorage.setItem(SESSION_KEYS.REMEMBERED_EMAIL, targetEmail);

      const persistentSession = {
        userId: user.id,
        email: user.email.toLowerCase(),
        role: user.role,
        name: user.name,
        department: user.department,
        createdAt: Date.now()
      };
      localStorage.setItem(SESSION_KEYS.PERSISTENT_SESSION, JSON.stringify(persistentSession));

      if (user.role === 'ADMIN') {
        localStorage.setItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION, JSON.stringify(persistentSession));
      } else {
        localStorage.removeItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION);
      }
    } else {
      localStorage.removeItem(SESSION_KEYS.REMEMBERED_EMAIL);
      localStorage.removeItem(SESSION_KEYS.PERSISTENT_SESSION);
      localStorage.removeItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION);
    }
  }

  // Trigger Firebase Auth in background
  ensureFirebaseAuth().catch(() => {});

  // Register audit
  logAuditEvent('LOGIN', 'Autenticação', `Usuário ${user.name} (${user.role}) realizou login no sistema.`);

  return { success: true, user: safeUser };
}

export function loginUserById(userId: string, rememberMe: boolean): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    return { success: false, error: 'Usuário não encontrado no sistema.' };
  }

  // STRICT SECURITY CHECK: Administrators cannot login via 1-click quick access
  if (user.role === 'ADMIN') {
    return { success: false, error: 'Administradores devem autenticar informando e-mail e senha.' };
  }

  if (user.active === false) {
    return { success: false, error: 'Este usuário está inativo no sistema.' };
  }

  const safeUser = sanitizeUserForClient(user);

  setCurrentUserSession(safeUser);

  if (typeof window !== 'undefined') {
    // Quick access login never persists administrator session
    localStorage.removeItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION);
    if (rememberMe) {
      if (user.email) {
        localStorage.setItem(SESSION_KEYS.REMEMBERED_EMAIL, user.email.toLowerCase());
      }
      const persistentSession = {
        userId: user.id,
        email: user.email ? user.email.toLowerCase() : '',
        role: user.role,
        name: user.name,
        department: user.department,
        createdAt: Date.now()
      };
      localStorage.setItem(SESSION_KEYS.PERSISTENT_SESSION, JSON.stringify(persistentSession));
    }
  }

  // Trigger Firebase Auth in background
  ensureFirebaseAuth().catch(() => {});

  logAuditEvent('LOGIN', 'Autenticação', `Usuário ${user.name} (${user.role}) acessou o sistema.`);
  return { success: true, user: safeUser };
}

export function logoutUser(): void {
  try {
    const user = getCurrentUser();
    if (user) {
      logAuditEvent('LOGOUT', 'Autenticação', `Usuário ${user.name} saiu do sistema.`);
      cleanupPushOnLogout(user).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEYS.SESSION_USER);
      localStorage.removeItem(SESSION_KEYS.PERSISTENT_SESSION);
      localStorage.removeItem(SESSION_KEYS.PERSISTENT_ADMIN_SESSION);
      localStorage.removeItem('andradeagro_remembered_user_v1');
      localStorage.removeItem('andradeagro_remembered_user');
    }
    notifyDataUpdated(false);
  } catch (err) {
    console.error('Error logging out user:', err);
  }
}

export function setCurrentUserSession(user: User): void {
  try {
    if (typeof window !== 'undefined') {
      const safe = sanitizeUserForClient(user);
      sessionStorage.setItem(SESSION_KEYS.SESSION_USER, JSON.stringify(safe));
    }
  } catch (err) {
    console.error('Error setting current user session:', err);
  }
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    setCurrentUserSession(user);
    notifyDataUpdated(false);
  } else {
    logoutUser();
  }
}

export function getVehicles(): Vehicle[] {
  return cache.vehicles;
}

export function getCentralTanks(): CentralTank[] {
  return cache.centralTanks || [];
}

export function getCentralTank(id: string): CentralTank | undefined {
  const tanks = getCentralTanks();
  return tanks.find(t => t.id === id);
}

export function getTankMovements(tankId?: string): TankMovement[] {
  const all = cache.tankMovements || [];
  if (!tankId) return all;
  return all.filter(m => m.tankId === tankId);
}

export function getGasStations(): GasStation[] {
  return cache.gasStations || [];
}

export function getGasStation(id: string): GasStation | undefined {
  const stations = getGasStations();
  return stations.find(s => s.id === id);
}

/**
 * Checks if a gas station is EXTERNAL based on its entity type or recognized external supplier.
 * External stations (such as 'Bom Jesus de Quadra', Shell, Ipiranga, etc.) never deduct fuel from internal farm tanks.
 */
export function isGasStationExternal(gasStationId?: string, gasStationName?: string): boolean {
  if (gasStationId) {
    const station = getGasStation(gasStationId);
    if (station) {
      return station.type === 'EXTERNO';
    }
    if (gasStationId === 'stn-bom-jesus' || gasStationId === 'stn-002' || gasStationId === 'stn-003') {
      return true;
    }
  }

  if (gasStationName) {
    const cleanName = gasStationName.trim().toLowerCase();
    const stations = getGasStations();
    const station = stations.find(s => s.name.trim().toLowerCase() === cleanName);
    if (station) {
      return station.type === 'EXTERNO';
    }

    if (cleanName.includes('bom jesus')) {
      return true;
    }
    if (cleanName.includes('shell') || cleanName.includes('ipiranga') || cleanName.includes('externo') || cleanName.includes('posto de rua') || cleanName.includes('br-163')) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the internal Central Tank if and only if the gas station is internal ('INTERNO').
 * Returns null for any external station (like Bom Jesus de Quadra).
 */
export function getInternalTankForStation(gasStationId?: string, gasStationName?: string): CentralTank | null {
  if (isGasStationExternal(gasStationId, gasStationName)) {
    return null;
  }

  const tanks = getCentralTanks();

  // If directly referencing a central tank ID
  if (gasStationId === 'tank-quadra' || gasStationId === 'tank-itapeva') {
    return tanks.find(t => t.id === gasStationId) || null;
  }

  if (gasStationId) {
    const station = getGasStation(gasStationId);
    if (station) {
      if (station.type === 'EXTERNO') return null;
      if (station.tankId) {
        return tanks.find(t => t.id === station.tankId) || null;
      }
      if (station.id === 'stn-itapeva' || station.name.toLowerCase().includes('itapeva')) {
        return tanks.find(t => t.id === 'tank-itapeva') || null;
      }
      return tanks.find(t => t.id === 'tank-quadra') || tanks[0] || null;
    }
  }

  if (gasStationName) {
    const cleanName = gasStationName.trim().toLowerCase();
    if (cleanName.includes('bom jesus') || cleanName.includes('shell') || cleanName.includes('ipiranga')) {
      return null;
    }
    if (cleanName.includes('itapeva')) {
      return tanks.find(t => t.id === 'tank-itapeva') || null;
    }
    if (cleanName.includes('tanque central') || cleanName.includes('sede') || cleanName.includes('interno') || cleanName.includes('fazenda andrade')) {
      return tanks.find(t => t.id === 'tank-quadra') || null;
    }
  }

  return null;
}

export function getFuelLogs(): FuelLog[] {
  return cache.fuelLogs || [];
}

export function getFuelRefills(): FuelRefill[] {
  return cache.fuelRefills || [];
}

// Calculate Individual Tank Status (Tanque Central Quadra, Tanque Central Itapeva ou Genérico)
export function getTankStatus(targetTankId?: string) {
  const allTanks = getCentralTanks();
  
  // Identify which tank to evaluate
  let targetTank: CentralTank | undefined;
  if (targetTankId) {
    targetTank = allTanks.find(t => t.id === targetTankId || (targetTankId.includes('quadra') && t.id === 'tank-quadra') || (targetTankId.includes('itapeva') && t.id === 'tank-itapeva'));
  }
  
  // Fallback to first tank if not found
  if (!targetTank) {
    targetTank = allTanks[0];
  }

  const capacity = targetTank?.capacityLiters || 10000;
  // The official, single-source-of-truth current stock persisted on the tank document
  const currentStock = targetTank?.currentStockLiters !== undefined 
    ? Math.max(0, Number(targetTank.currentStockLiters)) 
    : 7500;
  const minStockAlert = targetTank?.minStockAlertLiters || 2000;

  // Refills dedicated to this specific tank
  const refills = getFuelRefills();
  const totalRefilled = refills.reduce((sum, r) => {
    const isThisTank = (r as any).tankId === targetTank?.id || 
      (targetTank?.id === 'tank-quadra' && (!((r as any).tankId) || (r as any).tankId === 'stn-001' || (r as any).tankId === 'stn-quadra')) ||
      (targetTank?.id === 'tank-itapeva' && (r as any).tankId === 'tank-itapeva');
    
    if (!isThisTank) return sum;
    return sum + (Number(r.liters) || 0);
  }, 0);

  // Dispensed fuel logs dedicated to this specific tank (EXCLUDING external stations like Bom Jesus de Quadra)
  const fuelLogs = getFuelLogs();
  const totalDispensed = fuelLogs.reduce((sum, log) => {
    const internalTank = getInternalTankForStation(log.gasStationId, log.gasStationName);
    const isThisTank = internalTank && internalTank.id === targetTank?.id;

    if (!isThisTank) return sum;
    return sum + (Number(log.liters) || 0);
  }, 0);

  const percentage = capacity > 0 ? Math.min(100, Math.max(0, (currentStock / capacity) * 100)) : 0;
  
  // Alerta quando estoque atual <= estoque mínimo configurado (padrão 2.000 L)
  const isCritical = currentStock <= Math.max(500, minStockAlert * 0.25);
  const isLow = currentStock <= minStockAlert;

  return {
    tankId: targetTank?.id || 'tank-quadra',
    name: targetTank?.name || 'Tanque Central',
    location: targetTank?.location || 'Sede',
    capacity,
    minStockAlert,
    initialStock: currentStock,
    totalRefilled,
    totalDispensed,
    currentStock,
    percentage: Math.round(percentage * 10) / 10,
    isLow,
    isCritical
  };
}

// Quick Access Shortcuts helpers (ADMs e Funcionários na tela de login)
export function getQuickAccessUserIds(): string[] {
  try {
    const settings = getSettings();
    if (settings.quickAccessUserIds && Array.isArray(settings.quickAccessUserIds) && settings.quickAccessUserIds.length > 0) {
      return settings.quickAccessUserIds;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('andradeagro_quick_access_user_ids');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
    // Default: all active users
    return cache.users.filter(u => u.active !== false).map(u => u.id);
  } catch (e) {
    console.error('Error loading quick access user ids:', e);
    return cache.users.filter(u => u.active !== false).map(u => u.id);
  }
}

export async function setQuickAccessUserIds(userIds: string[]): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('andradeagro_quick_access_user_ids', JSON.stringify(userIds));
    }
    await updateSettings({ quickAccessUserIds: userIds });
  } catch (e) {
    console.error('Error saving quick access user ids:', e);
  }
}

export async function toggleQuickAccessUser(userId: string): Promise<void> {
  const currentIds = getQuickAccessUserIds();
  const nextIds = currentIds.includes(userId)
    ? currentIds.filter(id => id !== userId)
    : [...currentIds, userId];
  await setQuickAccessUserIds(nextIds);
}

export function getMaintenanceLogs(): MaintenanceLog[] {
  return cache.maintenanceLogs;
}

export function getAlerts(): SmartAlert[] {
  return cache.alerts;
}

export function getAuditLogs(): AuditLog[] {
  return cache.auditLogs;
}

export function getSettings(): SystemSettings {
  return cache.settings;
}

export function getMachineIssues(): MachineIssue[] {
  return cache.machineIssues;
}

export function getPreventiveItems(equipmentId?: string): PreventiveMaintenanceItem[] {
  const all = cache.preventiveItems;
  if (!equipmentId) return all;
  
  const items = all.filter(item => item.equipmentId === equipmentId);
  if (items.length > 0) return items;

  // Default fallback generator if machine has no preventive items yet
  const defaultKeys: { key: PreventiveItemKey; name: string; interval: number }[] = [
    { key: 'TROCA_OLEO_MOTOR', name: 'Troca de Óleo do Motor', interval: 300 },
    { key: 'FILTRO_OLEO', name: 'Filtro de Óleo Lubrificante', interval: 300 },
    { key: 'FILTRO_COMBUSTIVEL', name: 'Filtro de Combustível / Separador', interval: 500 },
    { key: 'FILTRO_AR', name: 'Filtro de Ar do Motor', interval: 500 },
    { key: 'LUBRIFICACAO', name: 'Lubrificação Geral (Graxa)', interval: 100 },
    { key: 'REVISAO_GERAL', name: 'Revisões Gerais do Equipamento', interval: 1000 },
    { key: 'PNEUS_ESTEIRAS', name: 'Calibragem & Inspeção de Pneus/Esteiras', interval: 100 }
  ];

  const vehicles = getVehicles();
  const target = vehicles.find(v => v.id === equipmentId);
  const curHour = target?.currentHourmeter || 1000;

  const generated: PreventiveMaintenanceItem[] = defaultKeys.map((def, idx) => ({
    id: `prev-${equipmentId}-${idx + 1}`,
    equipmentId,
    itemKey: def.key,
    itemName: def.name,
    lastServiceDate: new Date().toISOString().slice(0, 10),
    lastServiceHourmeter: Math.max(0, curHour - (def.interval / 2)),
    nextScheduledHourmeter: curHour + (def.interval / 2),
    intervalHours: def.interval
  }));

  // Save generated directly to Firestore
  generated.forEach(item => {
    setDoc(doc(db, 'preventive_items', item.id), cleanUndefined(item)).catch(console.error);
  });

  return generated;
}

// Audit Helper
export function logAuditEvent(action: AuditLog['action'], entity: string, details: string) {
  const user = getCurrentUser();
  const newLog: AuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    dateTime: new Date().toISOString(),
    userId: user?.id || 'sys',
    userName: user?.name || 'Sistema',
    action,
    entity,
    details
  };
  setDoc(doc(db, 'audit_logs', newLog.id), cleanUndefined(newLog)).catch(console.error);
}

/**
 * Política de Retenção de 90 Dias para Logs de Login, Segurança e Auditoria.
 * Exclui exclusivamente registros da coleção 'audit_logs' com mais de 90 dias.
 * NUNCA afeta manutenções, abastecimentos, veículos ou qualquer dado operacional.
 * É estritamente idempotente.
 */
export async function cleanupAuditLogsOlderThan90Days(triggeredBy: string = 'automática'): Promise<{
  deletedCount: number;
  cutoffDateISO: string;
}> {
  const RETENTION_DAYS = 90;
  const cutoffTime = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDateISO = new Date(cutoffTime).toISOString();

  try {
    const eligibleLogs = cache.auditLogs.filter(log => {
      if (!log.dateTime) return false;
      const logTime = new Date(log.dateTime).getTime();
      return !isNaN(logTime) && logTime < cutoffTime;
    });

    if (eligibleLogs.length === 0) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('andradeagro_last_audit_cleanup', String(Date.now()));
      }
      return { deletedCount: 0, cutoffDateISO };
    }

    const deletedIds = new Set<string>();

    for (const log of eligibleLogs) {
      try {
        await deleteDoc(doc(db, 'audit_logs', log.id));
        deletedIds.add(log.id);
      } catch (err) {
        console.warn(`[Audit Cleanup] Falha ao excluir log ${log.id}:`, err);
      }
    }

    const count = deletedIds.size;
    if (count > 0) {
      cache.auditLogs = cache.auditLogs.filter(l => !deletedIds.has(l.id));
      notifyDataUpdated(false);

      const caller = getCurrentUser();
      const callerName = caller?.name || triggeredBy;
      logAuditEvent(
        'CONFIGURACAO',
        'Auditoria',
        `Política de retenção de 90 dias executada (${triggeredBy} por ${callerName}): ${count} registro(s) anterior(es) a ${new Date(cutoffTime).toLocaleDateString('pt-BR')} foram removidos.`
      );
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('andradeagro_last_audit_cleanup', String(Date.now()));
    }

    return { deletedCount: count, cutoffDateISO };
  } catch (error) {
    console.error('[Audit Cleanup Error]', error);
    return { deletedCount: 0, cutoffDateISO };
  }
}

/**
 * Verificação periódica defensiva de limpeza de logs.
 * Executa no máximo uma vez a cada 24 horas no cliente.
 */
export function maybeTriggerAuditLogAutoCleanup() {
  if (typeof window === 'undefined') return;
  try {
    const lastRunStr = localStorage.getItem('andradeagro_last_audit_cleanup');
    const lastRun = lastRunStr ? Number(lastRunStr) : 0;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - lastRun > ONE_DAY_MS) {
      setTimeout(() => {
        cleanupAuditLogsOlderThan90Days('rotina automática diária').catch(() => {});
      }, 5000);
    }
  } catch (err) {
    console.warn('[Audit Auto-Cleanup Check]', err);
  }
}

// Mutators - All updating Firebase Firestore directly
export async function addFuelLog(log: Omit<FuelLog, 'id' | 'createdAt'>): Promise<FuelLog> {
  let safeDateTime = log.dateTime;
  if (!safeDateTime) {
    safeDateTime = getNowSaoPauloISO();
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(safeDateTime.trim())) {
    safeDateTime = `${safeDateTime.trim()}-03:00`;
  }

  const newLog: FuelLog = {
    ...log,
    dateTime: safeDateTime,
    id: `log-${Date.now()}`,
    createdAt: getNowSaoPauloISO()
  };

  const cleanedLog = cleanUndefined(newLog);

  // Validar consistência do horímetro ANTES de gravar no Firestore ou alterar o cache
  const vehicles = getVehicles();
  const targetVehicle = vehicles.find(v => v.id === log.equipmentId);
  const isKm = targetVehicle?.category === 'VEICULO';

  if (targetVehicle && !isKm && typeof log.hourmeterAtFueling === 'number') {
    const currentUser = getCurrentUser();
    const userRole = currentUser?.role || 'FUNCIONARIO';
    const validation = validateHourmeterReading({
      newHourmeter: log.hourmeterAtFueling,
      equipment: targetVehicle,
      previousLogs: cache.fuelLogs,
      currentDate: log.dateTime,
      userRole,
      isAuthorizedCorrection: Boolean(log.isAuthorizedCorrection),
      justification: log.correctionReason
    });

    if (validation.isBlocking) {
      throw new Error(validation.message || 'Horímetro inconsistente para este equipamento.');
    }
  }

  // Optimistically update local memory cache
  cache.fuelLogs = [cleanedLog, ...cache.fuelLogs.filter(l => l.id !== cleanedLog.id)];
  notifyDataUpdated();

  try {
    // Write fuel log to Firestore
    await setDoc(doc(db, 'fuel_logs', cleanedLog.id), cleanedLog);

    // If fueling came from an internal central tank, deduct stock and register a Tank Movement (Saída / Abastecimento)
    const internalTank = getInternalTankForStation(log.gasStationId, log.gasStationName);
    
    if (internalTank) {
      const activeTankId = internalTank.id;
      const prevStock = Number(internalTank.currentStockLiters ?? 7500);
      const afterStock = Math.max(0, prevStock - log.liters);

      // Persist the updated stock directly on the tank document in Firestore and memory
      internalTank.currentStockLiters = afterStock;
      cache.centralTanks = cache.centralTanks.map(t => t.id === activeTankId ? { ...t, currentStockLiters: afterStock } : t);
      await updateDoc(doc(db, 'central_tanks', activeTankId), {
        currentStockLiters: afterStock
      });

      await addTankMovement({
        tankId: activeTankId,
        dateTime: safeDateTime || getNowSaoPauloISO(),
        type: 'SAIDA_ABASTECIMENTO',
        liters: log.liters,
        previousStock: prevStock,
        afterStock: afterStock,
        userId: log.attendantId || log.driverOrOperatorId || 'sys',
        userName: log.attendantName || log.driverOrOperatorName || 'Operador',
        equipmentId: log.equipmentId,
        equipmentName: log.equipmentName,
        fuelLogId: cleanedLog.id,
        notes: `Abastecimento de ${log.liters}L em ${log.equipmentName} (${log.equipmentPlateOrCode}).`
      });
    }

    // Update Equipment current KM / Hourmeter in Firestore
    if (targetVehicle) {
      const updatedKm = isKm ? Math.max(targetVehicle.currentKm || 0, log.kmAtFueling || targetVehicle.currentKm || 0) : targetVehicle.currentKm;
      
      let updatedHour = targetVehicle.currentHourmeter;
      if (!isKm && typeof log.hourmeterAtFueling === 'number') {
        if (log.isAuthorizedCorrection) {
          // Correção autorizada da manutenção: atualiza para o valor corrigido real
          updatedHour = log.hourmeterAtFueling;
          logAuditEvent(
            'EDITAR',
            'HORIMETRO_EQUIPAMENTO',
            `Correção técnica autorizada de horímetro em ${targetVehicle.model} (${targetVehicle.licensePlate || targetVehicle.patrimonyCode}): de ${targetVehicle.currentHourmeter || 0}h para ${log.hourmeterAtFueling}h. Justificativa: ${log.correctionReason || 'Sem justificativa informada'}.`
          );
        } else {
          updatedHour = Math.max(targetVehicle.currentHourmeter || 0, log.hourmeterAtFueling);
        }
      }
      
      const vehicleUpdates = cleanUndefined({
        currentKm: updatedKm,
        currentHourmeter: updatedHour,
        lastFuelingDate: log.dateTime.slice(0, 10)
      });

      // Update in local memory cache
      const updatedVehicleObj = { ...targetVehicle, ...vehicleUpdates };
      cache.vehicles = cache.vehicles.map(v => v.id === targetVehicle.id ? updatedVehicleObj : v);

      await updateDoc(doc(db, 'vehicles', targetVehicle.id), vehicleUpdates);
    }

    // If flagged suspicious, create automated Alert in Firestore
    if (log.flaggedSuspicious) {
      const alertId = `alt-susp-${Date.now()}`;
      const alertTitle = 'Consumo Anômalo no Abastecimento';
      const alertDesc = `${log.equipmentName} (${log.equipmentPlateOrCode}): ${log.suspiciousReason || 'Consumo fora do padrão registrado.'}`;
      const newAlert: SmartAlert = cleanUndefined({
        id: alertId,
        type: 'SUSPICIOUS_FUEL',
        severity: 'ALTA',
        title: alertTitle,
        description: alertDesc,
        equipmentId: log.equipmentId,
        equipmentName: log.equipmentName,
        fuelLogId: newLog.id,
        date: log.dateTime.slice(0, 10),
        resolved: false,
        pushNotified: true,
        pushNotifiedAt: new Date().toISOString()
      });
      cache.alerts = [newAlert, ...cache.alerts];
      await setDoc(doc(db, 'alerts', newAlert.id), newAlert);

      // Conectar alerta interno de consumo anômalo ao mecanismo Web Push
      dispatchPushNotificationEvent({
        eventType: 'SUSPICIOUS_FUEL',
        eventId: newAlert.id,
        equipmentName: log.equipmentName,
        equipmentId: log.equipmentId,
        customTitle: `⚠️ ${alertTitle}`,
        description: alertDesc
      }).catch(() => {});
    }

    logAuditEvent('CRIAR', 'Abastecimento', `Registrou ${newLog.liters}L em ${newLog.equipmentName} (${newLog.equipmentPlateOrCode}) via ${newLog.gasStationName}.`);
    notifyDataUpdated();
    checkAutomatedAlerts(true);
    return cleanedLog;
  } catch (err) {
    console.error('[addFuelLog Firestore Error]', err);
    throw err;
  }
}

export async function updateFuelLog(id: string, updatedFields: Partial<FuelLog>): Promise<void> {
  const caller = getCurrentUser();
  if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'MANUTENCAO')) {
    throw new Error('Acesso negado: Somente os perfis Administrador e Manutenção possuem permissão para editar registros de abastecimento.');
  }

  const current = cache.fuelLogs.find(l => l.id === id);
  if (!current) {
    throw new Error('Registro de abastecimento não encontrado.');
  }

  // Recalculate dependent values strictly for this edited record
  const finalLiters = updatedFields.liters !== undefined ? Number(updatedFields.liters) : current.liters;
  const finalPrice = updatedFields.pricePerLiter !== undefined ? Number(updatedFields.pricePerLiter) : current.pricePerLiter;
  const recalculatedTotalValue = Number((finalLiters * finalPrice).toFixed(2));

  let recalculatedCostPerKm = current.costPerKm;
  let recalculatedCostPerHour = current.costPerHour;

  if (current.equipmentCategory === 'VEICULO') {
    if (current.kmAtFueling !== undefined && current.previousKmOrHour !== undefined && current.kmAtFueling > current.previousKmOrHour) {
      const diff = current.kmAtFueling - current.previousKmOrHour;
      if (diff > 0) {
        recalculatedCostPerKm = Number((recalculatedTotalValue / diff).toFixed(3));
      }
    }
  } else {
    if (current.hourmeterAtFueling !== undefined && current.previousKmOrHour !== undefined && current.hourmeterAtFueling > current.previousKmOrHour) {
      const diff = current.hourmeterAtFueling - current.previousKmOrHour;
      if (diff > 0) {
        recalculatedCostPerHour = Number((recalculatedTotalValue / diff).toFixed(2));
      }
    }
  }

  const cleaned = cleanUndefined({
    ...updatedFields,
    liters: finalLiters,
    pricePerLiter: finalPrice,
    totalValue: recalculatedTotalValue,
    costPerKm: recalculatedCostPerKm,
    costPerHour: recalculatedCostPerHour,
    updatedAt: new Date().toISOString()
  });

  cache.fuelLogs = cache.fuelLogs.map(l => l.id === id ? { ...l, ...cleaned } : l);
  notifyDataUpdated();

  await updateDoc(doc(db, 'fuel_logs', id), cleaned);
  logAuditEvent('EDITAR', 'Abastecimento', `${caller.name} (${caller.role}) atualizou o abastecimento ID ${id} (${current.equipmentName}). Preço: R$ ${finalPrice.toFixed(3)}, Total: R$ ${recalculatedTotalValue.toFixed(2)}.`);
}

export async function deleteFuelLog(id: string): Promise<void> {
  cache.fuelLogs = cache.fuelLogs.filter(l => l.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'fuel_logs', id));
  logAuditEvent('EXCLUIR', 'Abastecimento', `Removeu o abastecimento ID ${id}.`);
}

// Central Tanks Mutators
export async function updateCentralTank(id: string, fields: Partial<CentralTank>, reason?: string): Promise<void> {
  const current = getCentralTank(id);
  const currentStatus = getTankStatus(id);
  const user = getCurrentUser();

  const prevStock = currentStatus ? currentStatus.currentStock : (current?.currentStockLiters || 0);
  const newStock = fields.currentStockLiters !== undefined ? Number(fields.currentStockLiters) : prevStock;
  const stockChanged = fields.currentStockLiters !== undefined && Math.abs(newStock - prevStock) > 0.01;

  const cleaned = cleanUndefined({
    ...fields,
    currentStockLiters: newStock,
    stockBaseUpdatedAt: stockChanged ? new Date().toISOString() : (current?.stockBaseUpdatedAt || new Date().toISOString())
  });

  const updatedObj = current ? { ...current, ...cleaned } : { id, ...cleaned } as CentralTank;
  cache.centralTanks = cache.centralTanks.map(t => t.id === id ? updatedObj : t);
  if (!cache.centralTanks.some(t => t.id === id)) {
    cache.centralTanks.push(updatedObj);
  }
  notifyDataUpdated();

  await setDoc(doc(db, 'central_tanks', id), cleaned, { merge: true });

  // If currentStockLiters was manually adjusted, register an audit movement with full details
  if (stockChanged) {
    const diff = newStock - prevStock;
    const diffText = diff > 0 ? `+${diff.toLocaleString('pt-BR')} L` : `${diff.toLocaleString('pt-BR')} L`;
    const adjReason = reason?.trim() || 'Ajuste manual de calibração do estoque físico';

    await addTankMovement({
      tankId: id,
      dateTime: new Date().toISOString(),
      type: 'AJUSTE_MANUAL',
      liters: newStock,
      previousStock: prevStock,
      afterStock: newStock,
      difference: diff,
      userId: user?.id || 'sys',
      userName: user?.name || 'Administrador',
      reason: adjReason,
      notes: `Ajuste manual em ${updatedObj.name}: anterior ${prevStock.toLocaleString('pt-BR')}L → novo ${newStock.toLocaleString('pt-BR')}L (${diffText}). Motivo: ${adjReason}.`
    });

    logAuditEvent(
      'CONFIGURACAO', 
      'Ajuste de Estoque de Tanque', 
      `Ajustou estoque do ${updatedObj.name}: ${prevStock.toLocaleString('pt-BR')}L → ${newStock.toLocaleString('pt-BR')}L (${diffText}). Motivo: ${adjReason}.`
    );
  } else {
    logAuditEvent('EDITAR', 'Tanque Central', `Atualizou dados e configurações de ${updatedObj.name} (${updatedObj.location}).`);
  }

  // 3B. Se o estoque foi alterado, limpa deduplicação anterior para permitir push imediato se atingir limite
  if (stockChanged) {
    clearPushEventDeduplication(`tank-alert-${id}`).catch(() => {});
  }

  checkAutomatedAlerts();
}

export async function addTankMovement(movement: Omit<TankMovement, 'id'>): Promise<TankMovement> {
  const newMov: TankMovement = {
    ...movement,
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };
  const cleaned = cleanUndefined(newMov);
  cache.tankMovements = [cleaned, ...(cache.tankMovements || [])];
  notifyDataUpdated(false);

  await setDoc(doc(db, 'tank_movements', cleaned.id), cleaned);
  return cleaned;
}

// Vehicle / Machine Mutators
export async function addVehicle(v: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const newVehicle: Vehicle = {
    ...v,
    id: `veh-${Date.now()}`
  };
  const cleaned = cleanUndefined(newVehicle);
  cache.vehicles = [...cache.vehicles, cleaned];
  notifyDataUpdated();

  await setDoc(doc(db, 'vehicles', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Equipamento', `Cadastrou ${cleaned.model} (${cleaned.licensePlate || cleaned.patrimonyCode}).`);
  return cleaned;
}

export async function updateVehicle(id: string, updatedFields: Partial<Vehicle>): Promise<void> {
  const cleaned = cleanUndefined(updatedFields);
  cache.vehicles = cache.vehicles.map(v => v.id === id ? { ...v, ...cleaned } : v);
  notifyDataUpdated();

  try {
    await setDoc(doc(db, 'vehicles', id), cleaned, { merge: true });
    logAuditEvent('EDITAR', 'Equipamento', `Atualizou equipamento ID ${id}.`);
    checkAutomatedAlerts(true);
  } catch (err) {
    console.error(`[Firestore Error updating vehicle ${id}]`, err);
    throw err;
  }
}

export async function deleteVehicle(id: string): Promise<void> {
  cache.vehicles = cache.vehicles.filter(v => v.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'vehicles', id));
  logAuditEvent('EXCLUIR', 'Equipamento', `Excluiu equipamento ID ${id}.`);
}

// Maintenance Mutators
export async function addMaintenance(m: Omit<MaintenanceLog, 'id'>): Promise<MaintenanceLog> {
  const safeDate = m.date || getTodayDateSaoPaulo();
  const safeDateTime = m.dateTime || createTimestampForDateSaoPaulo(safeDate);
  const newMnt: MaintenanceLog = {
    ...m,
    date: safeDate,
    dateTime: safeDateTime,
    createdAt: (m as any).createdAt || getNowSaoPauloISO(),
    id: `mnt-${Date.now()}`
  };
  const cleaned = cleanUndefined(newMnt);
  cache.maintenanceLogs = [cleaned, ...cache.maintenanceLogs];
  notifyDataUpdated();

  await setDoc(doc(db, 'maintenance_logs', cleaned.id), cleaned);

  // When a maintenance is registered, also update the vehicle's last maintenance reference and next target
  const vehicles = getVehicles();
  const targetVehicle = vehicles.find(v => v.id === m.equipmentId);
  if (targetVehicle) {
    const isKm = targetVehicle.category === 'VEICULO' || targetVehicle.maintenanceControlType === 'QUILOMETRAGEM';
    // STRICT RULE: Only a maintenance specifically of type TROCA_OLEO triggers oil change synchronization and alert reset
    const isOilChange = m.type === 'TROCA_OLEO';
    const serviceMeter = Number(m.kmOrHourAtService) || 0;
    const interval = isKm 
      ? (Number(targetVehicle.oilChangeIntervalKm) || Number(targetVehicle.maintenanceIntervalKm) || 10000)
      : (Number(targetVehicle.oilChangeIntervalHours) || Number(targetVehicle.maintenanceIntervalHours) || 300);

    const nextTarget = m.nextServiceKmOrHour && Number(m.nextServiceKmOrHour) > serviceMeter
      ? Number(m.nextServiceKmOrHour)
      : serviceMeter + interval;

    const updates: Partial<Vehicle> = {
      lastMaintenanceDate: m.date
    };

    if (isKm) {
      if (serviceMeter > (Number(targetVehicle.currentKm) || 0)) {
        updates.currentKm = serviceMeter;
      }
      updates.lastMaintenanceKm = serviceMeter;
      updates.nextMaintenanceKm = nextTarget;

      if (isOilChange) {
        updates.lastOilChangeKm = serviceMeter;
        updates.lastOilChangeDate = m.date;
        updates.nextOilChangeKm = nextTarget;
      }
    } else {
      if (serviceMeter > (Number(targetVehicle.currentHourmeter) || 0)) {
        updates.currentHourmeter = serviceMeter;
      }
      updates.lastMaintenanceHourmeter = serviceMeter;
      updates.nextMaintenanceHourmeter = nextTarget;

      if (isOilChange) {
        updates.lastOilChangeHourmeter = serviceMeter;
        updates.lastOilChangeDate = m.date;
        updates.nextOilChangeHourmeter = nextTarget;
      }
    }

    if (targetVehicle.status === 'EM_MANUTENCAO') {
      updates.status = 'ATIVO';
    }

    await updateVehicle(targetVehicle.id, updates);

    // SOMENTE se for TROCA DE ÓLEO: resolver alertas de troca de óleo
    if (isOilChange) {
      const alertsToResolve = cache.alerts.filter(
        a => a.equipmentId === targetVehicle.id && 
        (
          a.type === 'OIL_CHANGE_DUE' || 
          a.id === `alt-oil-${targetVehicle.id}` || 
          a.id === `alt-km-${targetVehicle.id}` ||
          (a.title && (a.title.toLowerCase().includes('óleo') || a.title.toLowerCase().includes('oleo')))
        ) &&
        !a.resolved
      );

      for (const alert of alertsToResolve) {
        alert.resolved = true;
        alert.resolvedAt = new Date().toISOString();
        alert.resolvedBy = m.performedBy || 'Troca de Óleo Registrada';
        try {
          await updateDoc(doc(db, 'alerts', alert.id), {
            resolved: true,
            resolvedAt: alert.resolvedAt,
            resolvedBy: alert.resolvedBy
          });
        } catch (e) {
          console.warn('[addMaintenance] Could not update alert in Firestore:', e);
        }
      }
      clearPushEventDeduplication('oil-alert-' + targetVehicle.id).catch(() => {});

      // Auto-resolve any pending reported issues related strictly to oil change on this vehicle
      const oilIssuesToResolve = (cache.machineIssues || []).filter(
        iss => iss.equipmentId === targetVehicle.id &&
        iss.status === 'ABERTO' &&
        (
          iss.description.toLowerCase().includes('troca de óleo') ||
          iss.description.toLowerCase().includes('troca de oleo') ||
          iss.description.toLowerCase().includes('óleo do motor') ||
          iss.description.toLowerCase().includes('oleo do motor') ||
          iss.description.toLowerCase().includes('óleo vencid') ||
          iss.description.toLowerCase().includes('oleo vencid') ||
          iss.description.toLowerCase().includes('revisão de óleo') ||
          iss.description.toLowerCase().includes('revisao de oleo') ||
          iss.description.toLowerCase().includes('troca de lubrificante')
        )
      );
      for (const iss of oilIssuesToResolve) {
        iss.status = 'RESOLVIDO';
        try {
          await updateDoc(doc(db, 'machine_issues', iss.id), { status: 'RESOLVIDO' });
        } catch (e) {
          console.warn('[addMaintenance] Could not update machine issue in Firestore:', e);
        }
      }

      const prevItems = (cache.preventiveItems || []).filter(
        p => p.equipmentId === targetVehicle.id && (p.itemKey === 'TROCA_OLEO_MOTOR' || p.itemKey === 'FILTRO_OLEO')
      );
      for (const pItem of prevItems) {
        pItem.lastServiceDate = m.date;
        pItem.lastServiceHourmeter = serviceMeter;
        pItem.nextScheduledHourmeter = serviceMeter + (pItem.intervalHours || 250);
        try {
          await setDoc(doc(db, 'preventive_items', pItem.id), pItem, { merge: true });
        } catch (e) {
          console.warn('[addMaintenance] Could not update preventive item:', e);
        }
      }
    }
  }

  logAuditEvent('CRIAR', 'Manutenção', `Agendou/Registrou manutenção "${m.title}" em ${m.equipmentName}.`);
  checkAutomatedAlerts();

  // 3A. Notificação Push para nova manutenção registrada com sucesso no Firestore
  // Título: "Nova manutenção registrada"
  // Corpo: "{Equipamento} • {Tipo/Descrição da manutenção}" (ex: "Trator John Deere 6155J • Troca de óleo")
  // Deduplicação: maintenance-{maintenanceId}
  const equipName = (
    targetVehicle?.model ||
    m.equipmentName ||
    m.equipmentPlateOrCode ||
    'Equipamento'
  ).trim();

  let serviceDetail = '';
  if (m.type === 'TROCA_OLEO') {
    serviceDetail = 'Troca de óleo';
  } else if (m.type === 'SERVICO_CORRETIVO') {
    serviceDetail = 'Manutenção corretiva';
  } else if (m.type === 'REVISAO') {
    serviceDetail = 'Revisão preventiva';
  } else if (m.type === 'TROCA_FILTROS') {
    serviceDetail = 'Troca de filtros';
  } else if (m.type === 'PNEUS') {
    serviceDetail = 'Pneus / Esteiras';
  } else if (m.type === 'PECAS') {
    serviceDetail = 'Substituição de peças';
  } else if (m.title && m.title.trim().length > 0) {
    serviceDetail = m.title.trim();
  } else if (m.description && m.description.trim().length > 0) {
    serviceDetail = m.description.trim();
  } else {
    serviceDetail = 'Manutenção';
  }

  const pushBody = `${equipName} • ${serviceDetail}`;
  const pushEventId = `maintenance-${cleaned.id}`;

  dispatchPushNotificationEvent({
    eventType: 'NEW_MAINTENANCE',
    eventId: pushEventId,
    equipmentName: equipName,
    equipmentId: cleaned.equipmentId,
    customTitle: 'Nova manutenção registrada',
    description: pushBody
  }).catch((pushErr) => {
    // Falha do Push não compromete o registro nem desfaz a gravação já confirmada no Firestore
    console.warn('[Push Notification] Aviso ao enviar push de manutenção:', pushErr?.message || pushErr);
  });

  return cleaned;
}

export async function updateMaintenance(id: string, fields: Partial<MaintenanceLog>): Promise<void> {
  const caller = getCurrentUser();
  if (!caller || caller.role !== 'MANUTENCAO') {
    throw new Error('Acesso negado: Somente usuários com perfil de MANUTENÇÃO possuem autorização para alterar registros de manutenção.');
  }

  const existingMnt = cache.maintenanceLogs.find(m => m.id === id);
  if (!existingMnt) {
    throw new Error('Registro de manutenção não encontrado.');
  }

  const toUpdate: Partial<MaintenanceLog> = { ...fields };
  if (toUpdate.date && !toUpdate.dateTime) {
    toUpdate.dateTime = createTimestampForDateSaoPaulo(toUpdate.date);
  }
  const cleaned = cleanUndefined(toUpdate);
  cache.maintenanceLogs = cache.maintenanceLogs.map(m => m.id === id ? { ...m, ...cleaned } : m);
  notifyDataUpdated();

  await updateDoc(doc(db, 'maintenance_logs', id), cleaned);

  // Se for uma troca de óleo e o horímetro/KM de serviço foi atualizado, sincronizar com o veículo
  const effectiveType = toUpdate.type || existingMnt.type;
  if (effectiveType === 'TROCA_OLEO' && toUpdate.kmOrHourAtService !== undefined) {
    const targetVehicle = getVehicles().find(v => v.id === (toUpdate.equipmentId || existingMnt.equipmentId));
    if (targetVehicle) {
      const isKm = targetVehicle.category === 'VEICULO' || targetVehicle.maintenanceControlType === 'QUILOMETRAGEM';
      const interval = isKm 
        ? (Number(targetVehicle.oilChangeIntervalKm) || Number(targetVehicle.maintenanceIntervalKm) || 10000)
        : (Number(targetVehicle.oilChangeIntervalHours) || Number(targetVehicle.maintenanceIntervalHours) || 300);
      const newMeter = Number(toUpdate.kmOrHourAtService);
      const nextTarget = toUpdate.nextServiceKmOrHour && Number(toUpdate.nextServiceKmOrHour) > newMeter
        ? Number(toUpdate.nextServiceKmOrHour)
        : newMeter + interval;

      const vehicleUpdates: Partial<Vehicle> = {
        lastOilChangeDate: toUpdate.date || existingMnt.date
      };
      if (isKm) {
        vehicleUpdates.lastOilChangeKm = newMeter;
        vehicleUpdates.nextOilChangeKm = nextTarget;
      } else {
        vehicleUpdates.lastOilChangeHourmeter = newMeter;
        vehicleUpdates.nextOilChangeHourmeter = nextTarget;
      }
      await updateVehicle(targetVehicle.id, vehicleUpdates);
    }
  }

  logAuditEvent(
    'EDITAR',
    'Manutenção',
    `Manutenção (${caller.name}) alterou o registro "${cleaned.title || existingMnt.title}" do equipamento ${existingMnt.equipmentName} (${existingMnt.equipmentPlateOrCode}).`
  );
  checkAutomatedAlerts();
}

export async function deleteMaintenance(id: string): Promise<void> {
  const caller = getCurrentUser();
  if (!caller || caller.role !== 'MANUTENCAO') {
    throw new Error('Acesso negado: Somente usuários com perfil de MANUTENÇÃO possuem autorização para excluir registros de manutenção.');
  }

  const targetMnt = cache.maintenanceLogs.find(m => m.id === id);
  if (!targetMnt) {
    console.warn(`[deleteMaintenance] Registro ${id} não encontrado no cache.`);
    return;
  }

  // Remove do cache de manutenção
  cache.maintenanceLogs = cache.maintenanceLogs.filter(m => m.id !== id);
  notifyDataUpdated();

  // Exclui do Firestore
  await deleteDoc(doc(db, 'maintenance_logs', id));

  // Regra de integridade: Se a manutenção excluída for troca de óleo, recalibrar contadores do veículo com base na anterior válida
  if (targetMnt.type === 'TROCA_OLEO' || targetMnt.title.toLowerCase().includes('óleo') || targetMnt.title.toLowerCase().includes('oleo')) {
    const targetVehicle = getVehicles().find(v => v.id === targetMnt.equipmentId);
    if (targetVehicle) {
      const isKm = targetVehicle.category === 'VEICULO' || targetVehicle.maintenanceControlType === 'QUILOMETRAGEM';
      const interval = isKm 
        ? (Number(targetVehicle.oilChangeIntervalKm) || Number(targetVehicle.maintenanceIntervalKm) || 10000)
        : (Number(targetVehicle.oilChangeIntervalHours) || Number(targetVehicle.maintenanceIntervalHours) || 300);

      // Buscar outras trocas de óleo restantes para este equipamento
      const remainingOilChanges = cache.maintenanceLogs
        .filter(m => m.equipmentId === targetVehicle.id && (m.type === 'TROCA_OLEO' || m.title.toLowerCase().includes('óleo') || m.title.toLowerCase().includes('oleo')))
        .sort((a, b) => (b.kmOrHourAtService || 0) - (a.kmOrHourAtService || 0));

      if (remainingOilChanges.length > 0) {
        // Encontrou troca de óleo anterior válida
        const prev = remainingOilChanges[0];
        const nextTarget = prev.nextServiceKmOrHour && prev.nextServiceKmOrHour > prev.kmOrHourAtService
          ? prev.nextServiceKmOrHour
          : prev.kmOrHourAtService + interval;

        const vehicleUpdates: Partial<Vehicle> = {
          lastOilChangeDate: prev.date,
          lastMaintenanceDate: prev.date
        };

        if (isKm) {
          vehicleUpdates.lastOilChangeKm = prev.kmOrHourAtService;
          vehicleUpdates.nextOilChangeKm = nextTarget;
        } else {
          vehicleUpdates.lastOilChangeHourmeter = prev.kmOrHourAtService;
          vehicleUpdates.nextOilChangeHourmeter = nextTarget;
        }

        await updateVehicle(targetVehicle.id, vehicleUpdates);
      } else {
        console.log(`[deleteMaintenance] Nenhuma troca de óleo restante para ${targetVehicle.model}. Mantendo integridade dos dados.`);
      }
    }
  }

  logAuditEvent(
    'EXCLUIR',
    'Manutenção',
    `Manutenção (${caller.name}) excluiu o registro "${targetMnt.title}" (${targetMnt.type}) do equipamento ${targetMnt.equipmentName} (${targetMnt.equipmentPlateOrCode}) no horímetro/KM ${targetMnt.kmOrHourAtService}.`
  );
  checkAutomatedAlerts();
}

// Machine Issue Mutators
export async function addMachineIssue(issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'> & { id?: string }): Promise<MachineIssue> {
  const currentDateTimeISO = getNowSaoPauloISO();
  const currentDateBR = getTodayDateSaoPaulo();
  const newIssue: MachineIssue = {
    ...issueData,
    id: issueData.id || `iss-${Date.now()}`,
    dateTime: currentDateTimeISO,
    status: 'ABERTO'
  };
  const cleaned = cleanUndefined(newIssue);
  cache.machineIssues = [cleaned, ...cache.machineIssues];

  const primaryPhoto = (newIssue.photoUrls && newIssue.photoUrls.length > 0)
    ? newIssue.photoUrls[0]
    : (newIssue.photoUrl || undefined);

  const newAlert: SmartAlert = cleanUndefined({
    id: `alt-iss-${cleaned.id}`,
    type: 'MACHINE_ISSUE',
    severity: 'ALTA',
    title: `Defeito Relatado: ${newIssue.equipmentName}`,
    description: `Operador ${newIssue.reportedByUserName} relatou: "${newIssue.description}"`,
    equipmentId: newIssue.equipmentId,
    equipmentName: newIssue.equipmentName,
    date: currentDateBR,
    resolved: false,
    pushNotified: true,
    pushNotifiedAt: new Date().toISOString(),
    issueId: cleaned.id,
    photoUrl: primaryPhoto,
    photoUrls: newIssue.photoUrls,
    operatorName: newIssue.reportedByUserName
  });
  cache.alerts = [newAlert, ...cache.alerts];
  notifyDataUpdated();

  try {
    await setDoc(doc(db, 'machine_issues', cleaned.id), cleaned);
    await setDoc(doc(db, 'alerts', newAlert.id), newAlert);
  } catch (err) {
    // Prevent orphan files in Firebase Storage if Firestore write fails (Regra 10)
    const photosToRollback = [
      ...(newIssue.photoStoragePaths || []),
      ...(newIssue.photoUrls || (newIssue.photoUrl ? [newIssue.photoUrl] : []))
    ];
    if (photosToRollback.length > 0) {
      deleteDefectPhotos(photosToRollback).catch(() => {});
    }
    throw err;
  }

  logAuditEvent('CRIAR', 'Problema', `Relatou problema em ${newIssue.equipmentName}: ${newIssue.description}`);

  // Dispatch real push notification to authorized users (ADMIN and MANUTENCAO)
  dispatchPushNotificationEvent({
    eventType: 'NEW_ISSUE',
    eventId: `issue-${cleaned.id}`,
    issueId: cleaned.id,
    equipmentName: newIssue.equipmentName,
    equipmentId: newIssue.equipmentId,
    customTitle: `⚠️ Defeito: ${newIssue.equipmentName}`,
    description: newIssue.description || 'Defeito informado pelo operador.',
    reportedByUserId: newIssue.reportedByUserId,
    reportedByUserName: newIssue.reportedByUserName,
    photoUrl: primaryPhoto,
    image: primaryPhoto
  }).catch(() => {});

  return cleaned;
}

export async function resolveMachineIssue(issueId: string, notes?: string): Promise<void> {
  const user = getCurrentUser();
  const targetIssue = cache.machineIssues.find(i => i.id === issueId);

  // Rule 9: Photo must be deleted from Firebase Storage when issue is marked RESOLVIDO
  const photosToDelete: string[] = [
    ...(targetIssue?.photoStoragePaths || []),
    ...(targetIssue?.photoUrls || (targetIssue?.photoUrl ? [targetIssue.photoUrl] : []))
  ];
  if (photosToDelete.length > 0) {
    try {
      await deleteDefectPhotos(photosToDelete);
    } catch (photoErr) {
      console.error('[AndradeAgro Storage] Não foi possível excluir as fotos; o defeito não será resolvido:', photoErr);
      throw new Error(photoErr instanceof Error
        ? `Não foi possível excluir as fotos. O defeito continua aberto. ${photoErr.message}`
        : 'Não foi possível excluir as fotos. O defeito continua aberto. Tente novamente ou contate o suporte.');
    }
  }

  const fields = cleanUndefined({
    status: 'RESOLVIDO',
    resolvedAt: new Date().toISOString(),
    resolvedBy: user?.name || 'Administrador',
    notes: notes || '',
    photoUrl: '',
    photoUrls: [],
    photoStoragePaths: []
  });

  cache.machineIssues = cache.machineIssues.map(i => i.id === issueId ? { ...i, ...fields } as MachineIssue : i);
  notifyDataUpdated();

  await updateDoc(doc(db, 'machine_issues', issueId), fields);
  logAuditEvent('EDITAR', 'Problema', `Resolveu o problema relatado ID ${issueId}`);

  // Sincronizar e resolver alertas correspondentes ao defeito no cache e Firestore
  const matchingAlerts = cache.alerts.filter(a => 
    !a.resolved && (
      a.issueId === issueId || 
      a.id === `alt-iss-${issueId}` || 
      (a.type === 'MACHINE_ISSUE' && targetIssue && a.equipmentId === targetIssue.equipmentId)
    )
  );
  for (const alt of matchingAlerts) {
    alt.resolved = true;
    alt.resolvedAt = new Date().toISOString();
    alt.resolvedBy = user?.name || 'Oficina';
    try {
      await updateDoc(doc(db, 'alerts', alt.id), {
        resolved: true,
        resolvedAt: alt.resolvedAt,
        resolvedBy: alt.resolvedBy
      });
    } catch (e) {
      console.warn('[resolveMachineIssue] Could not update alert in Firestore:', e);
    }
  }
}

// Preventive Maintenance Mutators
export async function recordPreventiveService(
  equipmentId: string, 
  itemKey: PreventiveItemKey, 
  currentHourmeter: number, 
  notes?: string
): Promise<void> {
  const all = getPreventiveItems();
  const target = all.find(item => item.equipmentId === equipmentId && item.itemKey === itemKey);
  const vehicles = getVehicles();
  const vehicle = vehicles.find(v => v.id === equipmentId);
  const interval = target?.intervalHours || vehicle?.maintenanceIntervalHours || 300;

  if (target) {
    const todaySaoPaulo = getTodayDateSaoPaulo();
    const updatedItem: PreventiveMaintenanceItem = cleanUndefined({
      ...target,
      lastServiceDate: todaySaoPaulo,
      lastServiceHourmeter: currentHourmeter,
      nextScheduledHourmeter: currentHourmeter + interval,
      notes: notes || target.notes
    });
    
    cache.preventiveItems = cache.preventiveItems.map(p => p.id === target.id ? updatedItem : p);
    notifyDataUpdated();

    await setDoc(doc(db, 'preventive_items', target.id), updatedItem);

    // Create a maintenance log entry in Firestore
    await addMaintenance({
      equipmentId,
      equipmentName: vehicle?.model || target.itemName,
      equipmentPlateOrCode: vehicle?.patrimonyCode || vehicle?.licensePlate || equipmentId,
      date: todaySaoPaulo,
      dateTime: createTimestampForDateSaoPaulo(todaySaoPaulo),
      type: itemKey.includes('OLEO') ? 'TROCA_OLEO' : (itemKey.includes('FILTRO') ? 'TROCA_FILTROS' : 'REVISAO'),
      title: `Manutenção Preventiva: ${target.itemName}`,
      description: `Serviço realizado no horímetro ${currentHourmeter}h. Próxima programada com +${interval}h (em ${currentHourmeter + interval}h).`,
      kmOrHourAtService: currentHourmeter,
      nextServiceKmOrHour: currentHourmeter + interval,
      cost: 0,
      supplierOrWorkshop: 'Oficina Interna AndradeAgro',
      performedBy: getCurrentUser()?.name || 'Oficina',
      status: 'CONCLUIDO',
      notes
    });

    logAuditEvent('CRIAR', 'Manutenção Preventiva', `Registrou ${target.itemName} em ${vehicle?.model || equipmentId} no horímetro ${currentHourmeter}h.`);
  }
}

// Gas Stations Mutators
export async function addGasStation(stn: Omit<GasStation, 'id'>): Promise<GasStation> {
  const newStn: GasStation = {
    ...stn,
    id: `stn-${Date.now()}`
  };
  const cleaned = cleanUndefined(newStn);
  cache.gasStations = [...cache.gasStations, cleaned];
  notifyDataUpdated();

  await safeSetDoc(doc(db, 'gas_stations', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Posto', `Cadastrou posto ${cleaned.name}.`);
  return cleaned;
}

export async function updateGasStation(id: string, fields: Partial<GasStation>): Promise<void> {
  const cleaned = cleanUndefined(fields);
  cache.gasStations = cache.gasStations.map(s => s.id === id ? { ...s, ...cleaned } : s);
  notifyDataUpdated();

  await safeUpdateDoc(doc(db, 'gas_stations', id), cleaned);
  logAuditEvent('EDITAR', 'Posto', `Atualizou tabela de preços/dados do posto ID ${id}.`);
}

export async function deleteGasStation(id: string): Promise<void> {
  cache.gasStations = cache.gasStations.filter(s => s.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'gas_stations', id));
  logAuditEvent('EXCLUIR', 'Posto', `Excluiu o posto ID ${id}.`);
}

// User Mutators - STRICT RBAC: ONLY MANUTENCAO ALLOWED
export async function addUser(user: Omit<User, 'id'>): Promise<User> {
  const caller = getCurrentUser();
  if (!caller || !canManageUsers(caller.role)) {
    throw new Error('Acesso negado: Somente o perfil Manutenção possui permissão para cadastrar novos usuários.');
  }

  const rawPassword = (user.password && user.password.trim()) || '123456';
  const securePassword = hashPassword(rawPassword);

  const newUser: User = {
    ...user,
    password: securePassword,
    id: `usr-${Date.now()}`
  };
  const cleaned = cleanUndefined(newUser);
  cache.users = [...cache.users, cleaned];
  notifyDataUpdated();

  await setDoc(doc(db, 'users', cleaned.id), cleaned);
  logAuditEvent('CRIAR', 'Usuário', `Manutenção (${caller.name}) cadastrou o usuário ${cleaned.name} (${cleaned.role}).`);
  return sanitizeUserForClient(cleaned);
}

export async function updateUser(id: string, fields: Partial<User>): Promise<void> {
  const caller = getCurrentUser();
  if (!caller || !canManageUsers(caller.role)) {
    throw new Error('Acesso negado: Somente o perfil Manutenção possui permissão para editar usuários.');
  }

  const fieldsCopy = { ...fields };
  
  // If password was explicitly passed and non-empty, hash it securely; otherwise, omit it from updates
  if (fieldsCopy.password) {
    const trimmed = fieldsCopy.password.trim();
    if (trimmed.length > 0) {
      fieldsCopy.password = hashPassword(trimmed);
    } else {
      delete fieldsCopy.password;
    }
  } else {
    delete fieldsCopy.password;
  }

  const cleaned = cleanUndefined(fieldsCopy);
  cache.users = cache.users.map(u => u.id === id ? { ...u, ...cleaned } : u);
  notifyDataUpdated();

  await updateDoc(doc(db, 'users', id), cleaned);
  const targetUser = cache.users.find(u => u.id === id);
  logAuditEvent('EDITAR', 'Usuário', `Manutenção (${caller.name}) atualizou os dados do usuário ${targetUser?.name || id}.`);
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  const caller = getCurrentUser();
  if (!caller || !canManageUsers(caller.role)) {
    throw new Error('Acesso negado: Somente o perfil Manutenção possui permissão para redefinir senhas.');
  }

  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error('A nova senha deve possuir no mínimo 6 caracteres.');
  }

  const target = cache.users.find(u => u.id === id);
  if (!target) {
    throw new Error('Usuário não encontrado no sistema.');
  }

  const securePassword = hashPassword(newPassword.trim());
  cache.users = cache.users.map(u => u.id === id ? { ...u, password: securePassword } : u);
  notifyDataUpdated();

  await updateDoc(doc(db, 'users', id), { password: securePassword });
  logAuditEvent('EDITAR', 'Usuário', `Manutenção (${caller.name}) redefiniu a senha de acesso do usuário ${target.name}.`);
}

export async function deleteUser(id: string): Promise<void> {
  const caller = getCurrentUser();
  if (!caller || !canManageUsers(caller.role)) {
    throw new Error('Acesso negado: Somente o perfil Manutenção possui permissão para excluir usuários.');
  }

  if (caller.id === id) {
    throw new Error('Você não pode excluir o seu próprio usuário enquanto está conectado.');
  }

  const target = cache.users.find(u => u.id === id);
  const targetName = target ? target.name : id;

  cache.users = cache.users.filter(u => u.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'users', id));
  logAuditEvent('EXCLUIR', 'Usuário', `Manutenção (${caller.name}) excluiu o usuário ${targetName}.`);
}

// Alerts Mutator
export async function resolveAlert(id: string, resolvedByName?: string): Promise<void> {
  const user = getCurrentUser();
  const fields = cleanUndefined({
    resolved: true,
    resolvedAt: new Date().toISOString(),
    resolvedBy: resolvedByName || user?.name || 'Administrador'
  });

  const targetAlert = cache.alerts.find(a => a.id === id);
  if (targetAlert?.equipmentId && (
    targetAlert.type === 'OIL_CHANGE_DUE' || 
    targetAlert.title?.toLowerCase().includes('óleo') || 
    targetAlert.title?.toLowerCase().includes('oleo')
  )) {
    clearPushEventDeduplication(`oil-alert-${targetAlert.equipmentId}`).catch(() => {});
    clearPushEventDeduplication(`oil-warning-${targetAlert.equipmentId}`).catch(() => {});
  }
  if (targetAlert?.id?.startsWith('alt-low-tank-') || targetAlert?.type === 'LOW_TANK_LEVEL') {
    const tankId = targetAlert.equipmentId || targetAlert.id.replace('alt-low-tank-', '');
    clearPushEventDeduplication(`tank-alert-${tankId}`).catch(() => {});
  }
  if (targetAlert?.type === 'SUSPICIOUS_FUEL' && targetAlert?.id) {
    clearPushEventDeduplication(targetAlert.id).catch(() => {});
  }

  // Se o alerta for de MACHINE_ISSUE, sincronizar e resolver o defeito em machine_issues
  if (targetAlert?.type === 'MACHINE_ISSUE' || targetAlert?.issueId) {
    const matchingIssue = cache.machineIssues.find(i => 
      i.status === 'ABERTO' && (
        (targetAlert.issueId && i.id === targetAlert.issueId) ||
        (targetAlert.equipmentId && i.equipmentId === targetAlert.equipmentId)
      )
    );
    if (matchingIssue) {
      resolveMachineIssue(matchingIssue.id, 'Resolvido via Central de Alertas').catch(err => {
        console.warn('[resolveAlert] Auto resolving machine issue:', err);
      });
    }
  }

  cache.alerts = cache.alerts.map(a => a.id === id ? { ...a, ...fields } as SmartAlert : a);
  notifyDataUpdated();

  await updateDoc(doc(db, 'alerts', id), fields);
  logAuditEvent('EDITAR', 'Alerta', `Marcou alerta ID ${id} como resolvido.`);
}

// Fuel Refill (Entrada / Reabastecimento de Tanque) Mutators
export async function addFuelRefill(refill: Omit<FuelRefill, 'id' | 'createdAt'>): Promise<FuelRefill> {
  const newRefill: FuelRefill = {
    ...refill,
    id: `refill-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  const cleaned = cleanUndefined(newRefill);
  cache.fuelRefills = [cleaned, ...cache.fuelRefills];
  notifyDataUpdated();

  await setDoc(doc(db, 'fuel_refills', cleaned.id), cleaned);

  // Register in Tank Movements and update tank stock
  const targetTankId = (refill as any).tankId || 'tank-quadra';
  const targetTank = getCentralTank(targetTankId) || getCentralTanks()[0];
  const prevStock = Number(targetTank?.currentStockLiters ?? 7500);
  const afterStock = prevStock + cleaned.liters;

  if (targetTank) {
    targetTank.currentStockLiters = afterStock;
    cache.centralTanks = cache.centralTanks.map(t => t.id === targetTank.id ? { ...t, currentStockLiters: afterStock } : t);
    await updateDoc(doc(db, 'central_tanks', targetTank.id), {
      currentStockLiters: afterStock
    });
  }

  await addTankMovement({
    tankId: targetTankId,
    dateTime: cleaned.dateTime || (cleaned as any).date || new Date().toISOString(),
    type: 'ENTRADA',
    liters: cleaned.liters,
    previousStock: prevStock,
    afterStock: afterStock,
    userId: getCurrentUser()?.id || 'sys',
    userName: getCurrentUser()?.name || 'Administrador',
    refillId: cleaned.id,
    notes: `Recebimento de combustível: ${cleaned.liters.toLocaleString('pt-BR')}L (${cleaned.fuelType}) de ${cleaned.supplierName || 'Fornecedor'}. NF: ${cleaned.invoiceNumber || 'S/N'}.`
  });

  logAuditEvent('CRIAR', 'Entrada de Combustível', `Registrou entrada de ${cleaned.liters.toLocaleString('pt-BR')}L no ${targetTank?.name || 'Tanque Central'} (${cleaned.fuelType}) de ${cleaned.supplierName || 'Fornecedor'}.`);
  
  checkAutomatedAlerts();
  return cleaned;
}

export async function deleteFuelRefill(id: string): Promise<void> {
  cache.fuelRefills = cache.fuelRefills.filter(r => r.id !== id);
  notifyDataUpdated();

  await deleteDoc(doc(db, 'fuel_refills', id));
  logAuditEvent('EXCLUIR', 'Entrada de Combustível', `Removeu o registro de entrada de combustível ID ${id}.`);
  checkAutomatedAlerts();
}

// Dedicated Oil Change / Maintenance Service Recorder
export async function recordOilChange(
  equipmentId: string,
  recordedMeter: number,
  date?: string,
  cost: number = 0,
  notes?: string,
  extra?: {
    oilType?: string;
    oilQuantityLiters?: number;
    filtersReplaced?: string;
    performedBy?: string;
    supplierOrWorkshop?: string;
    isKm?: boolean;
  }
): Promise<void> {
  const serviceDate = date || getTodayDateSaoPaulo();
  const vehicles = getVehicles();
  const targetVehicle = vehicles.find(v => v.id === equipmentId);
  const isKm = extra?.isKm ?? (targetVehicle?.category === 'VEICULO' || targetVehicle?.maintenanceControlType === 'QUILOMETRAGEM');
  
  const interval = isKm
    ? (Number(targetVehicle?.oilChangeIntervalKm) || Number(targetVehicle?.maintenanceIntervalKm) || 10000)
    : (Number(targetVehicle?.oilChangeIntervalHours) || Number(targetVehicle?.maintenanceIntervalHours) || 300);
    
  const nextScheduled = recordedMeter + interval;
  const performedBy = extra?.performedBy || getCurrentUser()?.name || 'Mecânico Responsável';
  const supplierOrWorkshop = extra?.supplierOrWorkshop || 'Oficina Interna AndradeAgro';
  const oilType = extra?.oilType || (isKm ? 'Óleo Motor 5W30 / 15W40' : 'Óleo Motor 15W40');
  const oilQuantityLiters = extra?.oilQuantityLiters;
  const filtersReplaced = extra?.filtersReplaced;

  if (targetVehicle) {
    const updatedVehicle: Partial<Vehicle> = {
      oilChangeControlActive: true,
      lastOilChangeDate: serviceDate,
      lastMaintenanceDate: serviceDate,
    };

    if (isKm) {
      updatedVehicle.lastOilChangeKm = recordedMeter;
      updatedVehicle.nextOilChangeKm = nextScheduled;
      updatedVehicle.lastMaintenanceKm = recordedMeter;
      updatedVehicle.nextMaintenanceKm = nextScheduled;
      updatedVehicle.oilChangeIntervalKm = interval;
      updatedVehicle.maintenanceIntervalKm = interval;
      updatedVehicle.currentKm = Math.max(targetVehicle.currentKm || 0, recordedMeter);
    } else {
      updatedVehicle.lastOilChangeHourmeter = recordedMeter;
      updatedVehicle.nextOilChangeHourmeter = nextScheduled;
      updatedVehicle.lastMaintenanceHourmeter = recordedMeter;
      updatedVehicle.nextMaintenanceHourmeter = nextScheduled;
      updatedVehicle.oilChangeIntervalHours = interval;
      updatedVehicle.maintenanceIntervalHours = interval;
      updatedVehicle.currentHourmeter = Math.max(targetVehicle.currentHourmeter || 0, recordedMeter);
    }

    await updateVehicle(targetVehicle.id, updatedVehicle);
  }

  // Update Preventive Item if exists
  const allPrev = getPreventiveItems();
  const oilPrevItem = allPrev.find(p => p.equipmentId === equipmentId && p.itemKey === 'TROCA_OLEO_MOTOR');
  if (oilPrevItem) {
    const updatedItem = cleanUndefined({
      ...oilPrevItem,
      lastServiceDate: serviceDate,
      lastServiceHourmeter: !isKm ? recordedMeter : undefined,
      nextScheduledHourmeter: !isKm ? nextScheduled : undefined,
      intervalHours: !isKm ? interval : undefined,
      notes: notes || oilPrevItem.notes
    });
    cache.preventiveItems = cache.preventiveItems.map(p => p.id === oilPrevItem.id ? updatedItem : p);
    await setDoc(doc(db, 'preventive_items', oilPrevItem.id), updatedItem);
  }

  // Resolve ALL existing oil alerts for this equipment
  const alertsToResolve = cache.alerts.filter(a => 
    a.equipmentId === equipmentId && 
    (
      a.type === 'OIL_CHANGE_DUE' || 
      a.id === `alt-oil-${equipmentId}` || 
      a.id === `alt-km-${equipmentId}` || 
      (a.title && (a.title.toLowerCase().includes('óleo') || a.title.toLowerCase().includes('oleo')))
    ) &&
    !a.resolved
  );
  for (const a of alertsToResolve) {
    await resolveAlert(a.id, 'Troca de Óleo Registrada');
  }
  await clearPushEventDeduplication('oil-alert-' + equipmentId).catch(() => {});

  // Auto-resolve any pending reported issues related strictly to oil change on this vehicle
  const oilIssuesToResolve = (cache.machineIssues || []).filter(
    iss => iss.equipmentId === equipmentId &&
    iss.status === 'ABERTO' &&
    (
      iss.description.toLowerCase().includes('troca de óleo') ||
      iss.description.toLowerCase().includes('troca de oleo') ||
      iss.description.toLowerCase().includes('óleo do motor') ||
      iss.description.toLowerCase().includes('oleo do motor') ||
      iss.description.toLowerCase().includes('óleo vencid') ||
      iss.description.toLowerCase().includes('oleo vencid') ||
      iss.description.toLowerCase().includes('revisão de óleo') ||
      iss.description.toLowerCase().includes('revisao de oleo') ||
      iss.description.toLowerCase().includes('troca de lubrificante')
    )
  );
  for (const iss of oilIssuesToResolve) {
    iss.status = 'RESOLVIDO';
    try {
      await updateDoc(doc(db, 'machine_issues', iss.id), { status: 'RESOLVIDO' });
    } catch (e) {
      console.warn('[recordOilChange] Could not update machine issue in Firestore:', e);
    }
  }

  const unitLabel = isKm ? 'km' : 'h';
  let desc = `Troca de óleo realizada no ${isKm ? 'odômetro' : 'horímetro'} ${recordedMeter.toLocaleString('pt-BR')} ${unitLabel}. Intervalo: ${interval.toLocaleString('pt-BR')} ${unitLabel}. Próxima troca programada para ${nextScheduled.toLocaleString('pt-BR')} ${unitLabel}.`;
  if (oilType) desc += ` Tipo: ${oilType}.`;
  if (oilQuantityLiters) desc += ` Volume: ${oilQuantityLiters}L.`;
  if (filtersReplaced) desc += ` Filtros: ${filtersReplaced}.`;

  // Add Maintenance Log
  await addMaintenance({
    equipmentId,
    equipmentName: targetVehicle?.model || (isKm ? 'Veículo' : 'Máquina Agrícola'),
    equipmentPlateOrCode: targetVehicle?.licensePlate || targetVehicle?.patrimonyCode || equipmentId,
    date: serviceDate,
    dateTime: createTimestampForDateSaoPaulo(serviceDate),
    type: 'TROCA_OLEO',
    title: `Troca de Óleo do Motor (${recordedMeter.toLocaleString('pt-BR')} ${unitLabel})`,
    description: desc,
    kmOrHourAtService: recordedMeter,
    nextServiceKmOrHour: nextScheduled,
    cost,
    supplierOrWorkshop,
    performedBy,
    status: 'CONCLUIDO',
    notes,
    oilType,
    oilQuantityLiters,
    filtersReplaced,
    intervalHoursApplied: !isKm ? interval : undefined
  });

  logAuditEvent('CRIAR', 'Troca de Óleo', `Registrou troca de óleo em ${targetVehicle?.model || equipmentId} no ${isKm ? 'km' : 'horímetro'} ${recordedMeter.toLocaleString('pt-BR')} ${unitLabel} (Próxima: ${nextScheduled.toLocaleString('pt-BR')} ${unitLabel}).`);
  checkAutomatedAlerts();
  notifyDataUpdated();
}

// Configurator for Oil Change Interval & Initial Reference Meter without creating fake past maintenance
export async function setOilChangeConfigAndReference(
  equipmentId: string,
  config: {
    active: boolean;
    intervalHours?: number;
    intervalKm?: number;
    warningAdvanceHours?: number;
    warningAdvanceKm?: number;
    referenceHourmeter?: number;
    referenceKm?: number;
    lastServiceDate?: string;
    isKm?: boolean;
  }
): Promise<void> {
  const vehicles = getVehicles();
  const target = vehicles.find(v => v.id === equipmentId);
  if (!target) return;

  const isKm = config.isKm ?? (target.category === 'VEICULO' || target.maintenanceControlType === 'QUILOMETRAGEM');
  const active = config.active !== false;

  const vehicleUpdates: Partial<Vehicle> = {
    oilChangeControlActive: active,
    lastOilChangeDate: config.lastServiceDate || target.lastOilChangeDate || new Date().toISOString().slice(0, 10),
  };

  if (isKm) {
    const intervalKm = Math.max(1, Number(config.intervalKm) || Number(config.intervalHours) || 10000);
    const advanceKm = Math.max(0, Number(config.warningAdvanceKm) || Number(config.warningAdvanceHours) || 1000);
    const refKm = config.referenceKm !== undefined 
      ? Number(config.referenceKm)
      : (target.lastOilChangeKm !== undefined ? Number(target.lastOilChangeKm) : (target.lastMaintenanceKm !== undefined ? Number(target.lastMaintenanceKm) : (target.currentKm || 0)));
    const nextKm = refKm + intervalKm;

    vehicleUpdates.oilChangeIntervalKm = intervalKm;
    vehicleUpdates.oilChangeWarningAdvanceKm = advanceKm;
    vehicleUpdates.lastOilChangeKm = refKm;
    vehicleUpdates.nextOilChangeKm = nextKm;
    vehicleUpdates.maintenanceIntervalKm = intervalKm;
    vehicleUpdates.maintenanceWarningAdvanceKm = advanceKm;
    vehicleUpdates.lastMaintenanceKm = refKm;
    vehicleUpdates.nextMaintenanceKm = nextKm;
  } else {
    const intervalHours = Math.max(1, Number(config.intervalHours) || 300);
    const advanceHours = Math.max(0, Number(config.warningAdvanceHours) || 50);
    const refMeter = config.referenceHourmeter !== undefined 
      ? Number(config.referenceHourmeter) 
      : (target.lastOilChangeHourmeter !== undefined ? Number(target.lastOilChangeHourmeter) : (target.currentHourmeter || 0));
    const nextHours = refMeter + intervalHours;

    vehicleUpdates.oilChangeIntervalHours = intervalHours;
    vehicleUpdates.oilChangeWarningAdvanceHours = advanceHours;
    vehicleUpdates.lastOilChangeHourmeter = refMeter;
    vehicleUpdates.nextOilChangeHourmeter = nextHours;
    vehicleUpdates.maintenanceIntervalHours = intervalHours;
    vehicleUpdates.maintenanceWarningAdvanceHours = advanceHours;
    vehicleUpdates.lastMaintenanceHourmeter = refMeter;
    vehicleUpdates.nextMaintenanceHourmeter = nextHours;
  }

  await updateVehicle(target.id, vehicleUpdates);

  // If deactivated, resolve pending alerts for this equipment
  if (!active) {
    const existingAlert = cache.alerts.find(a => 
      a.id === `alt-oil-${equipmentId}` || 
      a.id === `alt-km-${equipmentId}` || 
      (a.equipmentId === equipmentId && (a.type === 'OIL_CHANGE_DUE' || a.type === 'PREVENTIVE_MAINTENANCE'))
    );
    if (existingAlert && !existingAlert.resolved) {
      await resolveAlert(existingAlert.id);
    }
  }

  logAuditEvent('CONFIGURACAO', 'Troca de Óleo', `Configurou troca de óleo de ${target.model}: Intervalo ${isKm ? `${vehicleUpdates.oilChangeIntervalKm} km` : `${vehicleUpdates.oilChangeIntervalHours} h`}, Ativo: ${active ? 'Sim' : 'Não'}.`);
  checkAutomatedAlerts();
  notifyDataUpdated();
}

// Automated Intelligence Checker for Alerts (Multi-tank & Multi-interval maintenance)
export function checkAutomatedAlerts(triggerPushOnNewAlert: boolean = false) {
  try {
    const settings = getSettings();
    if (!settings.autoAlertsEnabled) return;

    // 1. Check Tank Level for EACH Central Tank independently (Quadra & Itapeva)
    const centralTanks = getCentralTanks();
    centralTanks.forEach(tank => {
      const tankStatus = getTankStatus(tank.id);
      const lowTankAlertId = `alt-low-tank-${tank.id}`;
      const existingLowTank = cache.alerts.find(a => a.id === lowTankAlertId);
      const minStock = tank.minStockAlertLiters || 2000;

      if (tankStatus.currentStock <= minStock) {
        const isCritical = tankStatus.currentStock <= Math.max(500, minStock * 0.25);
        const title = isCritical ? `🔴 Estoque crítico - ${tank.name}` : `⚠️ Estoque baixo - ${tank.name}`;
        const desc = `O ${tank.name} (${tank.location}) está com ${Math.round(tankStatus.currentStock).toLocaleString('pt-BR')} L. Nível ${isCritical ? 'crítico' : 'abaixo do estoque mínimo'} de ${minStock.toLocaleString('pt-BR')} L. Reabastecimento recomendado.`;

        if (!existingLowTank) {
          const alertObj: SmartAlert = cleanUndefined({
            id: lowTankAlertId,
            type: 'LOW_TANK_LEVEL',
            severity: isCritical ? 'ALTA' : 'MEDIA',
            title,
            description: desc,
            date: new Date().toISOString().slice(0, 10),
            resolved: false,
            pushNotified: true,
            pushNotifiedAt: new Date().toISOString()
          });
          cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== lowTankAlertId)];
          setDoc(doc(db, 'alerts', lowTankAlertId), alertObj).catch(console.error);

          // Disparo de Web Push para nível de tanque baixo
          const tankEventId = `tank-alert-${tank.id}-${isCritical ? 'crit' : 'low'}-${Math.round(tankStatus.currentStock)}`;
          dispatchPushNotificationEvent({
            eventType: 'LOW_TANK_LEVEL',
            eventId: tankEventId,
            equipmentName: tank.name,
            equipmentId: tank.id,
            customTitle: title,
            description: desc
          }).catch(() => {});
        } else if (!existingLowTank.resolved || existingLowTank.description !== desc) {
          const transitionToCritical = isCritical && existingLowTank.severity !== 'ALTA';
          const updated: SmartAlert = cleanUndefined({
            ...existingLowTank,
            title,
            description: desc,
            severity: isCritical ? 'ALTA' : 'MEDIA',
            resolved: false,
            resolvedAt: undefined,
            resolvedBy: undefined,
            pushNotified: transitionToCritical ? true : existingLowTank.pushNotified,
            pushNotifiedAt: transitionToCritical ? new Date().toISOString() : existingLowTank.pushNotifiedAt
          });
          cache.alerts = cache.alerts.map(a => a.id === lowTankAlertId ? updated : a);
          setDoc(doc(db, 'alerts', lowTankAlertId), updated).catch(console.error);

          if (transitionToCritical) {
            const tankCritEventId = `tank-alert-${tank.id}-crit-${Math.round(tankStatus.currentStock)}`;
            dispatchPushNotificationEvent({
              eventType: 'LOW_TANK_LEVEL',
              eventId: tankCritEventId,
              equipmentName: tank.name,
              equipmentId: tank.id,
              customTitle: title,
              description: desc
            }).catch(() => {});
          }
        }
      } else if (existingLowTank && !existingLowTank.resolved) {
        // Tank level returned to above minimum limit -> auto-resolve the alert
        const resolvedAlert = cleanUndefined({
          ...existingLowTank,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedBy: 'Sistema (Estoque Normalizado)'
        });
        cache.alerts = cache.alerts.map(a => a.id === lowTankAlertId ? resolvedAlert : a);
        setDoc(doc(db, 'alerts', lowTankAlertId), resolvedAlert).catch(console.error);
        clearPushEventDeduplication(`tank-alert-${tank.id}`).catch(() => {});
      }
    });

    // 2. Check Flexible & Individual Maintenance Intervals per Vehicle/Machine
    const vehicles = getVehicles();
    vehicles.forEach(v => {
      const isKm = v.category === 'VEICULO' || v.maintenanceControlType === 'QUILOMETRAGEM';
      
      if (!isKm) {
        // Hour-based maintenance control - STRICTLY OIL CHANGE FIELDS ONLY
        const isOilControlActive = v.oilChangeControlActive !== false;
        const curHour = Number(v.currentHourmeter) || 0;
        const lastMnt = Number(v.lastOilChangeHourmeter) || 0;
        const interval = Number(v.oilChangeIntervalHours) || Number(v.maintenanceIntervalHours) || 300;
        const warningAdvance = v.oilChangeWarningAdvanceHours !== undefined ? Number(v.oilChangeWarningAdvanceHours) : (Number(v.maintenanceWarningAdvanceHours) || 50);
        const nextMnt = v.nextOilChangeHourmeter !== undefined
          ? Number(v.nextOilChangeHourmeter)
          : (lastMnt > 0 ? lastMnt + interval : interval);

        const mntAlertId = `alt-oil-${v.id}`;
        const openAlert = cache.alerts.find(a => 
          (a.id === mntAlertId || a.equipmentId === v.id) && 
          a.type === 'OIL_CHANGE_DUE' && 
          !a.resolved
        );

        if (!isOilControlActive || v.category === 'IMPLEMENTO') {
          // If oil change control is disabled for this equipment, resolve any open alert
          if (openAlert) {
            const resolvedAlert: SmartAlert = cleanUndefined({
              ...openAlert,
              resolved: true,
              resolvedAt: new Date().toISOString(),
              resolvedBy: 'Sistema (Controle Desativado)'
            });
            cache.alerts = cache.alerts.map(a => a.id === openAlert.id ? resolvedAlert : a);
            setDoc(doc(db, 'alerts', openAlert.id), resolvedAlert).catch(console.error);
          }
          return;
        }

        if (curHour > 0) {
          const cycleId = `${v.id}-${nextMnt}`;
          const cycleEventId = `oil-alert-${v.id}-${nextMnt}`;

          if (curHour >= nextMnt) {
            // Overdue / Vencida: 🔴 Troca de óleo vencida
            const delay = curHour - nextMnt;
            const title = `🔴 Troca de óleo vencida: ${v.model}`;
            const desc = `Equipamento: ${v.model}. Horímetro atual: ${curHour}h. Troca prevista: ${nextMnt}h. Atraso: ${delay}h (Intervalo: ${interval}h).`;

            // Condition 1: No open alert, or open alert belongs to an older cycle
            if (!openAlert || openAlert.cycleTargetHourmeter !== nextMnt) {
              if (openAlert) {
                // Supersede older open alert
                openAlert.resolved = true;
                openAlert.resolvedAt = new Date().toISOString();
                openAlert.resolvedBy = 'Sistema (Novo Ciclo)';
              }

              const alertObj: SmartAlert = cleanUndefined({
                id: mntAlertId,
                type: 'OIL_CHANGE_DUE',
                severity: 'ALTA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false,
                cycleTargetHourmeter: nextMnt,
                lastOilChangeHourmeter: lastMnt,
                cycleId,
                pushNotified: true,
                pushNotifiedForCycle: nextMnt,
                pushNotifiedAt: new Date().toISOString()
              });

              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== mntAlertId && !(a.equipmentId === v.id && a.type === 'OIL_CHANGE_DUE' && !a.resolved))];
              setDoc(doc(db, 'alerts', mntAlertId), alertObj).catch(console.error);

              // Dispatch real push notification to authorized users
              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: cycleEventId,
                equipmentName: v.model,
                equipmentId: v.id,
                customTitle: title,
                description: `O equipamento ${v.model} atingiu ${curHour}h e está com troca de óleo vencida (programada para ${nextMnt}h).`
              }).catch(() => {});

            } else if (openAlert.severity !== 'ALTA') {
              // Transition from Warning (MEDIA) to Overdue (ALTA)
              const updated: SmartAlert = cleanUndefined({
                ...openAlert,
                title,
                description: desc,
                severity: 'ALTA' as const,
                cycleTargetHourmeter: nextMnt,
                pushNotified: true,
                pushNotifiedForCycle: nextMnt,
                pushNotifiedAt: new Date().toISOString()
              });
              cache.alerts = cache.alerts.map(a => a.id === openAlert.id ? updated : a);
              setDoc(doc(db, 'alerts', openAlert.id), updated).catch(console.error);

              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: cycleEventId,
                equipmentName: v.model,
                equipmentId: v.id,
                customTitle: title,
                description: `O equipamento ${v.model} atingiu ${curHour}h e está com troca de óleo vencida (programada para ${nextMnt}h).`
              }).catch(() => {});

            } else if (!openAlert.pushNotified || openAlert.pushNotifiedForCycle !== nextMnt) {
              // Open alert exists but push notification was not yet dispatched for this cycle
              openAlert.pushNotified = true;
              openAlert.pushNotifiedForCycle = nextMnt;
              openAlert.pushNotifiedAt = new Date().toISOString();
              cache.alerts = cache.alerts.map(a => a.id === openAlert.id ? { ...openAlert } : a);
              setDoc(doc(db, 'alerts', openAlert.id), openAlert).catch(console.error);

              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: cycleEventId,
                equipmentName: v.model,
                equipmentId: v.id,
                customTitle: title,
                description: `O equipamento ${v.model} atingiu ${curHour}h e está com troca de óleo vencida (programada para ${nextMnt}h).`
              }).catch(() => {});

            } else if (openAlert.description !== desc) {
              // Update description if hourmeter incremented
              const updated = cleanUndefined({
                ...openAlert,
                description: desc
              }) as SmartAlert;
              cache.alerts = cache.alerts.map(a => a.id === openAlert.id ? updated : a);
              setDoc(doc(db, 'alerts', openAlert.id), updated).catch(console.error);
            }
          } else if (curHour >= (nextMnt - warningAdvance)) {
            // Near due / Próxima da manutenção: 🟡 Troca de óleo próxima
            const diff = nextMnt - curHour;
            const title = `🟡 Troca de óleo próxima: ${v.model}`;
            const desc = `Equipamento: ${v.model}. Próxima troca: ${nextMnt}h. Horímetro atual: ${curHour}h. Faltam: ${diff}h (Intervalo: ${interval}h).`;

            if (!openAlert || openAlert.cycleTargetHourmeter !== nextMnt || openAlert.severity !== 'MEDIA') {
              const alertObj: SmartAlert = cleanUndefined({
                id: mntAlertId,
                type: 'OIL_CHANGE_DUE',
                severity: 'MEDIA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false,
                cycleTargetHourmeter: nextMnt,
                lastOilChangeHourmeter: lastMnt,
                cycleId,
                pushNotified: true,
                pushNotifiedForCycle: nextMnt,
                pushNotifiedAt: new Date().toISOString()
              });
              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== mntAlertId && !(a.equipmentId === v.id && a.type === 'OIL_CHANGE_DUE' && !a.resolved))];
              setDoc(doc(db, 'alerts', mntAlertId), alertObj).catch(console.error);

              // Disparo de Web Push para aviso de troca de óleo próxima
              const warningEventId = `oil-warning-${v.id}-${nextMnt}`;
              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: warningEventId,
                equipmentName: v.model,
                equipmentId: v.id,
                customTitle: title,
                description: `O equipamento ${v.model} está próximo da troca de óleo (${curHour}h / ${nextMnt}h). Faltam ${diff}h.`
              }).catch(() => {});
            } else if (openAlert.description !== desc) {
              const updated = cleanUndefined({
                ...openAlert,
                description: desc
              }) as SmartAlert;
              cache.alerts = cache.alerts.map(a => a.id === openAlert.id ? updated : a);
              setDoc(doc(db, 'alerts', openAlert.id), updated).catch(console.error);
            }
          } else {
            // Machine maintenance is within safe bounds: resolve any open oil alerts for this equipment
            const openAlerts = cache.alerts.filter(a => 
              (a.id === mntAlertId || a.equipmentId === v.id) && 
              (a.type === 'OIL_CHANGE_DUE' || a.id === mntAlertId || (a.title && (a.title.toLowerCase().includes('óleo') || a.title.toLowerCase().includes('oleo')))) &&
              !a.resolved
            );
            for (const openAlt of openAlerts) {
              const resolvedAlert: SmartAlert = cleanUndefined({
                ...openAlt,
                resolved: true,
                resolvedAt: new Date().toISOString(),
                resolvedBy: 'Sistema (Troca de Óleo em Dia)'
              });
              cache.alerts = cache.alerts.map(a => a.id === openAlt.id ? resolvedAlert : a);
              setDoc(doc(db, 'alerts', openAlt.id), resolvedAlert).catch(console.error);
            }
          }
        }
      } else {
        // Km-based maintenance / oil change control for vehicles - STRICTLY OIL CHANGE FIELDS ONLY
        const isOilControlActive = v.oilChangeControlActive !== false;
        const curKm = Number(v.currentKm) || 0;
        const lastKm = Number(v.lastOilChangeKm) || 0;
        const intervalKm = Number(v.oilChangeIntervalKm) || Number(v.maintenanceIntervalKm) || 10000;
        const warningAdvanceKm = v.oilChangeWarningAdvanceKm !== undefined ? Number(v.oilChangeWarningAdvanceKm) : (Number(v.maintenanceWarningAdvanceKm) || 1000);
        const nextKm = v.nextOilChangeKm !== undefined
          ? Number(v.nextOilChangeKm)
          : (lastKm > 0 ? lastKm + intervalKm : intervalKm);

        const kmAlertId = `alt-oil-${v.id}`;
        const openKmAlert = cache.alerts.find(a => 
          (a.id === kmAlertId || a.equipmentId === v.id) && 
          a.type === 'OIL_CHANGE_DUE' && 
          !a.resolved
        );

        if (!isOilControlActive) {
          if (openKmAlert) {
            const resolvedAlert: SmartAlert = cleanUndefined({
              ...openKmAlert,
              resolved: true,
              resolvedAt: new Date().toISOString(),
              resolvedBy: 'Sistema (Controle Desativado)'
            });
            cache.alerts = cache.alerts.map(a => a.id === openKmAlert.id ? resolvedAlert : a);
            setDoc(doc(db, 'alerts', openKmAlert.id), resolvedAlert).catch(console.error);
          }
          return;
        }

        if (curKm > 0) {
          const cycleId = `${v.id}-${nextKm}`;
          const cycleEventId = `oil-alert-${v.id}-${nextKm}`;

          if (curKm >= nextKm) {
            // Overdue: 🔴 Troca de óleo vencida
            const delayKm = curKm - nextKm;
            const title = `🔴 Troca de óleo vencida: ${v.model} (${v.licensePlate || 'Placa'})`;
            const desc = `Veículo: ${v.model} (${v.licensePlate}). Odômetro atual: ${curKm.toLocaleString('pt-BR')} km. Troca prevista: ${nextKm.toLocaleString('pt-BR')} km. Atraso: ${delayKm.toLocaleString('pt-BR')} km (Intervalo: ${intervalKm.toLocaleString('pt-BR')} km).`;

            // Condition 1: No open alert, or open alert belongs to an older cycle
            if (!openKmAlert || openKmAlert.cycleTargetKm !== nextKm) {
              if (openKmAlert) {
                openKmAlert.resolved = true;
                openKmAlert.resolvedAt = new Date().toISOString();
                openKmAlert.resolvedBy = 'Sistema (Novo Ciclo)';
              }

              const alertObj: SmartAlert = cleanUndefined({
                id: kmAlertId,
                type: 'OIL_CHANGE_DUE',
                severity: 'ALTA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false,
                cycleTargetKm: nextKm,
                lastOilChangeKm: lastKm,
                cycleId,
                pushNotified: true,
                pushNotifiedForCycle: nextKm,
                pushNotifiedAt: new Date().toISOString()
              });

              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== kmAlertId && !(a.equipmentId === v.id && a.type === 'OIL_CHANGE_DUE' && !a.resolved))];
              setDoc(doc(db, 'alerts', kmAlertId), alertObj).catch(console.error);

              // Dispatch real push notification to authorized users
              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: cycleEventId,
                equipmentName: `${v.model} (${v.licensePlate || 'Veículo'})`,
                equipmentId: v.id,
                customTitle: title,
                description: `O veículo ${v.model} atingiu ${curKm.toLocaleString('pt-BR')} km e está com troca de óleo vencida (programada para ${nextKm.toLocaleString('pt-BR')} km).`
              }).catch(() => {});

            } else if (openKmAlert.severity !== 'ALTA') {
              // Transition from Warning (MEDIA) to Overdue (ALTA)
              const updated: SmartAlert = cleanUndefined({
                ...openKmAlert,
                title,
                description: desc,
                severity: 'ALTA' as const,
                cycleTargetKm: nextKm,
                pushNotified: true,
                pushNotifiedForCycle: nextKm,
                pushNotifiedAt: new Date().toISOString()
              });
              cache.alerts = cache.alerts.map(a => a.id === openKmAlert.id ? updated : a);
              setDoc(doc(db, 'alerts', openKmAlert.id), updated).catch(console.error);

              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: cycleEventId,
                equipmentName: `${v.model} (${v.licensePlate || 'Veículo'})`,
                equipmentId: v.id,
                customTitle: title,
                description: `O veículo ${v.model} atingiu ${curKm.toLocaleString('pt-BR')} km e está com troca de óleo vencida (programada para ${nextKm.toLocaleString('pt-BR')} km).`
              }).catch(() => {});

            } else if (!openKmAlert.pushNotified || openKmAlert.pushNotifiedForCycle !== nextKm) {
              openKmAlert.pushNotified = true;
              openKmAlert.pushNotifiedForCycle = nextKm;
              openKmAlert.pushNotifiedAt = new Date().toISOString();
              cache.alerts = cache.alerts.map(a => a.id === openKmAlert.id ? { ...openKmAlert } : a);
              setDoc(doc(db, 'alerts', openKmAlert.id), openKmAlert).catch(console.error);

              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: cycleEventId,
                equipmentName: `${v.model} (${v.licensePlate || 'Veículo'})`,
                equipmentId: v.id,
                customTitle: title,
                description: `O veículo ${v.model} atingiu ${curKm.toLocaleString('pt-BR')} km e está com troca de óleo vencida (programada para ${nextKm.toLocaleString('pt-BR')} km).`
              }).catch(() => {});

            } else if (openKmAlert.description !== desc) {
              const updated = cleanUndefined({
                ...openKmAlert,
                description: desc
              }) as SmartAlert;
              cache.alerts = cache.alerts.map(a => a.id === openKmAlert.id ? updated : a);
              setDoc(doc(db, 'alerts', openKmAlert.id), updated).catch(console.error);
            }
          } else if (curKm >= (nextKm - warningAdvanceKm)) {
            // Warning: 🟡 Troca de óleo próxima
            const diffKm = nextKm - curKm;
            const title = `🟡 Troca de óleo próxima: ${v.model} (${v.licensePlate || 'Placa'})`;
            const desc = `Veículo: ${v.model} (${v.licensePlate}). Próxima troca: ${nextKm.toLocaleString('pt-BR')} km. Odômetro atual: ${curKm.toLocaleString('pt-BR')} km. Faltam: ${diffKm.toLocaleString('pt-BR')} km (Intervalo: ${intervalKm.toLocaleString('pt-BR')} km).`;

            if (!openKmAlert || openKmAlert.cycleTargetKm !== nextKm || openKmAlert.severity !== 'MEDIA') {
              const alertObj: SmartAlert = cleanUndefined({
                id: kmAlertId,
                type: 'OIL_CHANGE_DUE',
                severity: 'MEDIA',
                title,
                description: desc,
                equipmentId: v.id,
                equipmentName: v.model,
                date: new Date().toISOString().slice(0, 10),
                resolved: false,
                cycleTargetKm: nextKm,
                lastOilChangeKm: lastKm,
                cycleId,
                pushNotified: true,
                pushNotifiedForCycle: nextKm,
                pushNotifiedAt: new Date().toISOString()
              });
              cache.alerts = [alertObj, ...cache.alerts.filter(a => a.id !== kmAlertId && !(a.equipmentId === v.id && a.type === 'OIL_CHANGE_DUE' && !a.resolved))];
              setDoc(doc(db, 'alerts', kmAlertId), alertObj).catch(console.error);

              // Disparo de Web Push para aviso de troca de óleo próxima em km
              const warningEventId = `oil-warning-${v.id}-${nextKm}`;
              dispatchPushNotificationEvent({
                eventType: 'OIL_CHANGE_DUE',
                eventId: warningEventId,
                equipmentName: `${v.model} (${v.licensePlate || 'Veículo'})`,
                equipmentId: v.id,
                customTitle: title,
                description: `O veículo ${v.model} está próximo da troca de óleo (${curKm.toLocaleString('pt-BR')} km / ${nextKm.toLocaleString('pt-BR')} km). Faltam ${diffKm.toLocaleString('pt-BR')} km.`
              }).catch(() => {});
            } else if (openKmAlert.description !== desc) {
              const updated = cleanUndefined({
                ...openKmAlert,
                description: desc
              }) as SmartAlert;
              cache.alerts = cache.alerts.map(a => a.id === openKmAlert.id ? updated : a);
              setDoc(doc(db, 'alerts', openKmAlert.id), updated).catch(console.error);
            }
          } else {
            // In day: resolve all open oil alerts for this vehicle
            const openAlerts = cache.alerts.filter(a => 
              (a.id === kmAlertId || a.equipmentId === v.id) && 
              (a.type === 'OIL_CHANGE_DUE' || a.id === kmAlertId || (a.title && (a.title.toLowerCase().includes('óleo') || a.title.toLowerCase().includes('oleo')))) &&
              !a.resolved
            );
            for (const openAlt of openAlerts) {
              const resolvedAlert: SmartAlert = cleanUndefined({
                ...openAlt,
                resolved: true,
                resolvedAt: new Date().toISOString(),
                resolvedBy: 'Sistema (Troca de Óleo em Dia)'
              });
              cache.alerts = cache.alerts.map(a => a.id === openAlt.id ? resolvedAlert : a);
              setDoc(doc(db, 'alerts', openAlt.id), resolvedAlert).catch(console.error);
            }
          }
        }
      }
    });

  } catch (err) {
    console.error('Error checking automated alerts:', err);
  }
}

// Settings Mutator
export async function updateSettings(newSettings: Partial<SystemSettings>): Promise<void> {
  const cleaned = cleanUndefined(newSettings);
  cache.settings = { ...cache.settings, ...cleaned };
  notifyDataUpdated();

  await setDoc(doc(db, 'settings', 'config'), cleaned, { merge: true });
  logAuditEvent('CONFIGURACAO', 'Sistema', 'Atualizou as configurações gerais do AndradeAgro.');
  checkAutomatedAlerts();
}

export async function updateTankCapacity(capacityLiters: number, currentStockLiters?: number): Promise<void> {
  const validCapacity = Math.max(1000, Number(capacityLiters) || 10000);
  const validStock = currentStockLiters !== undefined ? Math.max(0, Number(currentStockLiters)) : validCapacity;

  // Update primary tank (Quadra)
  await updateCentralTank('tank-quadra', {
    capacityLiters: validCapacity,
    currentStockLiters: validStock
  });
}

// Reset system data in Firestore
export async function resetSystemData(): Promise<void> {
  try {
    await seedCollection('users', INITIAL_USERS);
    await seedCollection('vehicles', INITIAL_VEHICLES);
    await seedCollection('central_tanks', INITIAL_CENTRAL_TANKS);
    await seedCollection('tank_movements', INITIAL_TANK_MOVEMENTS);
    await seedCollection('gas_stations', INITIAL_GAS_STATIONS);
    await seedCollection('fuel_logs', INITIAL_FUEL_LOGS);
    await seedCollection('fuel_refills', INITIAL_FUEL_REFILLS);
    await seedCollection('maintenance_logs', INITIAL_MAINTENANCE_LOGS);
    await seedCollection('machine_issues', INITIAL_MACHINE_ISSUES);
    await seedCollection('preventive_items', INITIAL_PREVENTIVE_ITEMS);
    await seedCollection('alerts', INITIAL_ALERTS);
    await seedCollection('audit_logs', INITIAL_AUDIT_LOGS);
    await setDoc(doc(db, 'settings', 'config'), cleanUndefined(INITIAL_SETTINGS));
    notifyDataUpdated();
  } catch (err) {
    console.error('Error resetting system data in Firestore:', err);
  }
}
