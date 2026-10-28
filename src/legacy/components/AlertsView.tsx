import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Truck, Sparkles, Camera, X, ZoomIn, User as UserIcon } from 'lucide-react';
import { SmartAlert, User, Vehicle, MachineIssue } from '../types';
import { formatDateBR } from '../utils/calculations';

interface AlertsViewProps {
  alerts: SmartAlert[];
  currentUser: User;
  onResolveAlert: (id: string) => void;
  vehicles?: Vehicle[];
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  darkMode?: boolean;
  highlightedAlertId?: string | null;
  highlightedIssueId?: string | null;
  onClearHighlight?: () => void;
  machineIssues?: MachineIssue[];
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  currentUser,
  onResolveAlert,
  vehicles = [],
  onOpenDigitalSheet,
  highlightedAlertId,
  highlightedIssueId,
  onClearHighlight,
  machineIssues = []
}) => {
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  const targetId = highlightedAlertId || highlightedIssueId;

  // Unify and deduplicate unresolved alerts (especially defects reported for the same equipment/issue)
  const unresolvedAlerts = React.useMemo(() => {
    const raw = alerts.filter(a => !a.resolved);
    const seenIssueKeys = new Set<string>();
    const result: SmartAlert[] = [];

    for (const alt of raw) {
      if (alt.type === 'MACHINE_ISSUE') {
        // Group by issueId or by equipmentId + date
        const key = alt.issueId || `iss-${alt.equipmentId}`;
        if (seenIssueKeys.has(key)) {
          continue; // Skip duplicate notification for the exact same defect
        }
        seenIssueKeys.add(key);
      }
      result.push(alt);
    }

    return result;
  }, [alerts]);

  useEffect(() => {
    if (targetId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => {
        if (onClearHighlight) onClearHighlight();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [targetId, onClearHighlight]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-emerald-100 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          Central de Alertas Inteligentes
        </h1>
        <p className="text-xs text-emerald-400">
          Identificação automática de consumo suspeito, revisões preventivas pendentes e defeitos operacionais.
        </p>
      </div>

      {/* Unresolved Alerts List */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
          Alertas Pendentes ({unresolvedAlerts.length})
        </h2>

        {unresolvedAlerts.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border bg-emerald-950/40 border-emerald-900">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-sm text-emerald-200">Nenhum alerta pendente!</p>
            <p className="text-xs text-emerald-400 mt-0.5">Tudo operando dentro das margens de segurança na fazenda.</p>
          </div>
        ) : (
          unresolvedAlerts.map(alert => {
            const isHighlighted = !!targetId && (
              alert.id === targetId ||
              (alert.equipmentId && alert.equipmentId === targetId) ||
              (alert.issueId && alert.issueId === targetId) ||
              alert.id.toLowerCase().includes(targetId.toLowerCase())
            );

            // Locate matching defect issue if this alert is a machine issue
            const isDefectAlert = alert.type === 'MACHINE_ISSUE' || alert.id.startsWith('alt-iss-');
            const matchingIssue = isDefectAlert ? (
              machineIssues.find(i => 
                (alert.issueId && i.id === alert.issueId) ||
                (alert.equipmentId && i.equipmentId === alert.equipmentId && i.status === 'ABERTO')
              )
            ) : undefined;

            const defectPhoto = alert.photoUrl || 
              (alert.photoUrls && alert.photoUrls[0]) || 
              matchingIssue?.photoUrls?.[0] || 
              matchingIssue?.photoUrl;

            const operatorName = alert.operatorName || matchingIssue?.reportedByUserName;
            const targetVehicle = alert.equipmentId && vehicles ? vehicles.find(v => v.id === alert.equipmentId) : undefined;

            return (
              <div
                key={alert.id}
                ref={isHighlighted ? highlightedRef : undefined}
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 shadow-sm ${
                  isHighlighted
                    ? 'ring-2 ring-[#FACC15] shadow-lg shadow-amber-500/20 bg-amber-500/20 border-[#FACC15]'
                    : alert.severity === 'ALTA'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-amber-500 text-gray-950 font-bold shrink-0 mt-0.5 shadow-sm">
                      <ShieldAlert className="w-5 h-5" />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs uppercase tracking-wide text-slate-100">
                          {isDefectAlert && targetVehicle
                            ? `Defeito Relatado: ${targetVehicle.model}`
                            : alert.title}
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Gravidade {alert.severity}
                        </span>

                        {isHighlighted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-[#FACC15] text-slate-950 flex items-center gap-1 animate-pulse">
                            <Sparkles className="w-3 h-3 text-slate-950" />
                            Alerta da Notificação
                          </span>
                        )}
                      </div>

                      {/* Defect Description */}
                      <p className="text-xs leading-relaxed text-slate-200 font-medium">
                        {matchingIssue?.description ? `"${matchingIssue.description}"` : alert.description}
                      </p>

                      {/* Operator & Metadata Line */}
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-emerald-300/90 pt-0.5">
                        {operatorName && (
                          <span className="flex items-center gap-1 font-semibold">
                            <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>Operador: <strong>{operatorName}</strong></span>
                          </span>
                        )}

                        <span className="opacity-80">
                          Data: <strong>{formatDateBR(alert.date)}</strong>
                        </span>

                        {targetVehicle && (
                          <span className="text-amber-300 font-bold">
                            {targetVehicle.patrimonyCode ? `Patrimônio: ${targetVehicle.patrimonyCode}` : (targetVehicle.licensePlate ? `Placa: ${targetVehicle.licensePlate}` : '')}
                          </span>
                        )}
                      </div>

                      {/* Direct Defect Photo Preview right in the alert card */}
                      {defectPhoto && (
                        <div className="pt-2">
                          <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-400 block mb-1.5 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-[#FACC15]" />
                            Foto Anexada pelo Operador:
                          </span>
                          <div 
                            onClick={() => setEnlargedPhoto(defectPhoto)}
                            className="relative inline-block rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-black/40 shadow-lg cursor-pointer group transition-all hover:border-amber-400"
                            title="Clique para ampliar a foto do defeito"
                          >
                            <img
                              src={defectPhoto}
                              alt="Foto do defeito relatado"
                              className="w-48 h-32 sm:w-60 sm:h-36 object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-2 pointer-events-none">
                              <span className="text-[10px] font-extrabold text-amber-300 flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                <ZoomIn className="w-3 h-3 text-[#FACC15]" />
                                Ampliar foto
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {targetVehicle && onOpenDigitalSheet && (
                      <button
                        onClick={() => onOpenDigitalSheet(targetVehicle)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        title={`Abrir ficha de ${targetVehicle.model}`}
                      >
                        <Truck className="w-4 h-4 text-[#FACC15]" />
                        <span>Ficha ({targetVehicle.patrimonyCode || targetVehicle.licensePlate || 'Máquina'})</span>
                      </button>
                    )}

                    <button
                      onClick={() => onResolveAlert(alert.id)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                      title={isDefectAlert ? 'Resolver este defeito' : 'Resolver alerta'}
                    >
                      <CheckCircle2 className="w-4 h-4 text-gray-950" />
                      <span>{isDefectAlert ? 'Resolver Defeito' : 'Resolver Alerta'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Enlarged Photo Modal */}
      {enlargedPhoto && (
        <div 
          onClick={() => setEnlargedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-slate-900 border border-emerald-800 rounded-3xl overflow-hidden shadow-2xl p-2 sm:p-4"
          >
            <div className="flex items-center justify-between p-2 pb-3 border-b border-emerald-900/60">
              <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#FACC15]" />
                Foto Anexada ao Defeito
              </span>
              <button
                onClick={() => setEnlargedPhoto(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                title="Fechar visualização"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/60 rounded-2xl mt-2 max-h-[75vh] overflow-hidden">
              <img
                src={enlargedPhoto}
                alt="Foto ampliada do defeito"
                className="max-h-[70vh] max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

