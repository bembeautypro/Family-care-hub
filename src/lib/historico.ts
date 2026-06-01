export type EventType =
  | "consultation"
  | "exam"
  | "hospitalization"
  | "surgery"
  | "symptom"
  | "fall_accident"
  | "medication_change"
  | "diagnosis"
  | "return"
  | "crisis"
  | "vaccine"
  | "family_note";

export type Severity = "low" | "medium" | "high" | "critical";

export const EVENT_TYPES: { value: EventType; label: string; icon: string }[] = [
  { value: "consultation", label: "Consulta", icon: "🩺" },
  { value: "exam", label: "Exame", icon: "🔬" },
  { value: "hospitalization", label: "Internação", icon: "🏥" },
  { value: "surgery", label: "Cirurgia", icon: "🔪" },
  { value: "symptom", label: "Sintoma", icon: "🤒" },
  { value: "fall_accident", label: "Queda ou acidente", icon: "🤸" },
  { value: "medication_change", label: "Alteração de medicamento", icon: "💊" },
  { value: "diagnosis", label: "Diagnóstico", icon: "📋" },
  { value: "return", label: "Retorno médico", icon: "🔁" },
  { value: "crisis", label: "Crise", icon: "⚡" },
  { value: "vaccine", label: "Vacina", icon: "💉" },
  { value: "family_note", label: "Observação familiar", icon: "📝" },
];

export const SEVERITIES: {
  value: Severity;
  label: string;
  dot: string;
  border: string;
  badge: string;
}[] = [
  {
    value: "low",
    label: "Baixa",
    dot: "⚪",
    border: "border-l-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
  },
  {
    value: "medium",
    label: "Média",
    dot: "🔵",
    border: "border-l-[oklch(0.6_0.15_240)]",
    badge: "bg-[oklch(0.95_0.04_240)] text-[oklch(0.4_0.15_240)]",
  },
  {
    value: "high",
    label: "Alta",
    dot: "🟠",
    border: "border-l-[oklch(0.7_0.18_50)]",
    badge: "bg-[oklch(0.95_0.05_50)] text-[oklch(0.45_0.18_50)]",
  },
  {
    value: "critical",
    label: "Crítica",
    dot: "🔴",
    border: "border-l-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
];

export function eventTypeMeta(value: string | null | undefined) {
  return EVENT_TYPES.find((t) => t.value === value) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

export function severityMeta(value: string | null | undefined) {
  return SEVERITIES.find((s) => s.value === value) ?? SEVERITIES[0];
}

export function formatEventDate(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
