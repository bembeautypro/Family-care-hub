import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, AlertCircle, X, History as HistoryIcon, Trash2 } from "lucide-react";

import {
  AlertTriangle,
  ChevronRight,
  FileText,
  Pill,
  Siren,
  Stethoscope,
  User as UserIcon,
  Activity,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { Fab } from "@/components/layout/Fab";
import { PatientSelector } from "@/components/patients/PatientSelector";
import { usePatients, ageFromBirthDate, type Patient } from "@/hooks/useActivePatient";
import { onboardingRouteForStep } from "@/lib/onboarding/redirect";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Início — Amparo" }] }),
  component: Dashboard,
});

type Appointment = {
  id: string;
  type: string;
  title: string;
  scheduled_at: string;
  responsible_user_id: string | null;
};
type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  schedule: { times?: string[] } | null;
};
type ClinicalEvent = {
  id: string;
  event_date: string;
  type: string;
  title: string;
  severity: string | null;
};
type Document = {
  id: string;
  type: string;
  title: string;
  document_date: string | null;
  created_at: string | null;
};
type Allergy = { id: string; severity: string | null };
type EmergencyContact = { id: string };
type DoseStatus = "taken" | "skipped";
type DoseRecord = {
  id: string;
  medication_id: string;
  scheduled_at: string;
  taken_at: string;
  status: DoseStatus;
};

// Build today's scheduled datetimes for a med from its "HH:MM" times
function todayScheduledTimes(times: string[] | undefined): Date[] {
  if (!times?.length) return [];
  const out: Date[] = [];
  const now = new Date();
  for (const t of times) {
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    out.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0));
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string | null; photo_url: string | null } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const { patients, active, activeId, setActiveId, loading: loadingPatients } = usePatients();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth/login" });
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, photo_url, onboarding_step")
        .eq("id", data.user.id)
        .maybeSingle();
      const step = p?.onboarding_step ?? 0;
      if (step < 3) {
        navigate({ to: onboardingRouteForStep(step) });
        return;
      }
      setProfile({ full_name: p?.full_name ?? null, photo_url: p?.photo_url ?? null });
      setAuthChecked(true);
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader userName={profile?.full_name} userPhoto={profile?.photo_url} />
      {patients && patients.length > 1 && (
        <PatientSelector patients={patients} activeId={activeId} onChange={setActiveId} />
      )}

      <main className="mx-auto max-w-md px-5 py-4 space-y-4">
        {!authChecked || loadingPatients ? (
          <DashboardSkeleton />
        ) : !active ? (
          <EmptyFamily />
        ) : (
          <PatientDashboard patient={active} />
        )}
      </main>

      <Fab />
      <BottomNav />
    </div>
  );
}

