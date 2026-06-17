import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MoreVertical, Pill, Pause, Play, CheckCircle2, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { type MedStatus, nextTimeToday } from "@/lib/medicamentos";

export const Route = createFileRoute("/medicamentos/")({
  head: () => ({ meta: [{ title: "Medicamentos — Amparo" }] }),
  component: MedicamentosList,
});

type Medication = {
  id: string;
  name: string;
  generic_name: string | null;
  dosage: string | null;
  frequency: string | null;
  status: MedStatus;
  schedule: { times?: string[] } | null;
};

const STATUS_BADGE: Record<MedStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  paused: { label: "Pausado", className: "bg-amber-100 text-amber-900 hover:bg-amber-100" },
  ended: { label: "Encerrado", className: "bg-muted text-muted-foreground hover:bg-muted" },
};

function MedicamentosList() {
  const navigate = useNavigate();
  const { patients, active, activeId, setActiveId, loading: loadingPatients } = usePatients();
  const [tab, setTab] = useState<MedStatus>("active");
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [actionMed, setActionMed] = useState<Medication | null>(null);
  const [toRemove, setToRemove] = useState<Medication | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  async function load() {
    if (!active) return;
    setMeds(null);
    const { data, error } = await supabase
      .from("medications")
      .select("id, name, generic_name, dosage, frequency, status, schedule")
      .eq("patient_id", active.id)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) {
      toast.error(error.message);
      setMeds([]);
      return;
    }
    setMeds((data ?? []) as Medication[]);
  }

  useEffect(() => {
    if (active) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  async function setStatus(med: Medication, status: MedStatus) {
    const { error } = await supabase
      .from("medications")
      .update({ status })
      .eq("id", med.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Atualizado.");
    setActionMed(null);
    void load();
  }

  async function softDelete(med: Medication) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("medications")
      .update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id ?? null })
      .eq("id", med.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Medicamento arquivado.");
    setToRemove(null);
    setActionMed(null);
    void load();
  }

  const filtered = (meds ?? []).filter((m) => m.status === tab);

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      {patients && patients.length > 1 && (
        <PatientSelector patients={patients} activeId={activeId} onChange={setActiveId} />
      )}

      <main className="mx-auto max-w-md space-y-4 px-5 py-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Medicamentos</h1>
          <Button asChild size="sm" className="h-10">
            <Link to="/medicamentos/novo">+ Novo</Link>
          </Button>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as MedStatus)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="paused">Pausados</TabsTrigger>
            <TabsTrigger value="ended">Encerrados</TabsTrigger>
          </TabsList>
        </Tabs>

        {loadingPatients || meds === null ? (
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
            {filtered.map((m) => (
              <MedCard key={m.id} med={m} onOpenActions={() => setActionMed(m)} />
            ))}
          </ul>
        )}
      </main>

      {/* Bottom sheet ações */}
      <Sheet open={!!actionMed} onOpenChange={(o) => !o && setActionMed(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">{actionMed?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2 pb-6">
            <ActionButton
              icon={<Pencil className="h-5 w-5" />}
              label="Editar"
              onClick={() => {
                if (actionMed) navigate({ to: `/medicamentos/${actionMed.id}/editar` });
              }}
            />
            {actionMed?.status === "active" && (
              <ActionButton
                icon={<Pause className="h-5 w-5" />}
                label="Pausar"
                onClick={() => actionMed && setStatus(actionMed, "paused")}
              />
            )}
            {actionMed?.status === "paused" && (
              <ActionButton
                icon={<Play className="h-5 w-5" />}
                label="Reativar"
                onClick={() => actionMed && setStatus(actionMed, "active")}
              />
            )}
            {actionMed?.status !== "ended" && (
              <ActionButton
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Encerrar uso"
                onClick={() => actionMed && setStatus(actionMed, "ended")}
              />
            )}
            <ActionButton
              icon={<Trash2 className="h-5 w-5 text-destructive" />}
              label="Remover"
              danger
              onClick={() => {
                if (actionMed) {
                  setToRemove(actionMed);
                  setActionMed(null);
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {toRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este medicamento será arquivado.
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

function MedCard({ med, onOpenActions }: { med: Medication; onOpenActions: () => void }) {
  const next = nextTimeToday(med.schedule?.times);
  const badge = STATUS_BADGE[med.status];
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Pill className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{med.name}</p>
              {med.generic_name && (
                <p className="truncate text-xs text-muted-foreground">{med.generic_name}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenActions}
              aria-label="Ações"
              className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[med.dosage, med.frequency].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {next ? `Próximo: ${next}` : "Sem horário"}
            </span>
            <Badge className={badge.className} variant="secondary">
              {badge.label}
            </Badge>
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ tab }: { tab: MedStatus }) {
  const copy = {
    active: { text: "Nenhum medicamento ativo.", cta: "Adicionar medicamento" },
    paused: { text: "Nenhum medicamento pausado.", cta: "Ver ativos" },
    ended: { text: "Nenhum medicamento encerrado.", cta: "Ver ativos" },
  }[tab];
  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <p className="text-sm text-muted-foreground">{copy.text}</p>
      {tab === "active" && (
        <Button asChild className="mt-4 h-[52px] w-full">
          <Link to="/medicamentos/novo">{copy.cta}</Link>
        </Button>
      )}
    </div>
  );
}
