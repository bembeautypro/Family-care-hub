import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/hooks/useActivePatient";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";

const searchSchema = z.object({
  parent: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/agenda/nova")({
  head: () => ({ meta: [{ title: "Novo compromisso — Amparo" }] }),
  validateSearch: searchSchema,
  component: NovoCompromisso,
});

function NovoCompromisso() {
  const navigate = useNavigate();
  const { parent } = Route.useSearch();
  const { active, loading } = usePatients();
  const [saving, setSaving] = useState(false);
  const [parentTitle, setParentTitle] = useState<string | null>(null);


  useEffect(() => {
    if (!parent) {
      setParentTitle(null);
      return;
    }
    supabase
      .from("appointments")
      .select("title")
      .eq("id", parent)
      .maybeSingle()
      .then(({ data }) => setParentTitle(data?.title ?? null));
  }, [parent]);

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      <Link to="/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Agenda
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {parent ? "Novo retorno" : "Novo compromisso"}
      </h1>

      <div className="mt-6">
        {loading || !active || !active.family_id ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <AppointmentForm
            familyId={active.family_id}
            parentTitle={parent ? parentTitle : null}
            initial={parent ? { type: "return" } : undefined}
            saving={saving}
            submitLabel="Salvar compromisso"
            onSave={async (v) => {
              setSaving(true);
              try {
                const { error } = await supabase.from("appointments").insert({
                  patient_id: active.id,
                  parent_appointment_id: parent ?? null,
                  type: v.type,
                  title: v.title,
                  scheduled_at: v.scheduled_at,
                  location: v.location || null,
                  address: v.address || null,
                  map_url: v.map_url || null,
                  doctor_name: v.doctor_name || null,
                  specialty: v.specialty || null,
                  responsible_user_id: v.responsible_user_id,
                  status: v.status,
                  notes: v.notes || null,
                });
                if (error) throw error;
                toast.success("Compromisso criado.");
                navigate({ to: "/agenda" });
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
