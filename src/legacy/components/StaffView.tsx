import React, { useState } from 'react';
import { 
  Users, Plus, Shield, User as UserIcon, Phone, FileText, CheckCircle2, 
  AlertTriangle, X, Edit3, Trash2, Key, Lock, Eye, EyeOff, Check
} from 'lucide-react';
import { User, UserRole, canManageUsers } from '../types';
import { formatDateBR } from '../utils/calculations';

interface StaffViewProps {
  users: User[];
  currentUser: User;
  onAddUser: (u: Omit<User, 'id'>) => void;
  onUpdateUser: (id: string, u: Partial<User>) => void;
  onDeleteUser?: (id: string) => void;
  onResetPassword?: (id: string, newPass: string) => void;
  darkMode?: boolean;
}

export const StaffViewComponent: React.FC<StaffViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onResetPassword
}) => {
  const isMaintenance = canManageUsers(currentUser.role);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);

  // Feedback notifications
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form fields for Add / Edit
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('FUNCIONARIO');
  const [active, setActive] = useState(true);
  const [department, setDepartment] = useState('Agrícola');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnh, setCnh] = useState('');
  const [cnhCategory, setCnhCategory] = useState('D');
  const [cnhExpiration, setCnhExpiration] = useState('');
  const [avatar, setAvatar] = useState('');

  // Password fields for creation
  const [initialPassword, setInitialPassword] = useState('');
  const [confirmInitialPassword, setConfirmInitialPassword] = useState('');

  // Password fields for inline edit / reset modal
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  const handleOpenAdd = () => {
    if (!isMaintenance) return;
    setEditingUser(null);
    setName('');
    setEmail('');
    setRole('FUNCIONARIO');
    setActive(true);
    setDepartment('Agrícola');
    setPhone('');
    setCpf('');
    setCnh('');
    setCnhCategory('D');
    setCnhExpiration('');
    setAvatar('');
    setInitialPassword('');
    setConfirmInitialPassword('');
    setShowPasswordText(false);
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (u: User) => {
    if (!isMaintenance) return;
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email || '');
    setRole(u.role);
    setActive(u.active !== false);
    setDepartment(u.department || 'Agrícola');
    setPhone(u.phone || '');
    setCpf(u.cpf || '');
    setCnh(u.cnh || '');
    setCnhCategory(u.cnhCategory || 'D');
    setCnhExpiration(u.cnhExpiration || '');
    setAvatar(u.avatar || '');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPasswordText(false);
    setShowAddEditModal(true);
  };

  const handleOpenResetModal = (u: User) => {
    if (!isMaintenance) return;
    setResetTargetUser(u);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPasswordText(false);
    setShowResetModal(true);
  };

  const handleSubmitAddEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaintenance) {
      showNotification('error', 'Acesso negado: Somente o perfil Manutenção pode gerenciar usuários.');
      return;
    }

    try {
      if (editingUser) {
        // Edit flow
        const updatePayload: Partial<User> = {
          name: name.trim(),
          email: email.trim() || undefined,
          role,
          active,
          department: department.trim() || 'Agrícola',
          phone: phone.trim() || undefined,
          cpf: cpf.trim() || undefined,
          cnh: cnh.trim() || undefined,
          cnhCategory: cnhCategory.trim() || undefined,
          cnhExpiration: cnhExpiration.trim() || undefined,
          avatar: avatar.trim() || undefined
        };

        // If optional password reset was provided in edit modal
        if (newPassword.trim()) {
          if (newPassword.trim().length < 6) {
            showNotification('error', 'A nova senha deve possuir no mínimo 6 caracteres.');
            return;
          }
          if (newPassword !== confirmNewPassword) {
            showNotification('error', 'A confirmação de senha não coincide com a nova senha digitada.');
            return;
          }
          updatePayload.password = newPassword.trim();
        }

        onUpdateUser(editingUser.id, updatePayload);
        showNotification('success', `Dados do funcionário "${name}" atualizados com sucesso.`);
      } else {
        // Add flow
        const rawPassword = initialPassword.trim();
        if (rawPassword.length < 6) {
          showNotification('error', 'A senha inicial deve possuir no mínimo 6 caracteres.');
          return;
        }
        if (rawPassword !== confirmInitialPassword.trim()) {
          showNotification('error', 'A confirmação de senha não coincide com a senha digitada.');
          return;
        }

        onAddUser({
          name: name.trim(),
          email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@andradeagro.com.br`,
          password: rawPassword,
          role,
          active: true,
          department: department.trim() || 'Agrícola',
          phone: phone.trim() || undefined,
          cpf: cpf.trim() || undefined,
          cnh: cnh.trim() || undefined,
          cnhCategory: cnhCategory.trim() || undefined,
          cnhExpiration: cnhExpiration.trim() || undefined,
          avatar: avatar.trim() || undefined
        });

        showNotification('success', `Novo funcionário "${name}" cadastrado com sucesso.`);
      }

      setShowAddEditModal(false);
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao processar dados do usuário.');
    }
  };

  const handleSubmitResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaintenance || !resetTargetUser) {
      showNotification('error', 'Acesso negado: Somente o perfil Manutenção pode redefinir senhas.');
      return;
    }

    const trimmedPass = newPassword.trim();
    if (trimmedPass.length < 6) {
      showNotification('error', 'A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }
    if (trimmedPass !== confirmNewPassword.trim()) {
      showNotification('error', 'A confirmação não coincide com a nova senha digitada.');
      return;
    }

    try {
      if (onResetPassword) {
        onResetPassword(resetTargetUser.id, trimmedPass);
      } else {
        onUpdateUser(resetTargetUser.id, { password: trimmedPass });
      }
      showNotification('success', `Senha do usuário "${resetTargetUser.name}" redefinida com sucesso.`);
      setShowResetModal(false);
      setResetTargetUser(null);
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao redefinir a senha.');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Notifications Toast */}
      {actionFeedback && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in slide-in-from-top-2 shadow-lg ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100'
            : 'bg-red-950/90 border-red-500/50 text-red-100'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="font-semibold">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-emerald-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Equipe, Motoristas & Operadores
          </h1>
          <p className="text-xs text-emerald-400">
            Visualização e gestão da equipe, motoristas e operadores no AndradeAgro.
          </p>
        </div>

        {isMaintenance ? (
          <button
            onClick={handleOpenAdd}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto transition-all min-h-[44px] active:scale-95 border border-emerald-700/60"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Funcionário</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-[11px] font-medium text-emerald-300">
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Modo Leitura (Gestão exclusiva pelo perfil Manutenção)</span>
          </div>
        )}
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => {
          const initials = u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
          const isCurrentUser = u.id === currentUser.id;

          return (
            <div
              key={u.id}
              className="p-5 rounded-2xl border flex items-start gap-4 transition-all relative bg-emerald-950/40 border-emerald-900 shadow-sm"
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt={u.name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-500/50 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-emerald-900 text-[#FACC15] ring-2 ring-amber-500/50 flex items-center justify-center font-black text-base shrink-0">
                  {initials || <UserIcon className="w-6 h-6" />}
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      u.role === 'ADMIN' 
                        ? 'bg-amber-500/20 text-amber-300' 
                        : u.role === 'MANUTENCAO'
                        ? 'bg-amber-400/20 text-[#FACC15] border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {u.role === 'ADMIN' ? 'Administrador' : u.role === 'MANUTENCAO' ? '🔧 Manutenção' : 'Funcionário'}
                    </span>
                    {u.active === false && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                        Inativo
                      </span>
                    )}
                  </div>
                  
                  {/* Exclusive Action Controls for MANUTENCAO */}
                  {isMaintenance && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenResetModal(u)}
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 min-h-[32px] transition-colors"
                        title="Redefinir Senha do Usuário"
                        aria-label={`Redefinir senha de ${u.name}`}
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 min-h-[32px] transition-colors"
                        title="Editar Dados do Funcionário"
                        aria-label={`Editar funcionário ${u.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteUser && (
                        <button
                          onClick={() => {
                            if (isCurrentUser) {
                              showNotification('error', 'Você não pode excluir o seu próprio usuário enquanto está conectado.');
                              return;
                            }
                            if (confirm(`Tem certeza que deseja excluir o funcionário "${u.name}"? Esta ação removerá o acesso do colaborador.`)) {
                              onDeleteUser(u.id);
                              showNotification('success', `Usuário "${u.name}" excluído.`);
                            }
                          }}
                          disabled={isCurrentUser}
                          className={`p-1.5 rounded-lg min-h-[32px] transition-colors ${
                            isCurrentUser 
                              ? 'opacity-30 cursor-not-allowed text-gray-500' 
                              : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                          }`}
                          title={isCurrentUser ? 'Não é possível excluir o próprio usuário ativo' : 'Excluir Funcionário'}
                          aria-label={`Excluir funcionário ${u.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <h3 className="font-extrabold text-sm text-emerald-100 truncate">{u.name}</h3>
                <p className="text-emerald-300 font-medium">{u.department || 'Geral'}</p>

                <div className="pt-2 border-t border-emerald-800/20 space-y-1 text-[11px] text-emerald-300/80">
                  <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-amber-500 shrink-0" /> {u.phone || 'S/ Tel'}</p>
                  {u.cnh && (
                    <p className="flex items-center gap-1.5 font-semibold text-emerald-300">
                      <FileText className="w-3 h-3 text-emerald-400 shrink-0" /> CNH {u.cnhCategory || 'B'} • Vence: {formatDateBR(u.cnhExpiration || '')}
                    </p>
                  )}
                  
                  {/* Protected Password Indicator - NEVER raw text */}
                  <p className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 font-mono pt-0.5">
                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Senha:</span>
                    <span className="text-emerald-300 font-semibold">•••••••• (protegida)</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit User Modal (MANUTENCAO only) */}
      {showAddEditModal && isMaintenance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 bg-emerald-950 border-emerald-800 text-emerald-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/40">
              <span className="font-bold text-sm">
                {editingUser ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
              </span>
              <button 
                onClick={() => setShowAddEditModal(false)} 
                className="p-1.5 rounded-lg hover:bg-emerald-500/10 min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAddEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1 text-emerald-200">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pedro Henrique Souza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Perfil de Acesso *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white outline-none focus:border-amber-400"
                  >
                    <option value="FUNCIONARIO" className="bg-emerald-950 text-white">Funcionário</option>
                    <option value="MANUTENCAO" className="bg-emerald-950 text-white">🔧 Manutenção</option>
                    <option value="ADMIN" className="bg-emerald-950 text-white">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Status do Usuário</label>
                  <select
                    value={active ? 'true' : 'false'}
                    onChange={(e) => setActive(e.target.value === 'true')}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white outline-none focus:border-amber-400"
                  >
                    <option value="true" className="bg-emerald-950 text-white">Ativo</option>
                    <option value="false" className="bg-emerald-950 text-white">Inativo (Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Password Fields for New User (Always Masked) */}
              {!editingUser && (
                <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-amber-300">Senha Inicial de Acesso *</label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-200 flex items-center gap-1"
                    >
                      {showPasswordText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPasswordText ? 'Ocultar' : 'Exibir'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Senha (mínimo 6 dígitos)"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-emerald-950 border-emerald-800 text-white placeholder-emerald-500 font-mono text-xs outline-none focus:border-amber-400"
                    />
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Confirmar senha"
                      value={confirmInitialPassword}
                      onChange={(e) => setConfirmInitialPassword(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-emerald-950 border-emerald-800 text-white placeholder-emerald-500 font-mono text-xs outline-none focus:border-amber-400"
                    />
                  </div>
                  <p className="text-[10px] text-emerald-400/80">
                    A senha será criptografada com algoritmo salted SHA-256 e nunca será salva em texto puro.
                  </p>
                </div>
              )}

              {/* Optional Password Reset for Editing User */}
              {editingUser && (
                <div className="p-3 rounded-xl bg-emerald-900/20 border border-emerald-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-emerald-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Alterar Senha de Acesso (Opcional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-200 flex items-center gap-1"
                    >
                      {showPasswordText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPasswordText ? 'Ocultar' : 'Exibir'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      minLength={6}
                      placeholder="Nova senha (deixe vazio p/ manter)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2 rounded-xl border bg-emerald-950/80 border-emerald-800 text-white placeholder-emerald-500/70 font-mono text-xs outline-none focus:border-amber-400"
                    />
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      minLength={6}
                      placeholder="Confirmar nova senha"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full p-2 rounded-xl border bg-emerald-950/80 border-emerald-800 text-white placeholder-emerald-500/70 font-mono text-xs outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Setor / Departamento</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">E-mail</label>
                  <input
                    type="email"
                    placeholder="pedro@andradeagro.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(66) 99999-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">CPF</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Cat. CNH</label>
                  <input
                    type="text"
                    placeholder="Ex: D, AE"
                    value={cnhCategory}
                    onChange={(e) => setCnhCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Nº CNH</label>
                  <input
                    type="text"
                    placeholder="00000000000"
                    value={cnh}
                    onChange={(e) => setCnh(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Validade CNH</label>
                  <input
                    type="date"
                    value={cnhExpiration}
                    onChange={(e) => setCnhExpiration(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-emerald-200">URL da Foto / Avatar</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-800/40">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 rounded-xl hover:bg-emerald-500/10 text-emerald-300 font-semibold min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold min-h-[44px] shadow-md transition-all active:scale-95"
                >
                  {editingUser ? 'Salvar Alterações' : 'Salvar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fast Password Reset Modal (MANUTENCAO only) */}
      {showResetModal && isMaintenance && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl shadow-2xl border p-5 space-y-4 bg-emerald-950 border-emerald-800 text-emerald-100">
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Key className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm">Redefinir Senha de Acesso</span>
              </div>
              <button 
                onClick={() => setShowResetModal(false)} 
                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-800/60 space-y-1">
              <p className="text-xs text-emerald-200 font-semibold">
                Colaborador: <span className="text-white font-bold">{resetTargetUser.name}</span>
              </p>
              <p className="text-[11px] text-emerald-400">
                E-mail: {resetTargetUser.email || 'Não cadastrado'}
              </p>
            </div>

            <form onSubmit={handleSubmitResetPassword} className="space-y-3.5 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-emerald-200">Nova Senha *</label>
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-200 flex items-center gap-1"
                  >
                    {showPasswordText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPasswordText ? 'Ocultar' : 'Exibir'}</span>
                  </button>
                </div>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Nova senha (mínimo 6 dígitos)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 font-mono outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-emerald-200">Confirmar Nova Senha *</label>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Confirme a nova senha"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500 font-mono outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-800/40">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2.5 rounded-xl hover:bg-emerald-500/10 text-emerald-300 font-semibold min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold min-h-[44px] shadow-md transition-all active:scale-95"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export const StaffView = React.memo(StaffViewComponent);
