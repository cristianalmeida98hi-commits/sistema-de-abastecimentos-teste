import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { alerts, isHourBased, machines, tanks, weekly, type MachineType } from "./data";

const nav = ["Painel", "Abastecimentos", "Frota", "Manutenção", "Alertas", "Relatórios"];
const filters: ("Todos" | MachineType)[] = ["Todos", "Trator", "Colheitadeira", "Caminhão", "Utilitário"];

const tick = { fill: "var(--muted-foreground)", fontSize: 12 };

export function PrototypeApp() {
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState("Painel");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todos");

  const list = machines.filter((m) => filter === "Todos" || m.type === filter);
  const hourly = machines.filter((m) => isHourBased(m.type)).map((m) => ({ name: m.id, valor: m.consumption, meta: m.target }));
  const road = machines.filter((m) => !isHourBased(m.type)).map((m) => ({ name: m.id, valor: m.consumption, meta: m.target }));
  const total = weekly.reduce((s, d) => s + d.litros, 0);

  const Sidebar = (
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold tracking-tight text-foreground">Andrade Agro</p>
        <p className="text-xs text-muted-foreground">Protótipo · dados fictícios</p>
      </div>
      {nav.map((n) => (
        <button
          key={n}
          onClick={() => { setActive(n); setMenu(false); }}
          className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${active === n ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          {n}
        </button>
      ))}
      <Link to="/" className="mt-6 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">← Voltar ao sistema</Link>
    </nav>
  );

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-card lg:block">{Sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-background/80" onClick={() => setMenu(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-card">{Sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <button aria-label="Abrir menu" onClick={() => setMenu(true)} className="rounded-md border border-border px-2.5 py-1.5 text-sm lg:hidden">☰</button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{active}</h1>
            <p className="text-xs text-muted-foreground">Semana atual · safra fictícia</p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-8">
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Litros na semana", total.toLocaleString("pt-BR") + " L"],
              ["Média tratores", "15,0 L/h"],
              ["Média veículos", "5,4 km/L"],
              ["Máquinas ativas", `${machines.filter((m) => m.status === "Operando").length}/${machines.length}`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-card p-4">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums md:text-2xl">{v}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg bg-card p-4 lg:col-span-2">
              <h2 className="mb-4 text-sm font-medium">Abastecimento diário (L)</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={tick} axisLine={false} tickLine={false} />
                    <YAxis tick={tick} axisLine={false} tickLine={false} width={40} />
                    <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                    <Bar dataKey="litros" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4">
              <h2 className="mb-4 text-sm font-medium">Tanques</h2>
              <div className="space-y-4">
                {tanks.map((t) => (
                  <div key={t.name}>
                    <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{t.name}</span><span className="tabular-nums">{t.level}%</span></div>
                    <div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${t.level < 40 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${t.level}%` }} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">{Math.round((t.capacity * t.level) / 100).toLocaleString("pt-BR")} de {t.capacity.toLocaleString("pt-BR")} L</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            {[
              { title: "Tratores e colheitadeiras (L/h)", data: hourly, note: "Menor é melhor" },
              { title: "Caminhões e utilitários (km/L)", data: road, note: "Maior é melhor" },
            ].map((c) => (
              <div key={c.title} className="rounded-lg bg-card p-4">
                <h2 className="text-sm font-medium">{c.title}</h2>
                <p className="mb-4 text-xs text-muted-foreground">{c.note}</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={c.data}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
                      <YAxis tick={tick} axisLine={false} tickLine={false} width={32} />
                      <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                      <Bar dataKey="valor" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="meta" fill="var(--muted-foreground)" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg bg-card p-4 lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Frota</h2>
                <div className="flex flex-wrap gap-1">
                  {filters.map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{f}</button>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-border">
                {list.map((m) => {
                  const unit = isHourBased(m.type) ? "L/h" : "km/L";
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.id} · {m.meter.toLocaleString("pt-BR")} {isHourBased(m.type) ? "h" : "km"}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums">{m.consumption.toLocaleString("pt-BR")} {unit}</p>
                        <p className={`text-xs ${m.status === "Operando" ? "text-primary" : m.status === "Manutenção" ? "text-chart-4" : "text-muted-foreground"}`}>{m.status}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-lg bg-card p-4">
              <h2 className="mb-4 text-sm font-medium">Alertas</h2>
              <ul className="space-y-3">
                {alerts.map((a) => (
                  <li key={a.text} className="flex gap-3 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.level === "alto" ? "bg-destructive" : a.level === "medio" ? "bg-chart-4" : "bg-muted-foreground"}`} />
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
