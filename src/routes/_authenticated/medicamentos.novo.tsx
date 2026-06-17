import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/hooks/useActivePatient";
import { MedicationForm } from "@/components/medicamentos/MedicationForm";

export const Route = createFileRoute("/medicamentos/novo")({
  head: () => ({ meta: [{ title: "Novo medicamento — Amparo" }] }),
  component: NovoMedicamento,
});

function NovoMedicamento() {
  const navigate = useNavigate();
  const { active, loading } = usePatients();
  const [saving, setSaving] = useState(false);
  const [medId, setMedId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      <Link
        to="/medicamentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Medicamentos
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Novo medicamento</h1>

      <div className="mt-6">
        {loading || !active ? (
          <p className="text-sm text-muted-foreground">Carregando paciente...</p>
        ) : (
          <MedicationForm
            patientId={active.id}
            medicationId={medId}
            saving={saving}
            submitLabel={medId ? "Salvar alterações" : "Salvar medicamento"}
            onSave={async (v) => {
              setSaving(true);
              try {
                if (medId) {
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
                    .eq("id", medId);
                  if (error) throw error;
                  toast.success("Salvo.");
                  navigate({ to: "/medicamentos" });
                  return;
                }
                const { data, error } = await supabase
                  .from("medications")
                  .insert({
                    patient_id: active.id,
                    name: v.name,
                    generic_name: v.generic_name || null,
                    dosage: v.dosage || null,
                    frequency: v.frequency,
                    schedule: v.schedule,
                    start_date: v.start_date || null,
                    end_date: v.end_date || null,
                    prescribed_by: v.prescribed_by || null,
                    notes: v.notes || null,
                    status: "active",
                  })
                  .select("id")
                  .single();
                if (error) throw error;
                setMedId(data.id);
                toast.success("Medicamento criado. Você pode anexar uma foto agora.");
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
