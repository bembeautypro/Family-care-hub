import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  ClinicalEventForm,
  type ClinicalEventInitial,
} from "@/components/eventos/ClinicalEventForm";

export const Route = createFileRoute("/_authenticated/eventos/$id/editar")({
  head: () => ({ meta: [{ title: "Editar evento — Amparo" }] }),
  component: EditarEvento,
});

function EditarEvento() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<ClinicalEventInitial | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("clinical_events")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error || !data) {
        toast.error("Evento não encontrado.");
        navigate({ to: "/historico" });
        return;
      }
      setInitial(data as ClinicalEventInitial);
      setPatientId(data.patient_id);
      setLoading(false);
    })();
  }, [id, navigate]);

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      <Link
        to="/historico"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Editar evento</h1>

      <div className="mt-6">
        {loading || !initial || !patientId ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <ClinicalEventForm
            patientId={patientId}
            initial={initial}
            onSaved={() => navigate({ to: "/historico" })}
          />
        )}
      </div>
    </main>
  );
}
