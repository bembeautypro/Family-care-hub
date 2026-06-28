import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { MoreVertical, Pencil, Archive } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/hooks/useActivePatient";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { Fab } from "@/components/layout/Fab";
import { PatientSelector } from "@/components/patients/PatientSelector";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EVENT_TYPES,
  SEVERITIES,
  eventTypeMeta,
  severityMeta,
  formatEventDate,
  type EventType,
  type Severity,
} from "@/lib/historico";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico clínico — Amparo" }] }),
  component: HistoricoPage,
});

type ClinicalEvent = {
  id: string;
  patient_id: string;
  type: string;
  title: string;
  description: string | null;
  event_date: string;
  severity: string | null;
  tags: string[] | null;
  doctor_name: string | null;
  created_by: string | null;
  creator_name?: string | null;
};

function HistoricoPage() {
  const navigate = useNavigate();
  const { patients, active, activeId, setActiveId, loading: patientsLoading } = usePatients();
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [events, setEvents] = useState<ClinicalEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionEvent, setActionEvent] = useState<ClinicalEvent | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<ClinicalEvent | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) // gate em _authenticated/route.tsx garante usuário
      else setUserId(data.user.id);
    });
  }, [navigate]);

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    let q = supabase
      .from("clinical_events")
      .select("id, patient_id, type, title, description, event_date, severity, tags, doctor_name, created_by")
      .eq("patient_id", active.id)
      .is("deleted_at", null)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (typeFilter !== "all") q = q.eq("type", typeFilter);
    if (severityFilter !== "all") q = q.eq("severity", severityFilter);

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setEvents([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as ClinicalEvent[];
    const creatorIds = Array.from(new Set(list.map((e) => e.created_by).filter(Boolean))) as string[];
    if (creatorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      list.forEach((e) => {
        e.creator_name = e.created_by ? map.get(e.created_by) ?? null : null;
      });
    }
    setEvents(list);
    setLoading(false);
  }, [active, typeFilter, severityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(ev: ClinicalEvent) {
    const { error } = await supabase
      .from("clinical_events")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", ev.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Evento arquivado.");
    setConfirmArchive(null);
    setActionEvent(null);
    void load();
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader userName={null} />
      {patients && patients.length > 1 && (
        <PatientSelector patients={patients} activeId={activeId} onChange={setActiveId} />
      )}

      <main className="px-5 pt-4">
        <h1 className="text-2xl font-bold">Histórico clínico</h1>

        {/* Type filter */}
        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
          <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
            Todos
          </FilterChip>
          {EVENT_TYPES.map((t) => (
            <FilterChip
              key={t.value}
              active={typeFilter === t.value}
              onClick={() => setTypeFilter(t.value)}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </FilterChip>
          ))}
        </div>

        {/* Severity filter */}
        <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
          <FilterChip active={severityFilter === "all"} onClick={() => setSeverityFilter("all")}>
            Todas
          </FilterChip>
          {SEVERITIES.map((s) => (
            <FilterChip
              key={s.value}
              active={severityFilter === s.value}
              onClick={() => setSeverityFilter(s.value)}
            >
              <span className="mr-1">{s.dot}</span>
              {s.label}
            </FilterChip>
          ))}
        </div>

        {/* List */}
        <div className="mt-5 space-y-3">
          {patientsLoading || loading ? (
            <>
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </>
          ) : !active ? (
            <p className="text-sm text-muted-foreground">Nenhum paciente cadastrado.</p>
          ) : events && events.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>
              <Button
                className="mt-4"
                onClick={() => navigate({ to: "/eventos/novo" })}
              >
                Adicionar primeiro evento
              </Button>
            </div>
          ) : (
            events?.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                expanded={expandedId === ev.id}
                onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                onAction={() => setActionEvent(ev)}
              />
            ))
          )}
        </div>
      </main>

      <Fab />
      <BottomNav />

      {/* Action sheet */}
      <Sheet open={!!actionEvent} onOpenChange={(o) => !o && setActionEvent(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">{actionEvent?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2 pb-6">
            <button
              className="flex min-h-[52px] items-center gap-3 rounded-xl border bg-card px-4 active:bg-muted"
              onClick={() => {
                if (actionEvent) {
                  navigate({ to: "/eventos/$id/editar", params: { id: actionEvent.id } });
                }
              }}
            >
              <Pencil className="h-5 w-5 text-primary" />
              <span className="text-base font-medium">Editar</span>
            </button>
            <button
              className="flex min-h-[52px] items-center gap-3 rounded-xl border bg-card px-4 active:bg-muted"
              onClick={() => {
                setConfirmArchive(actionEvent);
                setActionEvent(null);
              }}
            >
              <Archive className="h-5 w-5 text-destructive" />
              <span className="text-base font-medium">Arquivar</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm archive */}
      <AlertDialog open={!!confirmArchive} onOpenChange={(o) => !o && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              O evento "{confirmArchive?.title}" será removido da linha do tempo. Esta ação pode ser
              revertida apenas pelo suporte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmArchive && archive(confirmArchive)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EventCard({
  event,
  expanded,
  onToggle,
  onAction,
}: {
  event: ClinicalEvent;
  expanded: boolean;
  onToggle: () => void;
  onAction: () => void;
}) {
  const t = eventTypeMeta(event.type);
  const s = severityMeta(event.severity);
  return (
    <article
      className={cn(
        "relative rounded-xl border border-l-4 bg-card p-4 shadow-sm",
        s.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{formatEventDate(event.event_date)}</p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-semibold">
            <span aria-hidden>{t.icon}</span>
            <span className="truncate">{event.title}</span>
          </h3>
          {event.description && (
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "mt-1 block w-full text-left text-sm text-muted-foreground",
                !expanded && "line-clamp-2",
              )}
            >
              {event.description}
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                s.badge,
              )}
            >
              {s.label}
            </span>
            {event.doctor_name && (
              <span className="text-xs text-muted-foreground">{event.doctor_name}</span>
            )}
            {event.creator_name && (
              <span className="text-xs text-muted-foreground">· por {event.creator_name}</span>
            )}
          </div>
          {event.tags && event.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onAction}
          aria-label="Ações"
          className="-mr-2 -mt-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}
