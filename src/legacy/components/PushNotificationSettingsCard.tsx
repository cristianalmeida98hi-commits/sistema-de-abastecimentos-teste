import React, { useState, useEffect } from 'react';
import { 
  Bell, BellOff, CheckCircle2, AlertTriangle, ShieldCheck, 
  Smartphone, Monitor, Send, RefreshCw, SmartphoneCharging, Info,
  ChevronDown, ChevronUp, Copy, Check, Terminal, HardDrive, CheckCircle
} from 'lucide-react';
import { User } from '../types';
import { 
  isPushSupported, getNotificationPermission, isStoredPushActive, 
  isSubscriptionActive, enablePushNotifications, disablePushNotifications, 
  sendTestPushNotification, fetchServerNotificationStatus,
  getPushDiagnosticsInfo, PushDiagnosticsInfo,
  getCustomApiUrl, setCustomApiUrl,
  isPushPromptDismissed, resetPushPromptDismissal
} from '../utils/pushNotifications';

interface PushNotificationSettingsCardProps {
  currentUser: User;
  darkMode?: boolean;
}

export const PushNotificationSettingsCard: React.FC<PushNotificationSettingsCardProps> = ({
  currentUser,
  darkMode = true
}) => {
  const [supported, setSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isActive, setIsActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{
    activeAuthorizedCount: number;
    authorizedDevices: Array<{ userName: string; userRole: string; platform: string; updatedAt: string }>;
    querySuccess?: boolean;
    error?: string;
    source?: string;
    notice?: string;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSource, setStatusSource] = useState<string>('servidor');
  const [diagnostics, setDiagnostics] = useState<PushDiagnosticsInfo | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [copiedDiag, setCopiedDiag] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [customBackendUrl, setCustomBackendUrl] = useState<string>(getCustomApiUrl());
  const [backendSavedFeedback, setBackendSavedFeedback] = useState<string | null>(null);

  const checkStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const isSup = isPushSupported();
      setSupported(isSup);
      if (!isSup) {
        setPermission('unsupported');
        setIsActive(false);
        setStatusLoading(false);
        return;
      }

      const perm = getNotificationPermission();
      setPermission(perm);

      // Coletar diagnóstico detalhado do navegador e hardware
      const diagInfo = await getPushDiagnosticsInfo().catch(() => null);
      if (diagInfo) {
        setDiagnostics(diagInfo);
      }

      const userId = currentUser?.id || '';
      const storedActive = userId ? isStoredPushActive(userId) : false;
      const subActive = await isSubscriptionActive().catch(() => false);
      setIsActive(Boolean(storedActive && subActive && perm === 'granted'));

      // Consulta de status do servidor com fallback automático e direto ao Firestore
      const sStatus = await fetchServerNotificationStatus().catch((err) => ({
        success: false,
        querySuccess: false,
        error: err?.message || 'Falha de comunicação com o servidor',
        totalDevices: 0,
        activeAuthorizedCount: 0,
        authorizedDevices: [],
        source: 'error',
        notice: undefined
      }));

      if (sStatus) {
        const activeCount = Number(sStatus.activeAuthorizedCount) || 0;
        const src = sStatus.source === 'firestore_direct' ? 'Firestore (Direto)' : 'API Vercel';
        setStatusSource(src);

        if (activeCount > 0 || sStatus.querySuccess === true) {
          setStatusError(null);
          setServerStatus({
            activeAuthorizedCount: activeCount,
            authorizedDevices: Array.isArray(sStatus.authorizedDevices) ? sStatus.authorizedDevices : [],
            querySuccess: true,
            source: src,
            notice: sStatus.notice
          });
        } else if (sStatus.error) {
          setStatusError(sStatus.error);
          setServerStatus({
            activeAuthorizedCount: 0,
            authorizedDevices: [],
            querySuccess: false,
            error: sStatus.error,
            source: src
          });
        } else {
          setServerStatus({
            activeAuthorizedCount: 0,
            authorizedDevices: [],
            querySuccess: true,
            source: src
          });
        }
      } else {
        setStatusError('Servidor não retornou dados de status');
      }
    } catch (err: any) {
      console.warn('[Push Notification Card] Aviso ao verificar status push:', err);
      setStatusError(err?.message || 'Erro ao consultar dispositivos');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleStatusChange = () => {
      checkStatus().catch(() => {});
    };

    window.addEventListener('andradeagro_push_status_changed', handleStatusChange);
    return () => {
      window.removeEventListener('andradeagro_push_status_changed', handleStatusChange);
    };
  }, [currentUser?.id]);

  const handleToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoading(true);
    setFeedback(null);

    try {
      if (isActive) {
        const res = await disablePushNotifications(currentUser);
        setIsActive(false);
        const safeText = typeof res?.message === 'string' ? res.message : 'Notificações push desativadas.';
        setFeedback({ type: 'info', text: safeText });
      } else {
        const res = await enablePushNotifications(currentUser);
        if (res?.success) {
          setIsActive(true);
          setPermission('granted');
          const safeText = typeof res?.message === 'string' ? res.message : 'Notificações push ativadas com sucesso!';
          setFeedback({ type: 'success', text: safeText });
        } else {
          const statusStr = String(res?.status || '');
          const permVal: NotificationPermission | 'unsupported' = 
            (statusStr === 'granted' || statusStr === 'denied' || statusStr === 'default')
              ? (statusStr as NotificationPermission)
              : 'denied';
          setPermission(permVal);
          const safeText = typeof res?.message === 'string' ? res.message : 'Não foi possível ativar as notificações.';
          setFeedback({ type: 'error', text: safeText });
        }
      }
    } catch (err: any) {
      console.error('[Push Notification Card] Erro ao alternar status push:', err);
      const errMsg = typeof err?.message === 'string' ? err.message : String(err || 'Erro inesperado');
      setFeedback({ type: 'error', text: `Falha na operação: ${errMsg}` });
    } finally {
      setLoading(false);
      try {
        await checkStatus();
      } catch {}
    }
  };

  const handleSync = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSyncing(true);
    setFeedback(null);

    try {
      const res = await enablePushNotifications(currentUser);
      if (res?.success) {
        setIsActive(true);
        setPermission('granted');
        setFeedback({ type: 'success', text: 'Dispositivo sincronizado com sucesso no Firestore!' });
      } else {
        const safeText = typeof res?.message === 'string' ? res.message : 'Falha ao sincronizar dispositivo.';
        setFeedback({ type: 'error', text: safeText });
      }
    } catch (err: any) {
      console.error('[Push Notification Card] Erro ao sincronizar:', err);
      const errMsg = typeof err?.message === 'string' ? err.message : String(err || 'Erro inesperado');
      setFeedback({ type: 'error', text: `Falha ao sincronizar: ${errMsg}` });
    } finally {
      setSyncing(false);
      try {
        await checkStatus();
      } catch {}
    }
  };

  const handleTest = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoading(true);
    setFeedback(null);

    try {
      const res = await sendTestPushNotification(currentUser);
      const safeText = typeof res?.message === 'string' && res.message.trim().length > 0
        ? res.message
        : res?.success
          ? 'Notificação de teste enviada com sucesso!'
          : 'Não foi possível enviar a notificação de teste.';

      if (res?.success) {
        setFeedback({ type: 'success', text: safeText });
      } else {
        setFeedback({ type: 'error', text: safeText });
      }
    } catch (err: any) {
      console.error('[Push Notification Card] Erro ao testar notificação:', err);
      const errMsg = typeof err?.message === 'string' ? err.message : String(err || 'Erro inesperado');
      setFeedback({ type: 'error', text: `Falha ao testar notificação: ${errMsg}` });
    } finally {
      setLoading(false);
      try {
        await checkStatus();
      } catch {}
    }
  };

  const copyDiagnosticReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      user: currentUser?.name,
      role: currentUser?.role,
      browserPermission: permission,
      isActiveOnDevice: isActive,
      supported: supported,
      diagnostics: diagnostics,
      serverStatus: serverStatus,
      statusError: statusError,
      statusSource: statusSource
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2500);
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div 
      id="push-notification-settings-card"
      className={`p-6 rounded-3xl border space-y-4 transition-all ${
        darkMode 
          ? 'bg-[#042d23] border-emerald-800/80 shadow-md text-emerald-100' 
          : 'bg-white border-emerald-100 shadow-sm text-gray-800'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between border-b pb-3 border-emerald-800/40">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isActive ? 'bg-amber-400 text-gray-950' : 'bg-emerald-900/60 text-emerald-300'}`}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Notificações Push em Tempo Real
            </h3>
            <p className="text-[11px] text-emerald-400/90 font-medium">
              Web Push & FCM (Android, iOS PWA e Desktop)
            </p>
          </div>
        </div>

        {/* Real Status Badge */}
        <div>
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Ativadas neste dispositivo
            </span>
          ) : permission === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              Bloqueadas no Navegador
            </span>
          ) : permission === 'granted' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Permissão Concedida (Pendente Registro)
            </span>
          ) : !supported ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Não Suportado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-700/40 text-slate-300 border border-slate-600/40">
              Inativas neste dispositivo
            </span>
          )}
        </div>
      </div>

      {/* Description & Details */}
      <p className="text-xs text-slate-300 leading-relaxed">
        Receba notificações sonoras e visuais diretamente no celular (<strong className="text-emerald-300">Android Chrome ou PWA instalado</strong>) mesmo com o aplicativo fechado ou em segundo plano.
      </p>

      {/* Granted Permission Alert for Pending Device */}
      {permission === 'granted' && !isActive && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Permissão já autorizada no seu navegador!</span>
            <p className="text-[11px] text-amber-200/90">
              O navegador já concedeu permissão e por isso não exibirá um novo pop-up. Basta clicar em <strong>"Sincronizar Dispositivo"</strong> abaixo para gerar o token e salvar seu aparelho no Firestore.
            </p>
          </div>
        </div>
      )}

      {/* Alerta de chave renovada */}
      {diagnostics?.keyMismatchWithServer && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2.5">
          <RefreshCw className="w-4 h-4 text-[#FACC15] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300">Atualização de Chaves VAPID Web Push</span>
            <p className="text-[11px] text-emerald-200/90">
              O sistema sincronizou com a nova chave pública oficial (<span className="font-mono text-emerald-300">{diagnostics.vapidPublicKeySnippet}</span>). Clique em <strong>"Sincronizar Dispositivo"</strong> para atualizar sua credencial local.
            </p>
          </div>
        </div>
      )}

      {/* Diagnostic status strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
        {/* Permissão do Navegador */}
        <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/30 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#FACC15] shrink-0" />
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase">Permissão Navegador</div>
            <div className="font-bold text-slate-100 capitalize flex items-center gap-1.5">
              {permission === 'granted' ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Concedida
                </span>
              ) : permission === 'denied' ? (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Bloqueada
                </span>
              ) : (
                <span className="text-amber-300">Não Solicitada</span>
              )}
            </div>
          </div>
        </div>

        {/* Dispositivos no Servidor / Firestore */}
        <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/30 flex items-center gap-2">
          <SmartphoneCharging className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-emerald-400 font-semibold uppercase flex items-center justify-between">
              <span>Dispositivos Ativos</span>
              {serverStatus?.source && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-800/40 text-emerald-300">
                  {serverStatus.source.includes('Firestore') ? 'Firestore' : 'API'}
                </span>
              )}
            </div>
            <div className="font-bold text-slate-100 truncate">
              {statusLoading ? (
                <span className="text-amber-300 flex items-center gap-1 text-[11px]">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Consultando...
                </span>
              ) : serverStatus && (serverStatus.activeAuthorizedCount > 0 || serverStatus.querySuccess) ? (
                <span className="text-emerald-300">
                  {serverStatus.activeAuthorizedCount} ativo(s)
                </span>
              ) : statusError ? (
                <span className="text-red-400 text-xs font-semibold">
                  Erro na consulta
                </span>
              ) : (
                <span className="text-slate-400 text-xs">0 ativo(s)</span>
              )}
            </div>
          </div>
        </div>

        {/* Destinatários Autorizados */}
        <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/30 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase">Destinatários</div>
            <div className="font-bold text-slate-100">Operador & Manutenção</div>
          </div>
        </div>
      </div>

      {/* Error explanation if present */}
      {statusError && !serverStatus?.activeAuthorizedCount && (
        <div className="p-3 rounded-xl bg-red-900/30 border border-red-700/50 text-xs text-red-200 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Aviso ao consultar dispositivos:</span>
              <p className="text-[11px] text-red-300/90 mt-0.5">{statusError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={checkStatus}
            className="px-2.5 py-1 rounded bg-red-800/50 hover:bg-red-700/60 text-red-200 text-[10px] font-bold shrink-0 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Notice if loaded via Firestore fallback */}
      {serverStatus?.notice && (
        <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/40 text-[11px] text-emerald-300/90 flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{serverStatus.notice}</span>
        </div>
      )}

      {/* Authorized Events Info */}
      <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-xs space-y-2">
        <p className="font-bold text-[11px] uppercase tracking-wider text-[#FACC15] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Eventos que enviam Notificação Push ao Celular:
        </p>
        <ul className="space-y-1.5 text-[11px] text-slate-200">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">⚠️</span>
            <span><strong>Novo problema relatado:</strong> Alerta imediato com máquina, descrição e operador.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">🔧</span>
            <span><strong>Nova manutenção registrada:</strong> Registro técnico de revisão ou reparo concluído.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-300 font-bold">🛢️</span>
            <span><strong>Alerta de troca de óleo:</strong> Notificação automática de troca de óleo vencida por horímetro ou quilometragem.</span>
          </li>
        </ul>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div 
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 whitespace-pre-line ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200' 
              : feedback.type === 'error'
                ? 'bg-red-500/20 border border-red-500/40 text-red-200'
                : 'bg-blue-500/20 border border-blue-500/40 text-blue-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <span>{String(feedback.text || '')}</span>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="toggle-push-notifications-btn"
            type="button"
            onClick={handleToggle}
            disabled={loading || syncing || !supported}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[44px] ${
              isActive 
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40' 
                : 'bg-[#064E3B] hover:bg-emerald-800 text-white border border-emerald-600/60'
            }`}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#FACC15]" />
            ) : isActive ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4 text-[#FACC15]" />
            )}
            <span>{isActive ? 'Desativar Notificações' : 'Ativar Notificações Push'}</span>
          </button>

          {/* Botão Sincronizar sempre visível se a permissão estiver concedida */}
          {permission === 'granted' && (
            <button
              id="resync-push-device-btn"
              type="button"
              onClick={handleSync}
              disabled={loading || syncing}
              className="px-3 py-2.5 rounded-xl bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/50 font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
              title="Registra ou atualiza a chave deste dispositivo no Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#FACC15]' : ''}`} />
              <span>Sincronizar Dispositivo</span>
            </button>
          )}

          {/* Botão Toggle Diagnóstico Técnico */}
          <button
            id="toggle-diagnostics-btn"
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="px-3 py-2.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 font-medium text-xs flex items-center gap-1 transition-all min-h-[44px]"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Diagnóstico Técnico</span>
            {showDiagnostics ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </button>
        </div>

        {(isActive || permission === 'granted') && (
          <button
            id="test-push-notification-btn"
            type="button"
            onClick={handleTest}
            disabled={loading || syncing}
            className="px-4 py-2.5 rounded-xl bg-[#FACC15] hover:bg-amber-400 text-gray-950 font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
            title="Envia uma notificação push real de teste para este dispositivo"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{loading ? 'Enviando...' : 'Testar Notificação'}</span>
          </button>
        )}
      </div>

      {/* Painel de Diagnóstico Técnico Detalhado */}
      {showDiagnostics && (
        <div className="mt-3 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700/50 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" /> Diagnóstico Obrigatório de Notificações Web Push
            </span>
            <button
              type="button"
              onClick={copyDiagnosticReport}
              className="px-2.5 py-1 rounded bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              {copiedDiag ? <Check className="w-3 h-3 text-[#FACC15]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedDiag ? 'Copiado!' : 'Copiar Relatório'}</span>
            </button>
          </div>

          {/* Grid com as 10 Informações Seguras Obrigatórias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {/* 1. Permissão do Navegador */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">1. Permissão do Navegador:</span>
              <span className={`font-bold ${permission === 'granted' ? 'text-emerald-400' : permission === 'denied' ? 'text-red-400' : 'text-amber-300'}`}>
                {permission === 'granted' ? 'Concedida (Autorizado)' : permission === 'denied' ? 'Bloqueada pelo Usuário' : 'Não solicitada (Padrão)'}
              </span>
            </div>

            {/* 2. Status do Service Worker */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">2. Status do Service Worker:</span>
              <span className="font-bold text-slate-100">
                {diagnostics?.serviceWorkerActive ? 'Ativo e Controlando (/sw.js)' : diagnostics?.serviceWorkerRegistered ? 'Registrado (Aguardando ativação)' : 'Não detectado'}
              </span>
            </div>

            {/* 3. Status do PushManager */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">3. Status do PushManager:</span>
              <span className="font-bold text-slate-100">
                {diagnostics?.pushManagerAvailable ? 'Disponível no Navegador' : 'Indisponível (necessário HTTPS / Safari 16.4+)'}
              </span>
            </div>

            {/* 4. Existência de Inscrição Local */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">4. Existência de Inscrição Local:</span>
              <span className={`font-bold truncate ${diagnostics?.hasLocalSubscription ? 'text-emerald-300' : 'text-slate-300'}`}>
                {diagnostics?.hasLocalSubscription ? 'Presente no dispositivo' : 'Inexistente neste aparelho'}
              </span>
            </div>

            {/* 5. Prefixo da Chave Pública Utilizada */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">5. Prefixo da Chave Pública:</span>
              <span className="font-mono font-bold text-emerald-300">
                {diagnostics?.vapidPublicKeySnippet || 'BGidTH8J...H4s'} (VAPID RFC 8292)
              </span>
            </div>

            {/* 6. Domínio Atual */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">6. Domínio Atual:</span>
              <span className="font-bold text-amber-300 break-all">
                {diagnostics?.currentDomain || (typeof window !== 'undefined' ? window.location.host : 'localhost:3000')}
              </span>
            </div>

            {/* 7. Quantidade de Dispositivos no Servidor */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">7. Dispositivos no Servidor:</span>
              <span className="font-bold text-slate-100">
                {serverStatus ? `${serverStatus.activeAuthorizedCount} ativo(s) (${statusSource})` : 'Consultando...'}
              </span>
            </div>

            {/* 8. Status da Consulta ao Firestore */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40">
              <span className="text-slate-400 block font-semibold">8. Consulta ao Firestore:</span>
              <span className={`font-bold ${serverStatus?.querySuccess ? 'text-emerald-400' : statusError ? 'text-red-400' : 'text-amber-300'}`}>
                {serverStatus?.querySuccess ? 'Conectado com sucesso (user_devices)' : statusError ? `Aviso: ${statusError}` : 'Conectando...'}
              </span>
            </div>

            {/* 9. Status do Endpoint de Envio */}
            <div className="p-2.5 rounded-lg bg-black/30 border border-emerald-900/40 md:col-span-2">
              <span className="text-slate-400 block font-semibold">9. Status do Endpoint de Envio:</span>
              <div className="flex flex-wrap items-center justify-between gap-1 mt-0.5">
                <span className="font-mono text-emerald-300 break-all">
                  {diagnostics?.targetApiUrl || '/api/notifications/test'}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-800/40 text-emerald-300 font-bold text-[10px]">
                  {diagnostics?.backendName || 'Ativo'}
                </span>
              </div>
            </div>

            {/* 10. Mensagem de Erro Técnico Resumida (se existir) */}
            {(statusError || serverStatus?.error) && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/40 md:col-span-2">
                <span className="text-red-400 block font-semibold">10. Erro Técnico Resumido:</span>
                <span className="font-medium text-red-200">
                  {statusError || serverStatus?.error}
                </span>
              </div>
            )}
          </div>

          {/* Configuração de Backend de Envio (Vercel vs Local) */}
          <div className="pt-2 border-t border-emerald-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-300 text-[11px]">
                Configuração do Backend de Envio:
              </span>
              <span className="text-[10px] text-slate-400">
                {customBackendUrl ? 'Apontando para URL personalizada' : 'Usando mesmo domínio'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customBackendUrl}
                onChange={(e) => setCustomBackendUrl(e.target.value)}
                placeholder="Ex: https://andrade-agro.vercel.app (deixe vazio para automático)"
                className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-emerald-800/60 text-emerald-100 text-[11px] placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  setCustomApiUrl(customBackendUrl);
                  setBackendSavedFeedback('Salvo com sucesso!');
                  setTimeout(() => setBackendSavedFeedback(null), 2500);
                  checkStatus();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shrink-0"
              >
                Salvar
              </button>
              {customBackendUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomBackendUrl('');
                    setCustomApiUrl('');
                    setBackendSavedFeedback('Restaurado para padrão!');
                    setTimeout(() => setBackendSavedFeedback(null), 2500);
                    checkStatus();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition-colors shrink-0"
                >
                  Padrão
                </button>
              )}
            </div>
            {backendSavedFeedback && (
              <span className="text-[10px] text-amber-300 font-bold block">
                {backendSavedFeedback}
              </span>
            )}
            <p className="text-[10px] text-slate-400 leading-normal">
              💡 <strong>Dica sobre a Vercel:</strong> Quando variáveis de ambiente como <code className="text-emerald-300">VAPID_PRIVATE_KEY</code> são salvas no painel da Vercel, é necessário clicar em <strong>"Redeploy"</strong> no painel de implantações da Vercel para que as Serverless Functions carreguem o novo valor.
            </p>
          </div>
        </div>
      )}

      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>No iPhone (iOS 16.4+), use "Compartilhar" &rarr; "Adicionar à Tela de Início" no Safari para habilitar notificações push. No Android, basta autorizar no Chrome.</span>
      </div>
    </div>
  );
};
