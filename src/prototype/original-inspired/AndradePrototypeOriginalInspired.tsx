import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Droplets,
  Gauge,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  Settings2,
  ShieldCheck,
  Tractor,
  Truck,
  Wrench,
  X,
  Fuel,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./original-inspired.css";

type Section = "Visão geral" | "Abastecimentos" | "Frota" | "Alertas" | "Manutenção";

const chartData = [
  { name: "01 Mai", consumo: 1320, volume: 2180 },
  { name: "06 Mai", consumo: 1580, volume: 2420 },
  { name: "11 Mai", consumo: 1410, volume: 2640 },
  { name: "16 Mai", consumo: 1840, volume: 2900 },
  { name: "21 Mai", consumo: 1720, volume: 2760 },
  { name: "26 Mai", consumo: 2130, volume: 3180 },
  { name: "31 Mai", consumo: 1980, volume: 3420 },
];

const refuels = [
  { machine: "Trator John Deere 6120J", code: "TR-018", liters: "186 L", date: "Hoje, 08:42", status: "Concluído", icon: Tractor, tone: "green" },
  { machine: "Caminhão Mercedes Atego", code: "CV-042", liters: "124 L", date: "Hoje, 07:18", status: "Concluído", icon: Truck, tone: "blue" },
  { machine: "Colheitadeira S790", code: "CH-007", liters: "312 L", date: "Ontem, 17:36", status: "Concluído", icon: Tractor, tone: "amber" },
  { machine: "Trator New Holland T7", code: "TR-021", liters: "154 L", date: "Ontem, 15:10", status: "Concluído", icon: Tractor, tone: "violet" },
];

const fleet = [
  { name: "Tratores", amount: "18", detail: "16 ativos", icon: Tractor, tone: "green" },
  { name: "Veículos", amount: "24", detail: "22 ativos", icon: Truck, tone: "blue" },
  { name: "Implementos", amount: "31", detail: "29 ativos", icon: Settings2, tone: "amber" },
];

const alerts = [
  { title: "Manutenção próxima", detail: "Trator John Deere 6120J · 42h restantes", severity: "Atenção", color: "amber", icon: Wrench },
  { title: "Consumo acima da média", detail: "Caminhão CV-042 · +18% nos últimos 7 dias", severity: "Verificar", color: "red", icon: AlertTriangle },
  { title: "Documento atualizado", detail: "Licenciamento do veículo CV-038 renovado", severity: "Resolvido", color: "green", icon: CheckCircle2 },
];

function MetricCard({ label, value, unit, trend, note, icon: Icon, tone }: { label: string; value: string; unit?: string; trend: string; note: string; icon: typeof Fuel; tone: string }) {
  const positive = trend.startsWith("+");
  return <article className="metric-card">
    <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
    <div className="metric-label">{label}<span className="metric-menu"><MoreHorizontal size={17} /></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-foot"><span className={positive ? "trend up" : "trend down"}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trend}</span><span>{note}</span></div>
  </article>;
}

