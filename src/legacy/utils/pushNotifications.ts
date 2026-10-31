import { User, UserRole, PushNotificationPayload } from '../types';
import { db, ensureFirebaseAuth, firebaseDisabled } from '../lib/firebase';
import { doc, setDoc as firestoreSetDoc, updateDoc as firestoreUpdateDoc, collection, getDocs as firestoreGetDocs } from 'firebase/firestore';

const setDoc = (...args: any[]): Promise<void> => firebaseDisabled ? Promise.resolve() : (firestoreSetDoc as any)(...args);
const updateDoc = (...args: any[]): Promise<void> => firebaseDisabled ? Promise.resolve() : (firestoreUpdateDoc as any)(...args);
const getDocs = (...args: any[]): Promise<any> => firebaseDisabled
  ? Promise.resolve({ docs: [], empty: true, size: 0, forEach: () => {} })
  : (firestoreGetDocs as any)(...args);

/**
 * Chave pública VAPID oficial do sistema AndradeAgro (RFC 8292).
 * Sincronizada com o par de chaves VAPID do backend.
 * Chave pública padrão para validação e assinatura Web Push no navegador do dispositivo.
 */
export const OFFICIAL_VAPID_PUBLIC_KEY = 'BGidTH8JXdHgg5XYTG-Z3iAJhCOVguQQf0B5iL-GMHJVXdnj_1JLv1bvtCG0GOCSBU-LqYL9dpUcCZaj_nV3H4s';

/**
 * Interface para respostas seguras de API com diagnóstico técnico completo.
 */
export interface SafeApiResponse<T = any> {
  ok: boolean;
  status: number;
  statusText?: string;
  contentType?: string;
  data?: T;
  rawText?: string;
  error?: string;
  url: string;
  method: string;
}

/**
 * Obtém a URL personalizada de backend configurada pelo usuário (ex: https://andrade-agro.vercel.app).
 */
export function getCustomApiUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('andradeagro_custom_api_url');
      if (stored && typeof stored === 'string' && stored.trim().length > 0) {
        return stored.trim().replace(/\/+$/, '');
      }
    }
  } catch {}
  return '';
}

/**
 * Define ou remove a URL personalizada de backend.
 */
export function setCustomApiUrl(url: string): void {
  try {
    if (typeof window !== 'undefined') {
      if (url && url.trim().length > 0) {
        localStorage.setItem('andradeagro_custom_api_url', url.trim().replace(/\/+$/, ''));
      } else {
        localStorage.removeItem('andradeagro_custom_api_url');
      }
      window.dispatchEvent(new CustomEvent('andradeagro_push_status_changed'));
    }
  } catch {}
}

/**
 * Resolve a URL final para requisições de API.
 * Suporta configuração local do usuário ou a variável de ambiente VITE_API_URL.
 */
