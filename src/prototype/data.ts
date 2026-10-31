// Dados 100% fictícios — protótipo visual, sem conexão com o sistema real.
export type MachineType = "Trator" | "Colheitadeira" | "Caminhão" | "Utilitário";
export type Status = "Operando" | "Manutenção" | "Parado";

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  status: Status;
  meter: number; // horas ou km
  consumption: number; // L/h ou km/L
  target: number;
}

export const machines: Machine[] = [
  { id: "T-01", name: "Trator Modelo A", type: "Trator", status: "Operando", meter: 4210, consumption: 14.2, target: 15 },
  { id: "T-02", name: "Trator Modelo B", type: "Trator", status: "Operando", meter: 3120, consumption: 17.8, target: 15 },
  { id: "T-03", name: "Trator Modelo C", type: "Trator", status: "Manutenção", meter: 6890, consumption: 13.1, target: 14 },
  { id: "C-01", name: "Colheitadeira X", type: "Colheitadeira", status: "Operando", meter: 2450, consumption: 28.4, target: 30 },
  { id: "C-02", name: "Colheitadeira Y", type: "Colheitadeira", status: "Parado", meter: 1980, consumption: 33.9, target: 30 },
  { id: "V-01", name: "Caminhão Graneleiro", type: "Caminhão", status: "Operando", meter: 182300, consumption: 2.9, target: 3.0 },
  { id: "V-02", name: "Caminhão Comboio", type: "Caminhão", status: "Operando", meter: 96400, consumption: 3.4, target: 3.2 },
  { id: "U-01", name: "Utilitário 4x4", type: "Utilitário", status: "Operando", meter: 54100, consumption: 9.8, target: 10 },
];

export const isHourBased = (t: MachineType) => t === "Trator" || t === "Colheitadeira";

export const weekly = [
  { day: "Seg", litros: 1820 },
  { day: "Ter", litros: 2140 },
  { day: "Qua", litros: 1960 },
  { day: "Qui", litros: 2380 },
  { day: "Sex", litros: 2210 },
  { day: "Sáb", litros: 1340 },
  { day: "Dom", litros: 620 },
];

export const tanks = [
  { name: "Tanque central — S10", level: 72, capacity: 15000 },
  { name: "Tanque central — S500", level: 38, capacity: 10000 },
  { name: "Comboio", level: 55, capacity: 4000 },
];

export const alerts = [
  { level: "alto", text: "Trator Modelo B consumindo 18% acima da meta" },
  { level: "medio", text: "Tanque S500 abaixo de 40% — programar compra" },
  { level: "medio", text: "Trator Modelo C: troca de filtro em 50 h" },
  { level: "baixo", text: "Colheitadeira Y parada há 2 dias" },
] as const;
