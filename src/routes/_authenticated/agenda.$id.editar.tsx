import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  AppointmentForm,
  type AppointmentFormInitial,
} from "@/components/agenda/AppointmentForm";
import type { AppointmentStatus, AppointmentType } from "@/lib/agenda";

export const Route = createFileRoute("/_authenticated/agenda/$id/editar")({
  head: () => ({ meta: [{ title: "Editar compromisso — Amparo" }] }),
  component: EditarCompromisso,
});

function EditarCompromisso() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<AppointmentFormInitial | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [parentTitle, setParentTitle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        // gate em _authenticated/route.tsx garante usuário
        return;
      }
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error || !data) {
        toast.error("Compromisso não encontrado.");
        navigate({ to: "/agenda" });
        return;
      }
      if (data.patient_id) {
        const { data: pat } = await supabase
          .from("patients")
          .select("family_id")
          .eq("id", data.patient_id)
          .maybeSingle();
        setFamilyId(pat?.family_id ?? null);
      }
      if (data.parent_appointment_id) {
        const { data: parent } = await supabase
          .from("appointments")
          .select("title")
          .eq("id", data.parent_appointment_id)
          .maybeSingle();
        setParentTitle(parent?.title ?? null);
      }
      setInitial({
        type: (data.type as AppointmentType) ?? "consultation",
        title: data.title ?? "",
        scheduled_at: data.scheduled_at,
        location: data.location ?? "",
        address: data.address ?? "",
        map_url: data.map_url ?? "",
        doctor_name: data.doctor_name ?? "",
        specialty: data.specialty ?? "",
        responsible_user_id: data.responsible_user_id ?? "__none__",
        status: (data.status as AppointmentStatus) ?? "scheduled",
        notes: data.notes ?? "",
      });
    })();
  }, [id, navigate]);

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      <Link to="/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Agenda
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Editar compromisso</h1>

      <div className="mt-6">
        {!initial || !familyId ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <AppointmentForm
            initial={initial}
            familyId={familyId}
            parentTitle={parentTitle}
            saving={saving}
            submitLabel="Salvar alterações"
            onSave={async (v) => {
              setSaving(true);
              try {
                const { error } = await supabase
                  .from("appointments")
                  .update({
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
                  })
                  .eq("id", id);
                if (error) throw error;
                toast.success("Alterações salvas.");
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
