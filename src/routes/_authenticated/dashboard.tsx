import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const pid = patient.id;
    const now = new Date();
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    (async () => {
      const [a, m, e, d, al, ec] = await Promise.all([
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
      ]);
      setAppointments((a.data ?? []) as Appointment[]);
      setMedications((m.data ?? []) as Medication[]);
      setEvents((e.data ?? []) as ClinicalEvent[]);
      setDocuments((d.data ?? []) as Document[]);
      setAllergies((al.data ?? []) as Allergy[]);
      setContacts((ec.data ?? []) as EmergencyContact[]);
    })();
  }, [patient.id]);

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
              <MedicationRow key={m.id} med={m} />
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

function MedicationRow({ med }: { med: Medication }) {
  const times = med.schedule?.times ?? [];
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Pill className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {med.name}
          {med.dosage ? ` · ${med.dosage}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {times.length > 0 ? times.join(" · ") : "Sem horário"}
        </p>
      </div>
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
