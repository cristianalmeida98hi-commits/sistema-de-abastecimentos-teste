import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Fuel, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import AndradePrototype from "./original-inspired/AndradePrototypeOriginalInspired";
import "./original-inspired-v2.css";

export default function AndradePrototypeOriginalInspiredV2() {
  const [authenticated, setAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("caio@andradeagro.com.br");
  const [password, setPassword] = useState("123456");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthenticated(true);
  }

  if (authenticated) {
    return <AndradePrototype />;
  }

  return (
    <main className="login-preview-shell">
      <section className="login-preview-brand">
        <div className="login-brand-topline"><span className="login-brand-mark"><Fuel size={20} /></span><span>Andrade Agro</span></div>
        <div className="login-brand-copy">
          <p className="login-kicker">Gestão agrícola integrada</p>
          <h1>Controle sua operação com clareza.</h1>
          <p>Acompanhe abastecimentos, frota e manutenção em um só lugar, com a visão que sua equipe precisa para trabalhar melhor.</p>
          <div className="login-feature-list">
            <div><span><Fuel size={16} /></span><strong>Abastecimentos organizados</strong><small>Registros confiáveis em cada operação.</small></div>
            <div><span><ShieldCheck size={16} /></span><strong>Dados sob controle</strong><small>Mais segurança para a rotina do campo.</small></div>
          </div>
        </div>
        <span className="login-preview-label">Protótipo independente · Ambiente demonstrativo</span>
      </section>
      <section className="login-preview-form-area">
        <div className="login-form-card">
          <div className="login-form-heading"><div className="login-small-mark"><Fuel size={17} /></div><p>Bem-vindo de volta</p><h2>Entre na sua conta</h2><span>Acesse o painel da Andrade Agro</span></div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="preview-email">E-mail</label>
            <div className="login-input-wrap"><UserRound size={17} /><input id="preview-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required /></div>
            <div className="login-label-row"><label htmlFor="preview-password">Senha</label><button type="button" className="login-link">Esqueceu a senha?</button></div>
            <div className="login-input-wrap"><LockKeyhole size={17} /><input id="preview-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            <label className="remember-row"><input type="checkbox" defaultChecked /> <span>Manter-me conectado</span></label>
            <button type="submit" className="login-submit">Entrar no sistema <ArrowRight size={17} /></button>
          </form>
          <p className="login-demo-note">Use os dados demonstrativos preenchidos para visualizar o painel.</p>
        </div>
        <p className="login-footer">© 2024 Andrade Agro · Ambiente seguro e demonstrativo</p>
      </section>
    </main>
  );
}
