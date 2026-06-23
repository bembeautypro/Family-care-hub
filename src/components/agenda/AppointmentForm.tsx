import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentStatus,
  type AppointmentType,
  joinDateTime,
  splitDateTime,
} from "@/lib/agenda";

export type AppointmentFormValues = {
  type: AppointmentType;
  title: string;
  scheduled_at: string;
  location: string;
  address: string;
  map_url: string;
  doctor_name: string;
  specialty: string;
  responsible_user_id: string;
  status: AppointmentStatus;
  notes: string;
};

export type AppointmentFormInitial = Partial<AppointmentFormValues>;

type Member = { user_id: string; full_name: string | null; photo_url: string | null };

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppointmentForm({
  initial,
  familyId,
  parentTitle,
  saving,
  submitLabel = "Salvar",
  onSave,
}: {
  initial?: AppointmentFormInitial;
  familyId: string;
  parentTitle?: string | null;
  saving: boolean;
  submitLabel?: string;
  onSave: (values: AppointmentFormValues) => Promise<void>;
}) {
  const now = splitDateTime(initial?.scheduled_at ?? new Date().toISOString());

  const [type, setType] = useState<AppointmentType>(initial?.type ?? "consultation");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [mapUrl, setMapUrl] = useState(initial?.map_url ?? "");
  const [doctor, setDoctor] = useState(initial?.doctor_name ?? "");
  const [specialty, setSpecialty] = useState(initial?.specialty ?? "");
  const [responsible, setResponsible] = useState<string>(
    initial?.responsible_user_id ?? "__none__",
  );
  const [status, setStatus] = useState<AppointmentStatus>(initial?.status ?? "scheduled");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    (async () => {
      const { data: fm } = await supabase
        .from("family_members")
        .select("user_id")
        .eq("family_id", familyId)
        .eq("status", "active");
      const ids = (fm ?? []).map((r) => r.user_id).filter(Boolean) as string[];
      if (ids.length === 0) {
        setMembers([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      setMembers(
        (profs ?? []).map((p) => ({
          user_id: p.id,
          full_name: p.full_name,
          photo_url: p.photo_url,
        })),
      );
    })();
  }, [familyId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    if (!date || !time) {
      toast.error("Informe data e hora.");
      return;
    }
    if (responsible === "__none__") {
      toast.error("Selecione o responsável por acompanhar.");
      return;
    }
    await onSave({
      type,
      title: title.trim(),
      scheduled_at: joinDateTime(date, time),
      location: location.trim(),
      address: address.trim(),
      map_url: mapUrl.trim(),
      doctor_name: doctor.trim(),
      specialty: specialty.trim(),
      responsible_user_id: responsible,
      status,
      notes: notes.trim(),
    });
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {parentTitle && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">Retorno de:</span>{" "}
          <span className="font-medium">{parentTitle}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
          <SelectTrigger className="h-[52px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </span>
                </SelectItem>
              );
            })}
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

      <div className="grid grid-cols-2 gap-3">
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
          <Label htmlFor="time">Hora</Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-[52px]"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Local</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="h-[52px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="h-[52px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="map">Link de mapa</Label>
        <Input
          id="map"
          type="url"
          placeholder="https://maps.google.com/..."
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          className="h-[52px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-2">
          <Label htmlFor="doctor">Médico / profissional</Label>
          <Input
            id="doctor"
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            className="h-[52px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialty">Especialidade</Label>
          <Input
            id="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="h-[52px]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Responsável por acompanhar *</Label>
        <Select value={responsible} onValueChange={setResponsible}>
          <SelectTrigger className="h-[52px]">
            <SelectValue placeholder="Selecionar familiar" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                <span className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    {m.photo_url ? <AvatarImage src={m.photo_url} /> : null}
                    <AvatarFallback className="text-[10px]">
                      {initials(m.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {m.full_name ?? "Sem nome"}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus)}>
          <SelectTrigger className="h-[52px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_STATUSES.filter((s) => s.value !== "done").map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <Button type="submit" className="h-[52px] w-full text-base" disabled={saving}>
        {saving ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
