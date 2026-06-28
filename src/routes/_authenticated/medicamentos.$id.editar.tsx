import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  MedicationForm,
  type MedicationFormInitial,
} from "@/components/medicamentos/MedicationForm";
import type { FrequencyValue } from "@/lib/medicamentos";

export const Route = createFileRoute("/_authenticated/medicamentos/$id/editar")({
  head: () => ({ meta: [{ title: "Editar medicamento — Amparo" }] }),
  component: EditarMedicamento,
});

function EditarMedicamento() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<MedicationFormInitial | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        // gate em _authenticated/route.tsx garante usuário
        return;
      }
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error || !data) {
        toast.error("Medicamento não encontrado.");
        navigate({ to: "/medicamentos" });
        return;
      }
      setPatientId(data.patient_id);
      const sched = (data.schedule ?? null) as { times?: string[] } | null;
      setInitial({
        name: data.name ?? "",
        generic_name: data.generic_name ?? "",
        dosage: data.dosage ?? "",
        frequency: (data.frequency as FrequencyValue) ?? "1x",
        times: sched?.times ?? [],
        start_date: data.start_date ?? "",
        end_date: data.end_date ?? "",
        prescribed_by: data.prescribed_by ?? "",
        notes: data.notes ?? "",
        file_path: data.file_path ?? null,
      });
    })();
  }, [id, navigate]);

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      <Link
        to="/medicamentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Medicamentos
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Editar medicamento</h1>

      <div className="mt-6">
        {!initial || !patientId ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <MedicationForm
            initial={initial}
            patientId={patientId}
            medicationId={id}
            saving={saving}
            submitLabel="Salvar alterações"
            onSave={async (v) => {
              setSaving(true);
              try {
                const { error } = await supabase
                  .from("medications")
                  .update({
                    name: v.name,
                    generic_name: v.generic_name || null,
                    dosage: v.dosage || null,
                    frequency: v.frequency,
                    schedule: v.schedule,
                    start_date: v.start_date || null,
                    end_date: v.end_date || null,
                    prescribed_by: v.prescribed_by || null,
                    notes: v.notes || null,
                  })
                  .eq("id", id);
                if (error) throw error;
                toast.success("Alterações salvas.");
                navigate({ to: "/medicamentos" });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erro ao salvar");
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
      </div>
    </main>
  );
}
