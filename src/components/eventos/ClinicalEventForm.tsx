import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  EVENT_TYPES,
  SEVERITIES,
  type EventType,
  type Severity,
} from "@/lib/historico";

export type ClinicalEventInitial = {
  id?: string;
  type?: EventType | string | null;
  title?: string | null;
  event_date?: string | null;
  description?: string | null;
  severity?: Severity | string | null;
  tags?: string[] | null;
  doctor_name?: string | null;
};

type Props = {
  patientId: string;
  appointmentId?: string | null;
  initial?: ClinicalEventInitial | null;
  onSaved: (id: string) => void;
};

export function ClinicalEventForm({ patientId, appointmentId, initial, onSaved }: Props) {
  const [type, setType] = useState<EventType>(((initial?.type as EventType) ?? "consultation"));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState<Date>(() =>
    initial?.event_date ? new Date(`${initial.event_date}T12:00:00`) : new Date(),
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [severity, setSeverity] = useState<Severity>(((initial?.severity as Severity) ?? "low"));
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [doctorName, setDoctorName] = useState(initial?.doctor_name ?? "");
  const [saving, setSaving] = useState(false);

  function addTag(raw: string) {
    const t = raw.trim().replace(/,$/, "").trim();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags(tags.slice(0, -1));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const eventDate = format(date, "yyyy-MM-dd");
      const payload = {
        type,
        title: title.trim(),
        event_date: eventDate,
        description: description.trim() || null,
        severity,
        tags: tags.length ? tags : null,
        doctor_name: doctorName.trim() || null,
      };
      if (initial?.id) {
        const { error } = await supabase
          .from("clinical_events")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
        toast.success("Evento atualizado.");
        onSaved(initial.id);
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("clinical_events")
          .insert({
            patient_id: patientId,
            appointment_id: appointmentId ?? null,
            created_by: u.user?.id ?? null,
            ...payload,
          })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Evento criado.");
        onSaved(data.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={type} onValueChange={(v) => setType(v as EventType)}>
          <SelectTrigger className="h-[52px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <span className="mr-2">{t.icon}</span>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Data do evento</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn("h-[52px] w-full justify-start text-left font-normal")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "PPP", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              locale={ptBR}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
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
        <Label htmlFor="desc">Descrição</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Detalhes, orientações, observações..."
        />
      </div>

      <div className="space-y-2">
        <Label>Gravidade</Label>
        <div className="grid grid-cols-2 gap-2">
          {SEVERITIES.map((s) => {
            const active = severity === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setSeverity(s.value)}
                className={cn(
                  "flex h-[52px] items-center justify-center gap-2 rounded-lg border text-sm font-medium",
                  active ? "border-primary bg-primary/5" : "border-border bg-card",
                )}
              >
                <span>{s.dot}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={() => {
            if (tagInput.trim()) {
              addTag(tagInput);
              setTagInput("");
            }
          }}
          className="h-[52px]"
          placeholder="Pressione Enter ou vírgula para adicionar"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  aria-label={`Remover ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="doctor">Médico relacionado</Label>
        <Input
          id="doctor"
          value={doctorName}
          onChange={(e) => setDoctorName(e.target.value)}
          className="h-[52px]"
          placeholder="Dr(a). Nome Sobrenome"
        />
      </div>

      <Button type="submit" className="h-[52px] w-full text-base" disabled={saving}>
        {saving ? "Salvando..." : "Salvar evento"}
      </Button>
    </form>
  );
}
