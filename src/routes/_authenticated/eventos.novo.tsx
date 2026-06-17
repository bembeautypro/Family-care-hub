import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/hooks/useActivePatient";
import {
  ClinicalEventForm,
  type ClinicalEventInitial,
} from "@/components/eventos/ClinicalEventForm";

const searchSchema = z.object({
  appointment: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/eventos/novo")({
  head: () => ({ meta: [{ title: "Novo evento clínico — Amparo" }] }),
  validateSearch: searchSchema,
  component: NovoEvento,
});

function NovoEvento() {
  const navigate = useNavigate();
  const { appointment } = Route.useSearch();
  const { active, loading } = usePatients();
  const [initial, setInitial] = useState<ClinicalEventInitial | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!appointment);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  useEffect(() => {
    if (!appointment) return;
    (async () => {
      const { data: ev } = await supabase
        .from("clinical_events")
        .select("*")
        .eq("appointment_id", appointment)
        .is("deleted_at", null)
        .maybeSingle();
      if (ev) {
        setInitial(ev as ClinicalEventInitial);
      } else {
        const { data: appt } = await supabase
          .from("appointments")
          .select("title, scheduled_at")
          .eq("id", appointment)
          .maybeSingle();
        if (appt) {
          setInitial({
            title: appt.title,
            event_date: appt.scheduled_at.slice(0, 10),
          });
        }
      }
      setLoadingInitial(false);
    })();
  }, [appointment]);

  const editing = !!initial?.id;

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      <Link
        to={appointment ? "/agenda" : "/historico"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {editing ? "Registrar orientações" : "Novo evento clínico"}
      </h1>

      <div className="mt-6">
        {loading || loadingInitial || !active ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <ClinicalEventForm
            patientId={active.id}
            appointmentId={appointment ?? null}
            initial={initial}
            onSaved={() => navigate({ to: appointment ? "/agenda" : "/historico" })}
          />
        )}
      </div>
    </main>
  );
}
