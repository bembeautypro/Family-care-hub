import { useEffect, useState } from "react";
import { Camera, ImagePlus, Loader2, Upload, X } from "lucide-react";
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
import {
  FREQUENCIES,
  type FrequencyValue,
  timesCountFor,
  buildSchedule,
  isValidMime,
} from "@/lib/medicamentos";

export type MedicationFormValues = {
  name: string;
  generic_name: string;
  dosage: string;
  frequency: FrequencyValue;
  times: string[];
  start_date: string;
  end_date: string;
  prescribed_by: string;
  notes: string;
  file_path: string | null;
};

export type MedicationFormInitial = Partial<MedicationFormValues>;

const DEFAULT_TIMES: Record<number, string[]> = {
  1: ["08:00"],
  2: ["08:00", "20:00"],
  3: ["08:00", "14:00", "20:00"],
  4: ["06:00", "12:00", "18:00", "00:00"],
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function MedicationForm({
  initial,
  patientId,
  medicationId,
  onSave,
  saving,
  submitLabel = "Salvar",
}: {
  initial?: MedicationFormInitial;
  patientId: string;
  medicationId?: string;
  onSave: (
    values: Omit<MedicationFormValues, "times"> & { schedule: { times: string[] } },
  ) => Promise<void>;
  saving: boolean;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [generic, setGeneric] = useState(initial?.generic_name ?? "");
  const [dosage, setDosage] = useState(initial?.dosage ?? "");
  const [frequency, setFrequency] = useState<FrequencyValue>(initial?.frequency ?? "1x");
  const [times, setTimes] = useState<string[]>(initial?.times ?? DEFAULT_TIMES[1]);
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO());
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [doctor, setDoctor] = useState(initial?.prescribed_by ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [filePath, setFilePath] = useState<string | null>(initial?.file_path ?? null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const slots = timesCountFor(frequency);

  useEffect(() => {
    if (slots === 0) {
      setTimes([]);
      return;
    }
    setTimes((cur) => {
      const next = [...cur];
      while (next.length < slots) next.push(DEFAULT_TIMES[slots]?.[next.length] ?? "08:00");
      return next.slice(0, slots);
    });
  }, [slots]);

  useEffect(() => {
    if (!filePath) {
      setFileUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("medical-documents")
      .createSignedUrl(filePath, 3600)
      .then(({ data }) => {
        if (!cancelled) setFileUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!isValidMime(file)) {
      toast.error("Formato inválido. Use JPEG, PNG ou PDF.");
      return;
    }
    if (!medicationId) {
      toast.error("Salve o medicamento antes de anexar arquivo.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `patients/${patientId}/medications/${medicationId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("medical-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      if (filePath) {
        await supabase.storage.from("medical-documents").remove([filePath]);
      }
      await supabase.from("medications").update({ file_path: path }).eq("id", medicationId);
      setFilePath(path);
      toast.success("Arquivo anexado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    if (!filePath) return;
    setUploading(true);
    try {
      await supabase.storage.from("medical-documents").remove([filePath]);
      if (medicationId) {
        await supabase.from("medications").update({ file_path: null }).eq("id", medicationId);
      }
      setFilePath(null);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome do medicamento é obrigatório.");
      return;
    }
    if (slots > 0) {
      const sched = buildSchedule(times);
      if (sched.times.length !== slots) {
        toast.error("Preencha todos os horários.");
        return;
      }
    }
    await onSave({
      name: name.trim(),
      generic_name: generic.trim(),
      dosage: dosage.trim(),
      frequency,
      start_date: startDate,
      end_date: endDate,
      prescribed_by: doctor.trim(),
      notes: notes.trim(),
      file_path: filePath,
      schedule: buildSchedule(times),
    });
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">Nome do medicamento *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-[52px]"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="generic">Nome genérico</Label>
        <Input
          id="generic"
          value={generic}
          onChange={(e) => setGeneric(e.target.value)}
          className="h-[52px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dosage">Dosagem</Label>
        <Input
          id="dosage"
          placeholder="Ex.: 500mg"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          className="h-[52px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Frequência</Label>
        <Select value={frequency} onValueChange={(v) => setFrequency(v as FrequencyValue)}>
          <SelectTrigger className="h-[52px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {slots > 0 && (
        <div className="space-y-2">
          <Label>Horários</Label>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: slots }).map((_, i) => (
              <Input
                key={i}
                type="time"
                value={times[i] ?? ""}
                onChange={(e) => {
                  const next = [...times];
                  next[i] = e.target.value;
                  setTimes(next);
                }}
                className="h-[52px]"
                required
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start">Início</Label>
          <Input
            id="start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-[52px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">Término</Label>
          <Input
            id="end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-[52px]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="doctor">Médico que prescreveu</Label>
        <Input
          id="doctor"
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
          className="h-[52px]"
        />
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

      <div className="space-y-2">
        <Label>Foto da caixa ou receita</Label>
        {!medicationId ? (
          <p className="text-xs text-muted-foreground">
            Você poderá anexar uma foto após salvar o medicamento.
          </p>
        ) : filePath ? (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <a
              href={fileUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm text-primary"
            >
              Ver arquivo anexado
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeFile}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:hidden">
              <label className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background text-sm font-medium">
                <Camera className="h-4 w-4" />
                Tirar foto
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background text-sm font-medium">
                <ImagePlus className="h-4 w-4" />
                Galeria
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <label className="hidden h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-background text-sm text-muted-foreground md:flex">
              <Upload className="h-5 w-5" />
              Arraste ou clique para enviar (JPEG, PNG ou PDF)
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {uploading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
              </p>
            )}
          </>
        )}
      </div>

      <Button type="submit" className="h-[52px] w-full text-base" disabled={saving}>
        {saving ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
