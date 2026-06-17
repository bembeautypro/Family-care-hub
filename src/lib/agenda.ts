import { Stethoscope, FlaskConical, Repeat, Hospital, Activity, Syringe, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const APPOINTMENT_TYPES = [
  { value: "consultation", label: "Consulta", icon: Stethoscope },
  { value: "exam", label: "Exame", icon: FlaskConical },
  { value: "return", label: "Retorno", icon: Repeat },
  { value: "procedure", label: "Procedimento", icon: Hospital },
  { value: "therapy", label: "Fisioterapia", icon: Activity },
  { value: "vaccine", label: "Vacinação", icon: Syringe },
  { value: "other", label: "Outro", icon: FileText },
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number]["value"];

export function typeMeta(value: string): { label: string; icon: LucideIcon } {
  const found = APPOINTMENT_TYPES.find((t) => t.value === value);
  return found ?? { label: value, icon: FileText };
}

export const APPOINTMENT_STATUSES = [
  { value: "scheduled", label: "Agendado", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  { value: "confirmed", label: "Confirmado", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  { value: "done", label: "Realizado", className: "bg-muted text-foreground hover:bg-muted" },
  { value: "cancelled", label: "Cancelado", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  { value: "rescheduled", label: "Remarcado", className: "bg-amber-100 text-amber-900 hover:bg-amber-100" },
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]["value"];

export function statusMeta(value: string) {
  return (
    APPOINTMENT_STATUSES.find((s) => s.value === value) ?? {
      value,
      label: value,
      className: "bg-muted text-muted-foreground",
    }
  );
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function joinDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