export function resolveApiUrl(path: string): string {
  try {
    const customStored = getCustomApiUrl();
    const envBase = (import.meta as any).env?.VITE_API_URL;
    const base = customStored || (typeof envBase === 'string' && envBase.trim().length > 0 ? envBase.trim() : '');
    if (base && base.length > 0) {
      const cleanBase = base.replace(/\/+$/, '');
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${cleanBase}${cleanPath}`;
    }
  } catch {}
  return path;
}

/**
 * Cliente HTTP seguro que NUNCA assume cegamente que a resposta é JSON.
 * - Valida status HTTP;
 * - Verifica cabeçalho Content-Type;
 * - Se for JSON, interpreta com tratamento de erro;
 * - Se for HTML ou texto puro (ex: página de erro 404 do Vercel "The page could not be found" ou SPA fallback),
 *   captura o conteúdo como texto e gera um erro técnico detalhado para diagnóstico sem quebrar a aplicação.
 */
export async function safeApiFetch<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<SafeApiResponse<T>> {
  const url = resolveApiUrl(endpoint);
  const method = options?.method || 'GET';

  if (firebaseDisabled) {
    return { ok: false, status: 0, error: 'Conexões externas estão desativadas no modo de teste.', url, method };
  }

  console.log(`[AndradeAgro API] Requisição: ${method} ${url}`);

  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeoutTimer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {})
      }
    });
    clearTimeout(timeoutTimer);

    const status = res.status;
    const statusText = res.statusText;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    console.log(`[AndradeAgro API] Resposta: ${method} ${url} -> Status: ${status} (${statusText}), Content-Type: ${contentType}`);

    // Caso a resposta possua Content-Type application/json
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        if (res.ok) {
          return { ok: true, status, statusText, contentType, data, url, method };
        } else {
          const rawErr = data?.error || data?.message;
          let errMsg: string;
          if (typeof rawErr === 'string' && rawErr.trim().length > 0) {
            errMsg = rawErr;
          } else if (rawErr && typeof rawErr === 'object') {
            errMsg = typeof rawErr.message === 'string' ? rawErr.message : JSON.stringify(rawErr);
          } else {
            errMsg = `Erro do servidor (Status ${status}: ${statusText || 'Falha na requisição'})`;
          }
          return { ok: false, status, statusText, contentType, data, error: errMsg, url, method };
        }
      } catch (jsonErr: any) {
        const rawText = await res.text().catch(() => '');
        return {
          ok: false,
          status,
          statusText,
          contentType,
          rawText,
          error: `Resposta com cabeçalho JSON mas conteúdo malformatado: ${rawText.slice(0, 120)}`,
          url,
          method
        };
      }
    }

    // Caso a resposta NÃO seja JSON (ex: HTML de erro 404 da hospedagem, SPA fallback ou texto)
    const rawText = await res.text().catch(() => '');
    const cleanSnippet = rawText.trim().replace(/\s+/g, ' ').slice(0, 200);

    let diagnosticMsg: string;
    if (rawText.includes('The page could not be found') || rawText.includes('404: NOT_FOUND')) {
      diagnosticMsg = `Endpoint não encontrado no provedor de hospedagem (Status ${status}): A URL "${url}" retornou a página 404 HTML da infraestrutura.`;
    } else if (rawText.includes('<!DOCTYPE html>') || rawText.includes('<html')) {
      diagnosticMsg = `O servidor respondeu com uma página HTML em vez de JSON (Status ${status} em ${url}). O endpoint pode não estar implantado ou ter sido interceptado pelo SPA.`;
    } else {
      diagnosticMsg = `Resposta não-JSON recebida (Status ${status}, Content-Type: ${contentType || 'não informado'}): ${cleanSnippet || '(vazio)'}`;
    }

    console.warn(`[AndradeAgro API] Conteúdo recebido não é JSON em ${url}:`, { status, contentType, rawSnippet: cleanSnippet });

    return {
      ok: false,
      status,
      statusText,
      contentType,
      rawText,
      error: diagnosticMsg,
      url,
      method
    };
  } catch (netErr: any) {
    clearTimeout(timeoutTimer);
    const isTimeout = netErr?.name === 'AbortError';
    const errorDetail = isTimeout
      ? `Tempo limite excedido (${timeoutMs / 1000}s) ao aguardar resposta de ${url}. O servidor demorou para responder.`
      : `Falha de conexão com o servidor (${url}): ${netErr?.message || 'Sem resposta do servidor'}`;
    console.error(`[AndradeAgro API] ${isTimeout ? 'Timeout' : 'Falha de rede'} em ${method} ${url}:`, errorDetail);
    return {
      ok: false,
      status: isTimeout ? 408 : 0,
      error: errorDetail,
      url,
      method
    };
  }
}

/**
 * Obtém a chave pública VAPID de forma resiliente:
 * 1. Consulta o endpoint /api/notifications/vapid-public-key do servidor via safeApiFetch;
 * 2. Se houver falha de rede/CORS temporária, verifica import.meta.env.VITE_VAPID_PUBLIC_KEY;
 * 3. Utiliza a chave pública oficial estática pareada com o backend AndradeAgro.
 */
export async function getVapidPublicKey(): Promise<string> {
  // 1. Tentar obter do servidor
  try {
    const result = await safeApiFetch<{ publicKey?: string }>('/api/notifications/vapid-public-key', {
      cache: 'no-store'
    });
    if (result.ok && result.data && result.data.publicKey && typeof result.data.publicKey === 'string' && result.data.publicKey.trim().length > 10) {
      return result.data.publicKey.trim();
    }
  } catch (err: any) {
    console.warn('[Push Notification] Não foi possível contatar o endpoint VAPID diretamente:', err?.message || err);
  }

  // 2. Verificar variável de ambiente do Vite se presente
  try {
    const envKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 10) {
      return envKey.trim();
    }
  } catch {}

  // 3. Chave pública oficial do sistema AndradeAgro
  if (OFFICIAL_VAPID_PUBLIC_KEY) {
    return OFFICIAL_VAPID_PUBLIC_KEY;
  }

  throw new Error('Falha ao obter chave pública de notificação do servidor.');
}

/**
 * Utility to convert base64 VAPID public key into Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Ensures a push subscription has valid endpoint and base64-encoded p256dh/auth keys
 */
function normalizeSubscription(sub: any): any {
  if (!sub) return null;
  try {
    let subJson: any = {};
    if (typeof sub.toJSON === 'function') {
      subJson = sub.toJSON() || {};
    } else {
      subJson = { ...sub };
    }

    if (!subJson.endpoint && sub.endpoint) {
      subJson.endpoint = sub.endpoint;
    }
    if (!subJson.keys) {
      subJson.keys = {};
    }

    if (!subJson.keys.p256dh && typeof sub.getKey === 'function') {
      try {
        const p256dhBuffer = sub.getKey('p256dh');
        if (p256dhBuffer) {
          const bytes = new Uint8Array(p256dhBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          subJson.keys.p256dh = btoa(binary);
        }
      } catch (e) {
        console.warn('[Push Notification] Aviso ao extrair p256dh:', e);
      }
    }

    if (!subJson.keys.auth && typeof sub.getKey === 'function') {
      try {
        const authBuffer = sub.getKey('auth');
        if (authBuffer) {
          const bytes = new Uint8Array(authBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          subJson.keys.auth = btoa(binary);
        }
      } catch (e) {
        console.warn('[Push Notification] Aviso ao extrair auth:', e);
      }
    }

    return subJson;
  } catch (err) {
    console.warn('[Push Notification] Erro ao normalizar inscrição push:', err);
    return {
      endpoint: sub?.endpoint || '',
      keys: sub?.keys || {}
    };
  }
}

/**
 * Retrieves existing push subscription, validating key match with server VAPID key.
 * If server key changed or subscription expired, safely renews it.
 */
async function getOrRenewSubscription(
  reg: ServiceWorkerRegistration, 
  serverPublicKey: string
): Promise<PushSubscription> {
  const targetKeyBytes = urlBase64ToUint8Array(serverPublicKey);
  let sub = await reg.pushManager.getSubscription();

  if (sub) {
    let keyMismatch = false;
    try {
      const rawKey = sub.options.applicationServerKey;
      if (rawKey) {
        const subKeyBytes = new Uint8Array(rawKey);
        if (subKeyBytes.length !== targetKeyBytes.length || !subKeyBytes.every((b, i) => b === targetKeyBytes[i])) {
          keyMismatch = true;
        }
      } else {
        keyMismatch = true;
      }
    } catch {
      keyMismatch = true;
    }

    if (keyMismatch) {
      console.log('[Push Notification] Chave VAPID atualizada no servidor. Renovando inscrição no PushManager...');
      const oldEndpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      sub = null;
      if (oldEndpoint) {
        safeApiFetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: oldEndpoint })
        }).catch(() => {});
      }
    }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array(targetKeyBytes)
    });
  }

  return sub;
}

/**
 * Generate a deterministic, collision-resistant device ID based on the push subscription endpoint.
 * This guarantees idempotency: the same browser/endpoint always maps to the EXACT same Firestore document,
 * completely eliminating device duplication across page loads, logins, and tab restarts.
 */
export function getStableDeviceId(endpoint: string): string {
  if (!endpoint || typeof endpoint !== 'string') {
    return 'dev-unknown';
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < endpoint.length; i++) {
    h ^= endpoint.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hexHash = (h >>> 0).toString(16).padStart(8, '0');
  const cleanSuffix = endpoint.replace(/[^a-zA-Z0-9]/g, '').slice(-16);
  return `dev_${hexHash}_${cleanSuffix || 'sub'}`;
}

/**
 * Detect client platform and device characteristics
 */
function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return { userAgent: '', platform: '', isPWA: false, isMobile: false };
  }

  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true;

  let platform = 'Desktop';
  if (/Android/i.test(ua)) platform = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
  else if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/Mac/i.test(ua)) platform = 'macOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  return {
    userAgent: ua,
    platform,
    isPWA,
    isMobile
  };
}

/**
 * Check if the current browser environment supports Push Notifications & Service Worker
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current browser notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Check if notifications are currently marked active for this user on this browser
 */
export function isStoredPushActive(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`andradeagro_push_active_${userId}`) === 'true';
}

/**
 * Check if the user previously dismissed the push notification opt-in invitation
 */
export function isPushPromptDismissed(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`andradeagro_push_prompt_dismissed_${userId}`) === 'true';
}

/**
 * Record that user dismissed the push notification opt-in prompt
 */
export function dismissPushPrompt(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`andradeagro_push_prompt_dismissed_${userId}`, 'true');
  window.dispatchEvent(new CustomEvent('andradeagro_push_status_changed'));
}

/**
 * Reset push notification opt-in prompt dismissal so user can be prompted again
 */
export function resetPushPromptDismissal(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`andradeagro_push_prompt_dismissed_${userId}`);
  window.dispatchEvent(new CustomEvent('andradeagro_push_status_changed'));
}

/**
 * Check if current user is eligible to see the push notification opt-in prompt:
 * - Must be logged in as ADMIN or MANUTENCAO (never FUNCIONARIO)
 * - Browser must support Web Push
 * - Permission must not be explicitly blocked ('denied')
 * - Push must not already be active for this user
 * - User must not have previously dismissed the invitation
 */
export function shouldShowPushOptInPrompt(currentUser?: User | null): boolean {
  if (!currentUser) return false;
  if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANUTENCAO') return false;
  if (!isPushSupported()) return false;
  if (Notification.permission === 'denied') return false;
  if (isStoredPushActive(currentUser.id)) return false;
  if (isPushPromptDismissed(currentUser.id)) return false;
  return true;
}

/**
 * Check if a real PushSubscription is currently active in the service worker
 */
export async function isSubscriptionActive(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Request permission and subscribe current device to push notifications
 */
export async function enablePushNotifications(currentUser: User): Promise<{
  success: boolean;
  message: string;
  status: 'granted' | 'denied' | 'unsupported' | 'error';
}> {
  if (!isPushSupported()) {
    return {
      success: false,
      message: 'Notificações push não são suportadas neste navegador ou dispositivo. No iOS, adicione o sistema à Tela de Início (PWA) no Safari 16.4+.',
      status: 'unsupported'
    };
  }

  try {
    // 1. Request notification permission only on deliberate user action
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied') {
      return {
        success: false,
        message: 'As notificações foram bloqueadas no navegador. Para ativar, permita as notificações nas configurações do seu navegador.',
        status: 'denied'
      };
    }

    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Permissão de notificações não concedida.',
        status: 'denied'
      };
    }

    // 2. Ensure Service Worker is registered & ready
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    // 3. Fetch server's VAPID public key with fallback resilience
    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      throw new Error('Chave VAPID pública não disponível.');
    }

    // 4. Subscribe or renew subscription with server VAPID key
    const sub = await getOrRenewSubscription(reg, publicKey);
    const subJson = normalizeSubscription(sub);
    const deviceInfo = getDeviceInfo();
    const cleanEndpoint = sub.endpoint || '';
    const deviceId = getStableDeviceId(cleanEndpoint);

    const deviceRecord = {
      id: deviceId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      endpoint: cleanEndpoint,
      token: cleanEndpoint,
      subscription: subJson,
      deviceInfo,
      active: true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // 5. Save device record to Firestore user_devices collection with authenticated session
    try {
      await ensureFirebaseAuth();
      await setDoc(doc(db, 'user_devices', deviceId), deviceRecord, { merge: true });
      console.log('[Push Notification] Device registered idempotently in Firestore user_devices:', deviceId);
    } catch (fsErr) {
      console.warn('[Push Notification] Notice: Could not write device to Firestore directly:', fsErr);
    }

    // 6. Register device on backend server
    const serverRes = await safeApiFetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        subscription: subJson,
        deviceInfo
      })
    });

    if (!serverRes.ok) {
      console.warn('[Push Notification] Backend subscription returned notice:', serverRes.error);
    }

    // 7. Store local state
    localStorage.setItem(`andradeagro_push_active_${currentUser.id}`, 'true');
    window.dispatchEvent(new CustomEvent('andradeagro_push_status_changed'));

    return {
      success: true,
      message: 'Notificações push ativadas com sucesso! Você receberá alertas em tempo real de novos problemas e manutenções.',
      status: 'granted'
    };
  } catch (err: any) {
    console.error('[Push Notification] Error enabling push notifications:', err);
    return {
      success: false,
      message: `Erro ao ativar notificações: ${err?.message || 'Falha desconhecida.'}`,
      status: 'error'
    };
  }
}

/**
 * Unsubscribe current device from push notifications
 */
export async function disablePushNotifications(currentUser?: User): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (isPushSupported()) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();

          // Inform backend
          await safeApiFetch('/api/notifications/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint,
              userId: currentUser?.id
            })
          });

          // Inform Firestore
          const stableId = getStableDeviceId(endpoint);
          try {
            await ensureFirebaseAuth();
            await setDoc(doc(db, 'user_devices', stableId), {
              active: false,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch {
            // Non-blocking
          }
        }
      }
    }

    if (currentUser?.id) {
      localStorage.removeItem(`andradeagro_push_active_${currentUser.id}`);
    }
    window.dispatchEvent(new CustomEvent('andradeagro_push_status_changed'));

    return {
      success: true,
      message: 'Notificações push desativadas neste dispositivo.'
    };
  } catch (err: any) {
    console.error('[Push Notification] Error disabling notifications:', err);
    return {
      success: false,
      message: `Erro ao desativar notificações: ${err?.message || 'Falha desconhecida.'}`
    };
  }
}

/**
 * Send a real test push notification to this device
 */
export async function sendTestPushNotification(currentUser: User): Promise<{
  success: boolean;
  message: string;
  sentCount?: number;
  failedCount?: number;
  recipientsCount?: number;
  errors?: string[];
}> {
  if (!currentUser || !currentUser.id) {
    return {
      success: false,
      message: 'Usuário não autenticado no momento do teste.'
    };
  }

  try {
    // 1. Inspecionar inscrição local ativa no ServiceWorker deste dispositivo de forma segura e não-bloqueante
    let currentSubscription: any = null;
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        // Obter registro sem bloquear indefinidamente
        const reg = await Promise.race([
          navigator.serviceWorker.getRegistration(),
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1200))
        ]);

        if (reg?.pushManager) {
          const sub = await Promise.race([
            reg.pushManager.getSubscription(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200))
          ]);
          if (sub) {
            currentSubscription = normalizeSubscription(sub);
          }
        }
      }
    } catch (subErr) {
      console.warn('[Push Notification] Aviso ao inspecionar inscrição local antes do teste:', subErr);
    }

    // Se permissão já estiver concedida mas a inscrição ainda não existir no navegador, inscreve agora
    if (!currentSubscription && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        console.log('[Push Notification] Permissão concedida. Auto-inscrevendo dispositivo antes de enviar o teste...');
        const enrollRes = await enablePushNotifications(currentUser);
        if (enrollRes?.success && 'serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager?.getSubscription();
          if (sub) {
            currentSubscription = normalizeSubscription(sub);
          }
        }
      } catch (autoErr) {
        console.warn('[Push Notification] Aviso na auto-inscrição antes do teste:', autoErr);
      }
    }

    // 2. Executar requisição segura à API
    const result = await safeApiFetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: currentUser.id,
        userName: currentUser.name || 'Usuário',
        userRole: currentUser.role || 'ADMIN',
        title: 'Teste AndradeAgro',
        description: 'Notificações Push funcionando.',
        subscription: currentSubscription
      })
    });

    if (!result.ok || !result.data) {
      const safeErrorMsg = typeof result.error === 'string' && result.error.trim().length > 0
        ? result.error
        : `Erro de conexão ao testar notificação (Status ${result.status}).`;
      return {
        success: false,
        sentCount: 0,
        message: safeErrorMsg
      };
    }

    const data = result.data || {};
    const count = Number(data.sentCount !== undefined ? data.sentCount : data.sent) || 0;
    const recipients = Number(data.recipientsCount || data.totalDevices) || count;
    const failed = Number(data.failedCount !== undefined ? data.failedCount : data.failed) || (recipients > count ? recipients - count : 0);

    // CRITICAL: Nunca mostrar sucesso se nenhum envio real ocorreu (count === 0)
    if ((data.ok || data.success) && count > 0) {
      const summaryMsg = failed === 0
        ? `Notificação de teste entregue com sucesso para todos os ${count} dispositivo(s) válido(s) registrado(s)!`
        : `Notificação entregue com sucesso para ${count} de ${recipients} dispositivo(s) encontrado(s) (${failed} falha(s)).`;

      return {
        success: true,
        sentCount: count,
        failedCount: failed,
        recipientsCount: recipients,
        message: summaryMsg
      };
    } else {
      let errDetails = '';
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const errorList = data.errors.map((e: any) =>
          typeof e === 'string' ? e : typeof e?.message === 'string' ? e.message : JSON.stringify(e)
        );
        errDetails = `\nDetalhes: ${errorList.join('; ')}`;
      }

      const defaultFailMsg = recipients === 0
        ? 'Nenhum dispositivo com permissão concedida e registro Push ativo foi encontrado.'
        : `Tentativa de envio realizada para ${recipients} dispositivo(s), porém nenhum recebeu com sucesso (${failed || recipients} falha(s)).`;

      const rawMsg = data.message || defaultFailMsg;
      const safeMsg = typeof rawMsg === 'string'
        ? rawMsg
        : typeof rawMsg?.message === 'string'
          ? rawMsg.message
          : JSON.stringify(rawMsg);

      return {
        success: false,
        sentCount: 0,
        failedCount: failed || recipients,
        recipientsCount: recipients,
        errors: Array.isArray(data.errors) ? data.errors : undefined,
        message: safeMsg + errDetails
      };
    }
  } catch (err: any) {
    const errMsg = typeof err?.message === 'string' ? err.message : String(err || 'Falha no servidor');
    return {
      success: false,
      message: `Erro de conexão ao testar notificação: ${errMsg}`
    };
  }
}

// In-memory client deduplication set to avoid duplicate network dispatches
const clientDispatchedEventIds = new Set<string>();

/**
 * Clear client-side and server-side deduplication for a specific equipment or cycle prefix
 * Call this when a maintenance/oil change is resolved to ensure the next cycle can trigger cleanly!
 */
export async function clearPushEventDeduplication(prefix?: string): Promise<void> {
  if (!prefix) {
    clientDispatchedEventIds.clear();
  } else {
    for (const key of Array.from(clientDispatchedEventIds)) {
      if (key.startsWith(prefix)) {
        clientDispatchedEventIds.delete(key);
      }
    }
  }

  try {
    await safeApiFetch('/api/notifications/reset-event-dedup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix })
    });
  } catch {
    // Non-blocking network catch
  }
}

/**
 * Offline queue management for push events during network instability
 */
const PENDING_QUEUE_KEY = 'andradeagro_pending_push_queue';

function getPendingPushQueue(): PushNotificationPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingPushQueue(queue: PushNotificationPayload[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
  } catch {
    // Ignore storage quota errors
  }
}

function queuePendingPushEvent(payload: PushNotificationPayload): void {
  const queue = getPendingPushQueue();
  if (!queue.some(p => p.eventId === payload.eventId)) {
    queue.push(payload);
    savePendingPushQueue(queue);
    console.log(`[Push Notification Queue] Queued event for offline retry: ${payload.eventId}`);
  }
}

/**
 * Flush pending push events when internet connection is restored
 */
export async function flushPendingPushEvents(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const queue = getPendingPushQueue();
  if (queue.length === 0) return;

  console.log(`[Push Notification Queue] Flusing ${queue.length} pending push events...`);
  const remaining: PushNotificationPayload[] = [];

  for (const item of queue) {
    try {
      const result = await safeApiFetch('/api/notifications/dispatch-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: item.eventType,
          eventId: item.eventId,
          equipmentName: item.equipmentName,
          description: item.description,
          equipmentId: item.equipmentId,
          customTitle: item.customTitle
        })
      });
      if (!result.ok) {
        remaining.push(item);
      } else {
        clientDispatchedEventIds.add(item.eventId);
        console.log(`[Push Notification Queue] Successfully flushed event: ${item.eventId}`);
      }
    } catch {
      remaining.push(item);
    }
  }

  savePendingPushQueue(remaining);
}

// Automatically bind online listener once on client
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Connection restored. Flushing pending push events...');
    flushPendingPushEvents();
  });

  // 3B. Recebimento de Web Push com aplicativo aberto em primeiro plano (foreground)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'ANDRADEAGRO_PUSH_EVENT') {
        console.log('[Push Notification] Foreground Web Push recebido no app aberto:', event.data);
        window.dispatchEvent(new CustomEvent('andradeagro_push_received', { detail: event.data }));
        window.dispatchEvent(new CustomEvent('andradeagro_data_updated'));
      }
    });
  }
}

/**
 * Dispatch an event to push notification subscribers (Problems, Maintenances, Oil Changes, Low Tank, Suspicious Consumption)
 * Protected with deduplication at both client and server layers.
 * Queued automatically if offline or connection drops.
 */
export async function dispatchPushNotificationEvent(payload: PushNotificationPayload): Promise<{
  success: boolean;
  duplicate?: boolean;
  sentCount?: number;
  recipientsCount?: number;
  message?: string;
}> {
  // Authorized system events: issues, maintenance, oil changes, tank level, suspicious fuel, and general alerts
  const allowedEvents = [
    'NEW_ISSUE',
    'NEW_MAINTENANCE',
    'OIL_CHANGE_DUE',
    'LOW_TANK_LEVEL',
    'SUSPICIOUS_FUEL',
    'PREVENTIVE_MAINTENANCE',
    'MAINTENANCE_DUE',
    'MACHINE_ISSUE',
    'TEST'
  ];
  if (!allowedEvents.includes(payload.eventType as string)) {
    return { success: false, message: 'Tipo de evento não suportado.' };
  }

  // Client-side session deduplication
  if (clientDispatchedEventIds.has(payload.eventId)) {
    return { success: true, duplicate: true, sentCount: 0, recipientsCount: 0, message: 'Evento já despachado nesta sessão.' };
  }

  // If offline, queue event immediately for retry on reconnect
  if (typeof window !== 'undefined' && !navigator.onLine) {
    queuePendingPushEvent(payload);
    return { success: true, duplicate: false, sentCount: 0, recipientsCount: 0, message: 'Sem conexão. Evento enfileirado para envio automático assim que a rede retornar.' };
  }

  try {
    const result = await safeApiFetch('/api/notifications/dispatch-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: payload.eventType,
        eventId: payload.eventId,
        equipmentName: payload.equipmentName,
        description: payload.description,
        equipmentId: payload.equipmentId,
        customTitle: payload.customTitle,
        photoUrl: payload.photoUrl || payload.image,
        image: payload.image || payload.photoUrl,
        issueId: payload.issueId,
        reportedByUserId: payload.reportedByUserId,
        reportedByUserName: payload.reportedByUserName,
        url: payload.url
      })
    });

    if (!result.ok || !result.data) {
      queuePendingPushEvent(payload);
      return { success: false, message: result.error || `Falha na requisição: ${result.status}` };
    }

    clientDispatchedEventIds.add(payload.eventId);
    return result.data;
  } catch (err: any) {
    // Queue for retry
    queuePendingPushEvent(payload);
    console.warn('[Push Notification] Error triggering push notification event, queued for retry:', err?.message || err);
    return { success: false, message: 'Oscilação de rede. Evento enfileirado com segurança para envio posterior.' };
  }
}

/**
 * Automatically synchronize and restore push registration for any user with granted permission
 * Prevents token loss on reload, browser restart, or re-login.
 */
export async function autoSyncPushDevice(currentUser?: User | null): Promise<void> {
  if (!currentUser) return;
  // Security & Role check: ONLY ADMIN and MANUTENCAO should receive management push notifications
  if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANUTENCAO') return;
  if (!isPushSupported()) return;

  const perm = getNotificationPermission();
  const wasStoredActive = isStoredPushActive(currentUser.id);

  // CRITICAL: Only synchronize if the user deliberately activated notifications in Andrade Agro
  // AND browser permission is actively granted. Never auto-enroll without prior explicit user consent!
  if (perm === 'granted' && wasStoredActive) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const publicKey = await getVapidPublicKey().catch(() => null);
      if (!publicKey) return;

      const sub = await getOrRenewSubscription(reg, publicKey);
      if (sub) {
        const subJson = normalizeSubscription(sub);
        const deviceInfo = getDeviceInfo();
        const cleanEndpoint = sub.endpoint || '';
        const deviceId = getStableDeviceId(cleanEndpoint);

        // Sync with backend server
        await safeApiFetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            subscription: subJson,
            deviceInfo
          })
        });

        // Sync with Firestore user_devices idempotently with authenticated session
        try {
          await ensureFirebaseAuth();
          await setDoc(doc(db, 'user_devices', deviceId), {
            id: deviceId,
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            endpoint: cleanEndpoint,
            token: cleanEndpoint,
            subscription: subJson,
            deviceInfo,
            active: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch {
          // Firestore non-blocking
        }

        localStorage.setItem(`andradeagro_push_active_${currentUser.id}`, 'true');
        console.log(`[Push Notification] Device verified and synchronized idempotently for ${currentUser.name} (${currentUser.role}).`);
      }
    } catch (syncErr) {
      console.warn('[Push Notification] Non-blocking auto-sync notice:', syncErr);
    }
  }

  // Also check if there are pending events to flush
  flushPendingPushEvents().catch(() => {});
}

/**
 * Fetch server-side notification status and active device diagnostics
 */
export async function fetchServerNotificationStatus(): Promise<{
  success?: boolean;
  querySuccess?: boolean;
  queryError?: string;
  error?: string;
  vapidConfigured: boolean;
  vapidPublicKey?: string;
  totalDevices: number;
  activeAuthorizedCount: number;
  authorizedDevices: Array<{
    userName: string;
    userRole: string;
    platform: string;
    updatedAt: string;
  }>;
  source?: string;
  notice?: string;
} | null> {
  let backendError: string | null = null;

  try {
    const result = await safeApiFetch('/api/notifications/status');
    if (result.ok && result.data && (result.data.ok === true || result.data.success === true || result.data.querySuccess !== false || (result.data.activeAuthorizedCount || 0) > 0)) {
      return {
        ...result.data,
        source: 'backend_api'
      };
    }
    backendError = result.error || (result.data?.error ? String(result.data.error) : `Status HTTP ${result.status}`);
  } catch (err: any) {
    backendError = err?.message || 'Falha de conexão com o servidor';
  }

  // Fallback Resiliente: se a API do backend estiver fria, lenta ou retornar aviso,
  // consulta diretamente a coleção 'user_devices' via Firestore SDK com deduplicação por endpoint físico
  try {
    await ensureFirebaseAuth();
    
    // Timeout de 4000ms para nunca travar o card em "consultando"
    const snapPromise = getDocs(collection(db, 'user_devices'));
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout de consulta do Firestore (4000ms)')), 4000)
    );
    const snap = await Promise.race([snapPromise, timeoutPromise]);

    const endpointDeviceMap = new Map<string, {
      userName: string;
      userRole: string;
      platform: string;
      updatedAt: string;
      active: boolean;
      timestamp: number;
    }>();

    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      const endpoint = data?.endpoint || data?.subscription?.endpoint;
      if (endpoint && data.subscription) {
        const docUpdatedAt = data.updatedAt || '';
        const docTimestamp = docUpdatedAt ? new Date(docUpdatedAt).getTime() : 0;
        const existing = endpointDeviceMap.get(endpoint);
        // O documento mais recente para o mesmo endpoint físico sempre prevalece
        if (!existing || docTimestamp >= existing.timestamp) {
          endpointDeviceMap.set(endpoint, {
            userName: data.userName || 'Usuário',
            userRole: data.userRole || 'FUNCIONARIO',
            platform: data.deviceInfo?.platform || 'desconhecido',
            updatedAt: docUpdatedAt || new Date().toISOString(),
            active: data.active !== false,
            timestamp: docTimestamp
          });
        }
      }
    });

    const activeDevices = Array.from(endpointDeviceMap.values())
      .filter(d => d.active)
      .map(({ active, timestamp, ...rest }) => rest);

    const activeCount = activeDevices.length;
    const totalCount = endpointDeviceMap.size;
    const vapidKey = await getVapidPublicKey().catch(() => OFFICIAL_VAPID_PUBLIC_KEY);

    return {
      success: true,
      querySuccess: true,
      vapidConfigured: true,
      vapidPublicKey: vapidKey,
      totalDevices: totalCount,
      activeAuthorizedCount: activeCount,
      authorizedDevices: activeDevices,
      source: 'firestore_direct',
      notice: backendError ? `Dados lidos do Firestore (aviso backend: ${backendError})` : undefined
    };
  } catch (fsErr: any) {
    console.warn('[Push Notification] Fallback direto ao Firestore:', fsErr?.message || fsErr);
    return {
      success: false,
      querySuccess: false,
      error: backendError || fsErr?.message || 'Falha ao consultar dispositivos',
      vapidConfigured: false,
      totalDevices: 0,
      activeAuthorizedCount: 0,
      authorizedDevices: [],
      source: 'error'
    };
  }
}

/**
 * Logout cleanup: keeps push token valid on mobile device so alerts continue to arrive
 */
export async function cleanupPushOnLogout(currentUser: User): Promise<void> {
  // Device subscription is intentionally retained so mobile devices continue to receive critical fleet alerts
  console.log(`[Push Notification] User ${currentUser.name} logged out; push notification subscription preserved.`);
}

export interface PushDiagnosticsInfo {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerRegistered: boolean;
  serviceWorkerActive: boolean;
  pushManagerAvailable: boolean;
  hasLocalSubscription: boolean;
  localSubscriptionEndpoint?: string;
  localSubscriptionKeySnippet?: string;
  keyMismatchWithServer?: boolean;
  vapidPublicKeySnippet?: string;
  isPWA: boolean;
  isMobile: boolean;
  platform: string;
  userAgent: string;
  currentDomain: string;
  currentOrigin: string;
  targetApiUrl: string;
  customApiUrl: string;
  backendName: string;
}

/**
 * Coleta diagnóstico técnico abrangente do estado local de Push Notifications
 */
export async function getPushDiagnosticsInfo(): Promise<PushDiagnosticsInfo> {
  const supported = isPushSupported();
  const perm = getNotificationPermission();
  const dev = getDeviceInfo();

  let swReg = false;
  let swAct = false;
  let hasSub = false;
  let endpoint = '';
  let subKeySnippet = '';
  let keyMismatch = false;

  let vapidSnippet = '';
  let activePublicKey = OFFICIAL_VAPID_PUBLIC_KEY;
  try {
    const key = await getVapidPublicKey().catch(() => OFFICIAL_VAPID_PUBLIC_KEY);
    if (key && key.length > 16) {
      activePublicKey = key;
      vapidSnippet = `${key.slice(0, 8)}...${key.slice(-8)}`;
    }
  } catch {}

  if (supported && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swReg = true;
        swAct = Boolean(reg.active);
        const sub = await reg.pushManager.getSubscription();
        if (sub && sub.endpoint) {
          hasSub = true;
          endpoint = sub.endpoint;
          if (sub.options?.applicationServerKey) {
            try {
              const rawKey = sub.options.applicationServerKey;
              const subKeyBytes = new Uint8Array(rawKey);
              const targetKeyBytes = urlBase64ToUint8Array(activePublicKey);
              if (subKeyBytes.length !== targetKeyBytes.length || !subKeyBytes.every((b, i) => b === targetKeyBytes[i])) {
                keyMismatch = true;
              }
              // Base64 snippet
              let binary = '';
              for (let i = 0; i < Math.min(10, subKeyBytes.length); i++) {
                binary += String.fromCharCode(subKeyBytes[i]);
              }
              subKeySnippet = `${btoa(binary).slice(0, 8)}...`;
            } catch {
              keyMismatch = false;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Push Notification] Falha ao inspecionar SW:', e);
    }
  }

  const currentDomain = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const targetApiUrl = resolveApiUrl('/api/notifications/test');
  const customApi = getCustomApiUrl();
  const backendName = customApi 
    ? `Vercel / Personalizado (${customApi})` 
    : currentOrigin.includes('vercel.app') 
      ? 'Vercel (Produção)' 
      : 'Servidor Local (AI Studio / Dev)';

  return {
    supported,
    permission: perm,
    serviceWorkerRegistered: swReg,
    serviceWorkerActive: swAct,
    pushManagerAvailable: Boolean(typeof window !== 'undefined' && 'PushManager' in window),
    hasLocalSubscription: hasSub,
    localSubscriptionEndpoint: endpoint ? `${endpoint.slice(0, 40)}...` : undefined,
    localSubscriptionKeySnippet: subKeySnippet || undefined,
    keyMismatchWithServer: keyMismatch,
    vapidPublicKeySnippet: vapidSnippet,
    isPWA: dev.isPWA,
    isMobile: dev.isMobile,
    platform: dev.platform,
    userAgent: dev.userAgent,
    currentDomain,
    currentOrigin,
    targetApiUrl,
    customApiUrl: customApi,
    backendName
  };
}
