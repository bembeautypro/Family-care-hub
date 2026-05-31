import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, MoreVertical, Pencil, Repeat, CheckCircle2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PatientSelector } from "@/components/patients/PatientSelector";
import { usePatients } from "@/hooks/useActivePatient";
import { formatDateTime, statusMeta, typeMeta } from "@/lib/agenda";

export const Route = createFileRoute("/agenda/")({
  head: () => ({ meta: [{ title: "Agenda — Amparo" }] }),
  component: AgendaList,
});

type Appointment = {
  id: string;
  type: string;
  title: string;
  scheduled_at: string;
  location: string | null;
  status: string;
  responsible_user_id: string | null;
  parent_appointment_id: string | null;
};

type Profile = { id: string; full_name: string | null; photo_url: string | null };

type TabKey = "upcoming" | "done" | "cancelled";

function AgendaList() {
  const navigate = useNavigate();
  const { patients, active, activeId, setActiveId, loading: loadingPatients } = usePatients();
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [actionItem, setActionItem] = useState<Appointment | null>(null);
  const [toRemove, setToRemove] = useState<Appointment | null>(null);
  const [toComplete, setToComplete] = useState<Appointment | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Appointment | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  async function load() {
    if (!active) return;
    setItems(null);
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, type, title, scheduled_at, location, status, responsible_user_id, parent_appointment_id",
      )
      .eq("patient_id", active.id)
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setItems([]);
      return;
    }
    const list = (data ?? []) as Appointment[];
    setItems(list);

    const ids = Array.from(
      new Set(list.map((a) => a.responsible_user_id).filter(Boolean) as string[]),
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => {
        map[p.id] = p;
      });
      setProfiles(map);
    } else {
      setProfiles({});
    }
  }

  useEffect(() => {
    if (active) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Auto-hide follow-up banner after 8s
  useEffect(() => {
    if (!followUpFor) return;
    const t = setTimeout(() => setFollowUpFor(null), 8000);
    return () => clearTimeout(t);
  }, [followUpFor]);

  const now = new Date();
  const filtered = (items ?? []).filter((a) => {
    if (tab === "done") return a.status === "done";
    if (tab === "cancelled") return a.status === "cancelled";
    return (
      a.status !== "done" &&
      a.status !== "cancelled" &&
      new Date(a.scheduled_at) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
    );
  });

  async function confirmDone(a: Appointment) {
    // 1) update status
    const { error: e1 } = await supabase
      .from("appointments")
      .update({ status: "done" })
      .eq("id", a.id);
    if (e1) {
      toast.error(e1.message);
      return;
    }
    // 2) check existing clinical_event
    const { data: existing } = await supabase
      .from("clinical_events")
      .select("id")
      .eq("appointment_id", a.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("clinical_events").insert({
        patient_id: active!.id,
        appointment_id: a.id,
        type: "consultation",
        title: a.title,
        event_date: a.scheduled_at.slice(0, 10),
        created_by: u.user?.id ?? null,
      });
    }
    setToComplete(null);
    setActionItem(null);
    toast.success("Marcado como realizado.");
    setFollowUpFor(a);
    void load();
  }

  async function softDelete(a: Appointment) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("appointments")
      .update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id ?? null })
      .eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setToRemove(null);
    setActionItem(null);
    toast.success("Compromisso arquivado.");
    void load();
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      {patients && patients.length > 1 && (
        <PatientSelector patients={patients} activeId={activeId} onChange={setActiveId} />
      )}

      <main className="mx-auto max-w-md space-y-4 px-5 py-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Agenda</h1>
          <Button asChild size="sm" className="h-10">
            <Link to="/agenda/nova">+ Novo</Link>
          </Button>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">Próximos</TabsTrigger>
            <TabsTrigger value="done">Realizados</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          </TabsList>
        </Tabs>

        {loadingPatients || items === null ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : !active ? (
          <p className="text-sm text-muted-foreground">Nenhum paciente ativo.</p>
        ) : filtered.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                responsible={a.responsible_user_id ? profiles[a.responsible_user_id] ?? null : null}
                onOpenActions={() => setActionItem(a)}
              />
            ))}
          </ul>
        )}
      </main>

      {/* Ações */}
      <Sheet open={!!actionItem} onOpenChange={(o) => !o && setActionItem(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">{actionItem?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2 pb-6">
            {actionItem && actionItem.status !== "done" && (
              <ActionButton
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Marcar como realizado"
                onClick={() => {
                  setToComplete(actionItem);
                  setActionItem(null);
                }}
              />
            )}
            <ActionButton
              icon={<Pencil className="h-5 w-5" />}
              label="Editar"
              onClick={() => {
                if (actionItem) navigate({ to: `/agenda/${actionItem.id}/editar` });
              }}
            />
            {actionItem && !actionItem.parent_appointment_id && (
              <ActionButton
                icon={<Repeat className="h-5 w-5" />}
                label="Criar retorno"
                onClick={() => {
                  if (actionItem)
                    navigate({
                      to: "/agenda/nova",
                      search: { parent: actionItem.id },
                    });
                }}
              />
            )}
            <ActionButton
              icon={<Trash2 className="h-5 w-5 text-destructive" />}
              label="Remover"
              danger
              onClick={() => {
                if (actionItem) {
                  setToRemove(actionItem);
                  setActionItem(null);
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Etapa 1: confirmar realização */}
      <AlertDialog open={!!toComplete} onOpenChange={(o) => !o && setToComplete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar que esta consulta foi realizada?</AlertDialogTitle>
            <AlertDialogDescription>{toComplete?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toComplete && confirmDone(toComplete)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação remover */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {toRemove?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este compromisso será arquivado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toRemove && softDelete(toRemove)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Etapa 2: banner não-bloqueante */}
      {followUpFor && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-4">
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Quer registrar as orientações desta consulta?</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const a = followUpFor;
                setFollowUpFor(null);
                navigate({ to: "/eventos/novo", search: { appointment: a.id } });
              }}
            >
              Agora
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFollowUpFor(null)}>
              Depois
            </Button>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setFollowUpFor(null)}
              className="ml-1 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left active:bg-muted ${
        danger ? "text-destructive" : ""
      }`}
    >
      {icon}
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}

function AppointmentCard({
  appointment,
  responsible,
  onOpenActions,
}: {
  appointment: Appointment;
  responsible: Profile | null;
  onOpenActions: () => void;
}) {
  const tm = typeMeta(appointment.type);
  const sm = statusMeta(appointment.status);
  const Icon = tm.icon;
  const initials =
    (responsible?.full_name ?? "")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-base font-semibold">{appointment.title}</p>
            <button
              type="button"
              onClick={onOpenActions}
              aria-label="Ações"
              className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDateTime(appointment.scheduled_at)}
          </p>
          {appointment.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {appointment.location}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            {responsible ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="h-5 w-5">
                  {responsible.photo_url ? <AvatarImage src={responsible.photo_url} /> : null}
                  <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                </Avatar>
                {responsible.full_name ?? "Sem nome"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Sem responsável</span>
            )}
            <Badge className={sm.className} variant="secondary">
              {sm.label}
            </Badge>
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const text =
    tab === "upcoming"
      ? "Nenhum compromisso agendado."
      : tab === "done"
      ? "Nenhum compromisso realizado."
      : "Nenhum compromisso cancelado.";
  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {tab === "upcoming" && (
        <Button asChild className="mt-4 h-[52px] w-full">
          <Link to="/agenda/nova">Agendar compromisso</Link>
        </Button>
      )}
    </div>
  );
}
