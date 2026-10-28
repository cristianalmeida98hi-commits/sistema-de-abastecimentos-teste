import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, Clock, User as UserIcon, FileText, Search, 
  Filter, Calendar, RefreshCw, ChevronDown, CheckCircle2, 
  AlertCircle, Trash2, ArrowUpDown
} from 'lucide-react';
import { AuditLog, User } from '../types';
import { formatDateTimeBR } from '../utils/calculations';
import { cleanupAuditLogsOlderThan90Days } from '../utils/storage';

interface AuditLogsViewProps {
  auditLogs: AuditLog[];
  currentUser?: User | null;
  darkMode?: boolean;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({
  auditLogs = [],
  currentUser,
  darkMode = true
}) => {
  // Configuração inicial: 10 registros mais recentes exibidos por padrão
  const [displayCount, setDisplayCount] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('TODOS');
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<string | null>(null);

  // Permissão para acionar rotina manual de limpeza de logs de 90 dias
  const canRunRetentionCleanup = currentUser?.role === 'MANUTENCAO' || currentUser?.role === 'ADMIN';

  // Ordenação garantida por data decrescente (mais recente primeiro)
  const sortedLogs = useMemo(() => {
    return [...auditLogs].sort((a, b) => {
      const timeA = new Date(a.dateTime).getTime() || 0;
      const timeB = new Date(b.dateTime).getTime() || 0;
      return timeB - timeA;
    });
  }, [auditLogs]);

  // Filtros de busca e ação
  const filteredLogs = useMemo(() => {
    return sortedLogs.filter(log => {
      // Filtro de busca textual
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchUser = (log.userName || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchEntity = (log.entity || '').toLowerCase().includes(q);
        const matchAction = (log.action || '').toLowerCase().includes(q);
        if (!matchUser && !matchDetails && !matchEntity && !matchAction) {
          return false;
        }
      }

      // Filtro por tipo de ação
      if (actionFilter !== 'TODOS') {
        if (actionFilter === 'LOGIN') {
          if (log.action !== 'LOGIN' && log.action !== 'LOGOUT') return false;
        } else if (log.action !== actionFilter) {
          return false;
        }
      }

      return true;
    });
  }, [sortedLogs, searchTerm, actionFilter]);

  // Registros fatiados para exibição (iniciando em 10)
  const displayedLogs = useMemo(() => {
    return filteredLogs.slice(0, displayCount);
  }, [filteredLogs, displayCount]);

  const hasMore = displayedLogs.length < filteredLogs.length;

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 10);
  };

  const handleShowAll = () => {
    setDisplayCount(filteredLogs.length);
  };

  const handleResetToTen = () => {
    setDisplayCount(10);
  };

  const handleManualRetentionCleanup = async () => {
    if (!canRunRetentionCleanup) return;

    if (confirm('Deseja executar a rotina de retenção de 90 dias agora?\n\nIsso removerá apenas logs de auditoria e segurança anteriores a 90 dias. Nenhum registro de manutenção, abastecimento ou veículo será afetado.')) {
      setIsCleaning(true);
      setCleanupFeedback(null);
      try {
        const result = await cleanupAuditLogsOlderThan90Days('manual');
        if (result.deletedCount > 0) {
          setCleanupFeedback(`Limpeza concluída com sucesso: ${result.deletedCount} log(s) anterior(es) a 90 dias foram removidos.`);
        } else {
          setCleanupFeedback('Nenhum log com mais de 90 dias encontrado. O banco de dados de auditoria já está otimizado.');
        }
        setTimeout(() => setCleanupFeedback(null), 8000);
      } catch (err: any) {
        console.error('Erro na limpeza de retenção:', err);
        setCleanupFeedback('Falha ao executar rotina de retenção. Tente novamente mais tarde.');
      } finally {
        setIsCleaning(false);
      }
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'LOGOUT':
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
      case 'CRIAR':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'EDITAR':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'EXCLUIR':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      case 'CONFIGURACAO':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            Logs de Auditoria & Segurança
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Registro sequencial de acessos, eventos de segurança e alterações no AndradeAgro.
          </p>
        </div>

        {canRunRetentionCleanup && (
          <button
            onClick={handleManualRetentionCleanup}
            disabled={isCleaning}
            className="px-3.5 py-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-800 text-emerald-200 text-xs font-bold flex items-center gap-2 self-start sm:self-auto transition-all disabled:opacity-50"
            title="Executar verificação da política de retenção de 90 dias"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin' : ''}`} />
            <span>{isCleaning ? 'Verificando...' : 'Limpar Logs > 90 Dias'}</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {cleanupFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-900/60 border border-emerald-700/60 text-xs text-emerald-200 flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{cleanupFeedback}</span>
        </div>
      )}

      {/* Info & Retention Policy Banner */}
      <div className="p-4 rounded-2xl border bg-emerald-950/40 border-emerald-900/80 text-xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-emerald-200 font-bold">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Política de Retenção & Otimização de Consultas</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300 font-semibold">
            Retenção de 90 dias ativa
          </span>
        </div>
        <p className="text-gray-400 dark:text-emerald-300/80 text-[11px] leading-relaxed">
          Exibindo inicialmente os <strong>10 registros mais recentes</strong> para máxima velocidade de carregamento e menor consumo de banda. Registros de login e segurança com mais de 90 dias são elegíveis para expiração automática, enquanto os dados de manutenção, máquinas e abastecimentos permanecem integralmente preservados.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border bg-emerald-950/40 border-emerald-900 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60" />
            <input
              type="text"
              placeholder="Buscar por usuário, ação, módulo ou detalhes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border outline-none bg-emerald-900/30 border-emerald-800 text-white placeholder-emerald-500/50 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setDisplayCount(10);
              }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border outline-none bg-emerald-900/30 border-emerald-800 text-white focus:border-emerald-500 transition-colors"
            >
              <option value="TODOS" className="bg-emerald-950 text-white">Todas as Ações</option>
              <option value="LOGIN" className="bg-emerald-950 text-white">Login / Logout</option>
              <option value="CRIAR" className="bg-emerald-950 text-white">Criação (CRIAR)</option>
              <option value="EDITAR" className="bg-emerald-950 text-white">Edição (EDITAR)</option>
              <option value="EXCLUIR" className="bg-emerald-950 text-white">Exclusão (EXCLUIR)</option>
              <option value="CONFIGURACAO" className="bg-emerald-950 text-white">Configuração do Sistema</option>
            </select>
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-[11px] text-emerald-400/80 pt-1 border-t border-emerald-900/50">
          <span>
            Mostrando <strong>{displayedLogs.length}</strong> de <strong>{filteredLogs.length}</strong> registro(s) encontrado(s) (Total no banco: {auditLogs.length})
          </span>
          {displayCount > 10 && (
            <button
              onClick={handleResetToTen}
              className="text-emerald-300 hover:text-emerald-100 underline text-[11px]"
            >
              Voltar aos 10 mais recentes
            </button>
          )}
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="rounded-2xl border overflow-hidden bg-emerald-950/40 border-emerald-900 shadow-sm">
        <div className="p-3.5 border-b border-emerald-800/40 font-bold text-xs text-emerald-200 flex items-center justify-between">
          <span>Registros Mais Recentes (Ordem Decrescente)</span>
          <span className="text-[10px] text-emerald-400 font-normal">
            {displayedLogs.length} visíveis
          </span>
        </div>

        {displayedLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-emerald-400/70">
            Nenhum log encontrado para os critérios de busca aplicados.
          </div>
        ) : (
          <div className="divide-y divide-emerald-900/30">
            {displayedLogs.map(log => (
              <div 
                key={log.id} 
                className="p-3.5 flex items-start gap-3 text-xs hover:bg-emerald-500/5 transition-colors"
              >
                <div className={`px-2 py-1 rounded-lg border font-black text-[10px] uppercase shrink-0 ${getActionBadgeColor(log.action)}`}>
                  {log.action}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-extrabold text-gray-900 dark:text-emerald-100 flex items-center gap-1.5">
                      <UserIcon className="w-3 h-3 text-emerald-400" />
                      {log.userName || 'Sistema'}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-emerald-400 font-medium">
                      {formatDateTimeBR(log.dateTime)}
                    </span>
                  </div>

                  <p className="text-gray-600 dark:text-emerald-200/90 mt-1 leading-relaxed">
                    {log.details}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                    <span className="text-amber-500 font-semibold">
                      Módulo: {log.entity}
                    </span>
                    {log.userId && (
                      <span className="text-emerald-500/60 font-mono">
                        UID: {log.userId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More & Pagination Bar */}
        {hasMore && (
          <div className="p-3 border-t border-emerald-900/50 bg-emerald-950/60 flex items-center justify-center gap-3">
            <button
              onClick={handleLoadMore}
              className="px-4 py-1.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors active:scale-95"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Carregar mais (+10)</span>
            </button>

            <button
              onClick={handleShowAll}
              className="px-4 py-1.5 rounded-xl bg-emerald-800/30 hover:bg-emerald-800/60 border border-emerald-800 text-emerald-300 text-xs font-medium transition-colors"
            >
              Ver todos ({filteredLogs.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
