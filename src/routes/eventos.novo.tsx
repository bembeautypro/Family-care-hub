import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/hooks/useActivePatient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  appointment: z.string().uuid().optional(),
});

const EVENT_TYPES = [
  { value: "consultation", label: "Consulta" },
  { value: "exam", label: "Exame" },
  { value: "diagnosis", label: "Diagnóstico" },
  { value: "procedure", label: "Procedimento" },
  { value: "hospitalization", label: "Internação" },
  { value: "other", label: "Outro" },
];

const SEVERITIES = [
  { value: "low", label: "Leve" },
  { value: "medium", label: "Moderada" },
  { value: "high", label: "Grave" },
];

export const Route = createFileRoute("/eventos/novo")({
  head: () => ({ meta: [{ title: "Novo evento clínico — Amparo" }] }),
  validateSearch: searchSchema,
  component: NovoEvento,
});

function NovoEvento() {
  const navigate = useNavigate();
  const { appointment } = Route.useSearch();
  const { active, loading } = usePatients();
  const [eventId, setEventId] = useState<string | null>(null);
  const [type, setType] = useState("consultation");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("low");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  // If appointment provided, load existing clinical_event (auto-created at "mark done") to edit it
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
        setEventId(ev.id);
        setType(ev.type ?? "consultation");
        setTitle(ev.title ?? "");
        setDate(ev.event_date ?? new Date().toISOString().slice(0, 10));
        setDescription(ev.description ?? "");
        setSeverity(ev.severity ?? "low");
        return;
      }
      const { data: appt } = await supabase
        .from("appointments")
        .select("title, scheduled_at")
        .eq("id", appointment)
        .maybeSingle();
      if (appt) {
        setTitle(appt.title);
        setDate(appt.scheduled_at.slice(0, 10));
      }
    })();
  }, [appointment]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    if (!title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        title: title.trim(),
        event_date: date,
        description: description.trim() || null,
        severity,
      };
      if (eventId) {
        const { error } = await supabase
          .from("clinical_events")
          .update(payload)
          .eq("id", eventId);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("clinical_events").insert({
          patient_id: active.id,
          appointment_id: appointment ?? null,
          created_by: u.user?.id ?? null,
          ...payload,
        });
        if (error) throw error;
      }
      toast.success("Evento salvo.");
      navigate({ to: appointment ? "/agenda" : "/historico" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      <Link
        to={appointment ? "/agenda" : "/historico"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {eventId ? "Registrar orientações" : "Novo evento clínico"}
      </h1>

      <div className="mt-6">
        {loading || !active ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-[52px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-[52px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-[52px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Gravidade</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-[52px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição / orientações</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Anote as orientações, diagnóstico ou observações."
              />
            </div>

            <Button type="submit" className="h-[52px] w-full text-base" disabled={saving}>
              {saving ? "Salvando..." : "Salvar evento"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
