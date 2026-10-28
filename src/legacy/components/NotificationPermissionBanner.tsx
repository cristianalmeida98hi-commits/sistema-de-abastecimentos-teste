import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, ShieldCheck, X, AlertTriangle, Loader2 } from 'lucide-react';
import { User } from '../types';
import { 
  shouldShowPushOptInPrompt, 
  enablePushNotifications, 
  dismissPushPrompt 
} from '../utils/pushNotifications';

interface NotificationPermissionBannerProps {
  currentUser: User;
  onStatusChanged?: () => void;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  currentUser,
  onStatusChanged
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const evaluateVisibility = () => {
    const shouldShow = shouldShowPushOptInPrompt(currentUser);
    setIsVisible(shouldShow);
  };

  useEffect(() => {
    evaluateVisibility();

    const handleStatusChange = () => {
      evaluateVisibility();
    };

    window.addEventListener('andradeagro_push_status_changed', handleStatusChange);
    return () => {
      window.removeEventListener('andradeagro_push_status_changed', handleStatusChange);
    };
  }, [currentUser.id, currentUser.role]);

  if (!isVisible && !feedback) {
    return null;
  }

  const handleEnable = async () => {
    setIsLoading(true);
    setFeedback(null);

    try {
      const result = await enablePushNotifications(currentUser);
      if (result.success) {
        setFeedback({
          type: 'success',
          message: 'Notificações push ativadas com sucesso! Você receberá alertas em tempo real neste dispositivo.'
        });
        if (onStatusChanged) onStatusChanged();
        setTimeout(() => {
          setIsVisible(false);
          setFeedback(null);
        }, 4000);
      } else {
        if (result.status === 'denied') {
          setFeedback({
            type: 'error',
            message: 'Permissão bloqueada no navegador. Para liberar, clique no ícone de configurações ao lado do endereço web.'
          });
        } else {
          setFeedback({
            type: 'error',
            message: result.message || 'Não foi possível ativar as notificações no momento.'
          });
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Falha ao solicitar ativação das notificações.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    dismissPushPrompt(currentUser.id);
    setIsVisible(false);
  };

  return (
    <div className="w-full mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {feedback ? (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs shadow-md ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
              : 'bg-red-950/90 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl border bg-gradient-to-r from-[#042d23] via-[#05382c] to-[#04281f] border-emerald-700/60 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#03231b] border border-[#FACC15]/40 flex items-center justify-center shrink-0 shadow-sm">
              <Bell className="w-5 h-5 text-[#FACC15] animate-bounce" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                  Notificações em Tempo Real do Andrade Agro
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30">
                  {currentUser.role === 'ADMIN' ? 'Perfil Administrador' : 'Perfil Manutenção'}
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 leading-relaxed max-w-2xl">
                Deseja receber avisos instantâneos de <strong className="text-white">nível baixo nos tanques</strong>, <strong className="text-white">trocas de óleo pendentes</strong>, <strong className="text-white">novas manutenções registradas</strong> e <strong className="text-white">falhas mecânicas</strong> neste dispositivo?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
            <button
              onClick={handleDismiss}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 hover:text-white hover:bg-emerald-800/40 transition-colors"
            >
              Agora Não
            </button>
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-950/40 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Configurando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-slate-950" />
                  <span>Ativar Notificações</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