function EmptyFamily() {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <h2 className="text-lg font-semibold">Nenhum familiar cadastrado</h2>
      <p className="mt-2 text-sm text-muted-foreground">Adicione o familiar que você cuida para começar.</p>
      <Button asChild className="mt-4 h-[52px] w-full">
        <Link to="/onboarding/familiar">Cadastrar familiar</Link>
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

function PatientDashboard({ patient }: { patient: Patient }) {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [medications, setMedications] = useState<Medication[] | null>(null);
  const [events, setEvents] = useState<ClinicalEvent[] | null>(null);
  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [allergies, setAllergies] = useState<Allergy[] | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [doses, setDoses] = useState<DoseRecord[] | null>(null);

  const pid = patient.id;

  const loadDoses = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const { data } = await supabase
      .from("medication_doses")
      .select("id, medication_id, scheduled_at, taken_at, status")
      .eq("patient_id", pid)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end);
    setDoses((data ?? []) as DoseRecord[]);
  }, [pid]);

  useEffect(() => {
    let cancelled = false;
    // reset state when patient changes so stale data does not flash
    setAppointments(null);
    setMedications(null);
    setEvents(null);
    setDocuments(null);
    setAllergies(null);
    setContacts(null);
    setDoses(null);

    const now = new Date();
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    (async () => {
      const [a, m, e, d, al, ec, ds] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, type, title, scheduled_at, responsible_user_id")
          .eq("patient_id", pid)
          .is("deleted_at", null)
          .gte("scheduled_at", startOfDay)
          .lte("scheduled_at", in7.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(10),
        supabase
          .from("medications")
          .select("id, name, dosage, schedule")
          .eq("patient_id", pid)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("name", { ascending: true })
          .limit(20),
        supabase
          .from("clinical_events")
          .select("id, event_date, type, title, severity")
          .eq("patient_id", pid)
          .is("deleted_at", null)
          .order("event_date", { ascending: false })
          .limit(3),
        supabase
          .from("documents")
          .select("id, type, title, document_date, created_at")
          .eq("patient_id", pid)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("patient_allergies")
          .select("id, severity")
          .eq("patient_id", pid)
          .is("deleted_at", null),
        supabase
          .from("emergency_contacts")
          .select("id")
          .eq("patient_id", pid)
          .is("deleted_at", null),
        supabase
          .from("medication_doses")
          .select("id, medication_id, scheduled_at, taken_at, status")
          .eq("patient_id", pid)
          .gte("scheduled_at", startOfDay)
          .lt("scheduled_at", endOfDay),
      ]);
      if (cancelled) return;
      setAppointments((a.data ?? []) as Appointment[]);
      setMedications((m.data ?? []) as Medication[]);
      setEvents((e.data ?? []) as ClinicalEvent[]);
      setDocuments((d.data ?? []) as Document[]);
      setAllergies((al.data ?? []) as Allergy[]);
      setContacts((ec.data ?? []) as EmergencyContact[]);
      setDoses((ds.data ?? []) as DoseRecord[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [pid]);

  const pendencies = useMemo(() => {
    const list: { label: string; to: string }[] = [];
    if (contacts && contacts.length === 0) {
      list.push({ label: "Perfil de emergência incompleto", to: "/onboarding/emergencia" });
    }
    appointments?.forEach((a) => {
      if (!a.responsible_user_id) list.push({ label: `Consulta "${a.title}" sem responsável`, to: "/agenda" });
    });
    medications?.forEach((m) => {
      if (!m.schedule?.times || m.schedule.times.length === 0) {
        list.push({ label: `${m.name} sem horário cadastrado`, to: "/medicamentos" });
      }
    });
    return list;
  }, [contacts, appointments, medications]);

  const hasCriticalAllergy = allergies?.some((a) => a.severity === "high") ?? false;
  const hasMedWithoutSchedule = medications?.some((m) => !m.schedule?.times?.length) ?? false;
  const profileIncomplete = (contacts?.length ?? 0) === 0;
  const criticalAlerts = [
    hasCriticalAllergy ? "Alergia crítica" : null,
    hasMedWithoutSchedule ? "Medicamento sem horário" : null,
    profileIncomplete ? "Perfil incompleto" : null,
  ].filter(Boolean) as string[];

  return (
    <>
      {/* Bloco 1 */}
      <PatientCard patient={patient} alerts={criticalAlerts} />

      {/* Bloco 2 */}
      <Section title="Próximos compromissos" linkTo="/agenda" linkLabel="Ver todos">
        {appointments === null ? (
          <Skeleton className="h-20 w-full" />
        ) : appointments.length === 0 ? (
          <EmptyRow text="Nenhum compromisso agendado" ctaTo="/agenda/nova" ctaLabel="Agendar consulta" />
        ) : (
          <ul className="space-y-2">
            {appointments.slice(0, 3).map((a) => (
              <AppointmentRow key={a.id} appointment={a} />
            ))}
          </ul>
        )}
      </Section>

      {/* Bloco 3 */}
      <Section title="Medicamentos ativos" linkTo="/medicamentos" linkLabel="Ver todos">
        {medications === null ? (
          <Skeleton className="h-20 w-full" />
        ) : medications.length === 0 ? (
          <EmptyRow text="Nenhum medicamento cadastrado" ctaTo="/medicamentos/novo" ctaLabel="Adicionar" />
        ) : (
          <ul className="space-y-2">
            {medications.slice(0, 4).map((m) => (
              <MedicationRow key={m.id} med={m} patientId={pid} doses={doses ?? []} onChange={loadDoses} />
            ))}
          </ul>
        )}
      </Section>

      {/* Bloco 4 */}
      {pendencies.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
          <h3 className="flex items-center gap-2 text-base font-semibold text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            Pendências
          </h3>
          <ul className="mt-3 space-y-2">
            {pendencies.map((p, i) => (
              <li key={i}>
                <Link
                  to={p.to as never}
                  className="flex items-center justify-between text-sm text-amber-900 dark:text-amber-100"
                >
                  <span>{p.label}</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bloco 5 */}
      <Section title="Últimos eventos" linkTo="/historico" linkLabel="Ver histórico completo">
        {events === null ? (
          <Skeleton className="h-20 w-full" />
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </Section>

      {/* Bloco 6 */}
      <Section title="Documentos recentes" linkTo="/documentos" linkLabel="Ver todos os documentos">
        {documents === null ? (
          <Skeleton className="h-20 w-full" />
        ) : documents.length === 0 ? (
          <EmptyRow text="Nenhum documento ainda" ctaTo="/documentos/novo" ctaLabel="Subir documento" />
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function PatientCard({ patient, alerts }: { patient: Patient; alerts: string[] }) {
  const age = ageFromBirthDate(patient.birth_date);
  const initials = patient.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {patient.photo_url ? <AvatarImage src={patient.photo_url} alt={patient.name} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{patient.name}</h2>
          {age !== null && <p className="text-sm text-muted-foreground">{age} anos</p>}
        </div>
      </div>
      {alerts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {alerts.map((a) => (
            <Badge key={a} variant="destructive" className="text-[11px]">
              {a}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 gap-2">
        <Button asChild className="h-[52px] bg-destructive text-destructive-foreground hover:bg-destructive/90">
          <Link to="/emergencia">
            <Siren className="mr-2 h-5 w-5" />
            Emergência
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-[44px]">
          <Link to={"/familia" as never}>
            <UserIcon className="mr-2 h-4 w-4" />
            Ver perfil completo
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Section({
  title,
  linkTo,
  linkLabel,
  children,
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        {linkTo && linkLabel && (
          <Link to={linkTo as never} className="text-xs font-medium text-primary">
            {linkLabel} →
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function EmptyRow({ text, ctaTo, ctaLabel }: { text: string; ctaTo: string; ctaLabel: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link to={ctaTo as never} className="text-sm font-medium text-primary">
        {ctaLabel} +
      </Link>
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const date = new Date(appointment.scheduled_at);
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Stethoscope className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{appointment.title}</p>
        <p className="text-xs text-muted-foreground">{formatted}</p>
      </div>
    </li>
  );
}

function MedicationRow({
  med,
  patientId,
  doses,
  onChange,
}: {
  med: Medication;
  patientId: string;
  doses: DoseRecord[];
  onChange: () => void | Promise<void>;
}) {
  const times = med.schedule?.times ?? [];
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const scheduled = useMemo(() => todayScheduledTimes(times), [times]);
  const dosesForMed = useMemo(
    () => doses.filter((d) => d.medication_id === med.id),
    [doses, med.id],
  );
  const statusByTime = useMemo(() => {
    const map = new Map<number, DoseStatus>();
    for (const d of dosesForMed) map.set(new Date(d.scheduled_at).getTime(), d.status);
    return map;
  }, [dosesForMed]);

  const now = Date.now();
  const pending = scheduled.find((d) => !statusByTime.has(d.getTime()));
  const overdue = pending && pending.getTime() < now ? pending : null;
  const allDone = scheduled.length > 0 && !pending;
  const skippedToday = scheduled.some((d) => statusByTime.get(d.getTime()) === "skipped");

  async function recordDose(status: DoseStatus) {
    if (!pending || saving) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("medication_doses")
      .upsert(
        {
          medication_id: med.id,
          patient_id: patientId,
          scheduled_at: pending.toISOString(),
          taken_at: new Date().toISOString(),
          taken_by: u.user?.id ?? null,
          status,
        },
        { onConflict: "medication_id,scheduled_at" },
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "taken" ? "Tomada registrada." : "Marcado como não tomada.");
    await onChange();
  }

  const fmt = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <li className="rounded-lg border bg-background p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Pill className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium">
              {med.name}
              {med.dosage ? ` · ${med.dosage}` : ""}
            </p>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label="Ver histórico"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <HistoryIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {scheduled.length === 0
                ? "Sem horário"
                : pending
                  ? `Próxima: ${fmt(pending)}`
                  : "Todas as doses de hoje confirmadas"}
            </p>
            {overdue && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertCircle className="h-3 w-3" />
                Atrasado
              </Badge>
            )}
            {allDone && !skippedToday && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Check className="h-3 w-3" />
                OK
              </Badge>
            )}
            {skippedToday && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <X className="h-3 w-3" />
                Pulou dose
              </Badge>
            )}
          </div>
        </div>
      </div>
      {pending && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={overdue ? "destructive" : "default"}
            className="h-9"
            onClick={() => recordDose("taken")}
            disabled={saving}
          >
            <Check className="mr-1 h-4 w-4" />
            Tomei
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => recordDose("skipped")}
            disabled={saving}
          >
            <X className="mr-1 h-4 w-4" />
            Não tomei
          </Button>
        </div>
      )}
      <DoseHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        med={med}
        onChange={onChange}
      />
    </li>
  );
}

const SEVERITY_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
};

function EventRow({ event }: { event: ClinicalEvent }) {
  const date = new Date(event.event_date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Activity className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      {event.severity && (
        <Badge variant={SEVERITY_VARIANT[event.severity] ?? "secondary"} className="text-[10px]">
          {event.severity}
        </Badge>
      )}
    </li>
  );
}

function DocumentRow({ doc }: { doc: Document }) {
  const d = doc.document_date ?? doc.created_at;
  const date = d
    ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.title}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    </li>
  );
}

type DoseHistoryEntry = {
  id: string;
  scheduled_at: string;
  taken_at: string;
  status: DoseStatus;
};

function DoseHistorySheet({
  open,
  onOpenChange,
  med,
  onChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  med: Medication;
  onChange: () => void | Promise<void>;
}) {
  const [entries, setEntries] = useState<DoseHistoryEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(null);
    const { data, error } = await supabase
      .from("medication_doses")
      .select("id, scheduled_at, taken_at, status")
      .eq("medication_id", med.id)
      .order("scheduled_at", { ascending: false })
      .limit(60);
    if (error) {
      toast.error(error.message);
      setEntries([]);
      return;
    }
    setEntries((data ?? []) as DoseHistoryEntry[]);
  }, [med.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function toggleStatus(entry: DoseHistoryEntry) {
    setBusyId(entry.id);
    const next: DoseStatus = entry.status === "taken" ? "skipped" : "taken";
    const { error } = await supabase
      .from("medication_doses")
      .update({ status: next, taken_at: new Date().toISOString() })
      .eq("id", entry.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registro atualizado.");
    await load();
    await onChange();
  }

  async function remove(entry: DoseHistoryEntry) {
    setBusyId(entry.id);
    const { error } = await supabase.from("medication_doses").delete().eq("id", entry.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registro desfeito.");
    await load();
    await onChange();
  }

  // Group by YYYY-MM-DD of scheduled_at
  const groups = useMemo(() => {
    const out = new Map<string, DoseHistoryEntry[]>();
    for (const e of entries ?? []) {
      const d = new Date(e.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = out.get(key) ?? [];
      arr.push(e);
      out.set(key, arr);
    }
    return Array.from(out.entries());
  }, [entries]);

  const lastId = entries?.[0]?.id ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">{med.name}</SheetTitle>
          <SheetDescription className="text-left">
            Histórico de doses (últimos 60 registros)
          </SheetDescription>
        </SheetHeader>

        {entries === null ? (
          <div className="mt-4 space-y-2 pb-6">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : entries.length === 0 ? (
          <p className="mt-6 pb-6 text-center text-sm text-muted-foreground">
            Nenhuma dose registrada ainda.
          </p>
        ) : (
          <div className="mt-4 space-y-4 pb-6">
            {groups.map(([day, list]) => {
              const label = new Date(day + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              });
              return (
                <div key={day}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <ul className="space-y-2">
                    {list.map((e) => {
                      const sched = new Date(e.scheduled_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const taken = new Date(e.taken_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isLast = e.id === lastId;
                      return (
                        <li
                          key={e.id}
                          className="flex items-center gap-3 rounded-lg border bg-background p-3"
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              e.status === "taken"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {e.status === "taken" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {e.status === "taken" ? "Tomada" : "Não tomada"} · {sched}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Registrado às {taken}
                            </p>
                          </div>
                          {isLast && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() => toggleStatus(e)}
                                disabled={busyId === e.id}
                              >
                                {e.status === "taken" ? "Marcar não tomada" : "Marcar tomada"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => remove(e)}
                                disabled={busyId === e.id}
                                aria-label="Desfazer registro"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