export default function AndradePrototype() {
  const [section, setSection] = useState<Section>("Visão geral");
  const [period, setPeriod] = useState("30 dias");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredRefuels = useMemo(() => refuels.filter((row) => row.machine.toLowerCase().includes(query.toLowerCase())), [query]);

  return <div className="prototype-app">
    <aside className={`prototype-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Droplets size={17} /></div><div><strong>Andrade Agro</strong><span>Gestão inteligente</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X size={18} /></button></div>
      <div className="workspace"><span className="workspace-dot" /> Operação principal <ChevronRight size={14} /></div>
      <nav className="main-nav" aria-label="Navegação principal">
        <p className="nav-caption">MENU PRINCIPAL</p>
        {([ ["Visão geral", LayoutDashboard], ["Abastecimentos", Fuel], ["Frota", Truck], ["Alertas", Bell], ["Manutenção", Wrench] ] as const).map(([label, Icon]) => <button className={`nav-item ${section === label ? "active" : ""}`} key={label} onClick={() => { setSection(label); setSidebarOpen(false); }}><Icon size={18} /><span>{label}</span>{label === "Alertas" && <b>3</b>}</button>)}
        <p className="nav-caption secondary">CONFIGURAÇÃO</p>
        <button className="nav-item"><Settings2 size={18} /><span>Preferências</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="support-card"><ShieldCheck size={17} /><div><strong>Dados protegidos</strong><span>Ambiente demonstrativo</span></div></div><div className="profile"><div className="avatar">CA</div><div><strong>Caio Almeida</strong><span>Administrador</span></div><MoreHorizontal size={18} /></div></div>
    </aside>
    {sidebarOpen && <button className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Fechar navegação" />}
    <main className="prototype-main">
      <header className="topbar"><button className="menu-trigger" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button><div className="breadcrumb"><span>Andrade Agro</span><ChevronRight size={14} /><strong>{section}</strong></div><div className="top-actions"><label className="search"><Search size={17} /><input aria-label="Buscar" placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} /></label><button className="icon-button has-notification" aria-label="Notificações"><Bell size={19} /><i /></button><div className="top-avatar">CA</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><p className="eyebrow">QUARTA-FEIRA, 29 DE MAIO DE 2024</p><h1>{section === "Visão geral" ? "Bom dia, Caio" : section}</h1><p className="subheading">{section === "Visão geral" ? "Acompanhe a operação da sua frota em tempo real." : "Consulte os dados demonstrativos da operação."}</p></div><button className="primary-button"><Fuel size={16} /> Registrar abastecimento</button></div>
        {section === "Visão geral" ? <>
          <section className="metric-grid"><MetricCard label="Litros abastecidos" value="18.420" unit="L" trend="+12,8%" note="vs. mês anterior" icon={Droplets} tone="green" /><MetricCard label="Consumo máquinas" value="4,8" unit="L/h" trend="-4,2%" note="vs. mês anterior" icon={Gauge} tone="amber" /><MetricCard label="Consumo veículos" value="3,2" unit="km/L" trend="+6,4%" note="vs. mês anterior" icon={Truck} tone="blue" /><MetricCard label="Frota operacional" value="92" unit="%" trend="+2,1%" note="vs. mês anterior" icon={ShieldCheck} tone="violet" /></section>
          <section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-header"><div><h2>Consumo de combustível</h2><p>Volume consumido ao longo do período</p></div><div className="period-tabs">{["7 dias", "30 dias", "90 dias"].map((item) => <button className={period === item ? "selected" : ""} key={item} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><div className="chart-legend"><span><i className="legend-dot green-dot" /> Consumo (L)</span><span><i className="legend-dot blue-dot" /> Abastecimentos</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="consumption" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a3e635" stopOpacity={0.32}/><stop offset="95%" stopColor="#a3e635" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#263b38" strokeDasharray="3 3"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#718681", fontSize: 11 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#718681", fontSize: 11 }} width={40}/><Tooltip contentStyle={{ background: "#152724", border: "1px solid #2b4540", borderRadius: 10, color: "#ecf5ee" }} /><Area type="monotone" dataKey="consumo" stroke="#b6e55b" strokeWidth={3} fill="url(#consumption)" /></AreaChart></ResponsiveContainer></div></article><article className="panel fleet-panel"><div className="panel-header"><div><h2>Situação da frota</h2><p>Visão geral dos ativos</p></div><button className="text-button" onClick={() => setSection("Frota")}>Ver frota <ChevronRight size={15} /></button></div><div className="fleet-total"><div className="fleet-ring"><strong>73</strong><span>ativos</span></div><div><strong>73 de 79</strong><p>Ativos em operação</p><div className="mini-progress"><i /></div><small>92% de disponibilidade</small></div></div><div className="fleet-list">{fleet.map(({ name, amount, detail, icon: Icon, tone }) => <div className="fleet-row" key={name}><span className={`fleet-icon ${tone}`}><Icon size={17} /></span><div><strong>{name}</strong><small>{detail}</small></div><b>{amount}</b></div>)}</div></article></section>
          <section className="lower-grid"><article className="panel table-panel"><div className="panel-header"><div><h2>Abastecimentos recentes</h2><p>Últimos registros da operação</p></div><button className="text-button" onClick={() => setSection("Abastecimentos")}>Ver todos <ChevronRight size={15} /></button></div><div className="table-wrap"><table><thead><tr><th>Ativo</th><th>Data</th><th>Volume</th><th>Status</th></tr></thead><tbody>{filteredRefuels.map(({ machine, code, liters, date, status, icon: Icon, tone }) => <tr key={code}><td><div className="asset-cell"><span className={`asset-icon ${tone}`}><Icon size={16} /></span><span><strong>{machine}</strong><small>{code}</small></span></div></td><td>{date}</td><td><strong>{liters}</strong></td><td><span className="status-pill"><i />{status}</span></td></tr>)}</tbody></table></div></article><article className="panel alerts-panel"><div className="panel-header"><div><h2>Alertas importantes</h2><p>Demandam sua atenção</p></div><button className="round-button" onClick={() => setSection("Alertas")} aria-label="Ver alertas"><ChevronRight size={17} /></button></div><div className="alerts-list">{alerts.map(({ title, detail, severity, color, icon: Icon }) => <div className="alert-row" key={title}><span className={`alert-icon ${color}`}><Icon size={16} /></span><div><strong>{title}</strong><p>{detail}</p><span className={`alert-severity ${color}`}>{severity}</span></div></div>)}</div></article></section>
        </> : <section className="panel placeholder-panel"><div className="placeholder-icon"><ClipboardList size={30} /></div><h2>{section}</h2><p>Esta visão demonstrativa está pronta para receber os dados da operação. Use os controles da navegação para explorar o protótipo.</p><div className="placeholder-stats"><div><Clock3 size={18}/><strong>24 registros</strong><span>no período selecionado</span></div><div><CheckCircle2 size={18}/><strong>92% ativos</strong><span>situação operacional</span></div><div><AlertTriangle size={18}/><strong>3 alertas</strong><span>pendências abertas</span></div></div></section>}
      </div>
      <footer className="prototype-footer"><span>Andrade Agro · Protótipo independente</span><span>Dados demonstrativos · Última atualização: agora</span></footer>
    </main>
  </div>;
}
