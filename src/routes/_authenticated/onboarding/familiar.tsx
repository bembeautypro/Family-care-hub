import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OnboardingProgress } from "@/components/onboarding/ProgressBar";

export const Route = createFileRoute("/onboarding/familiar")({
  head: () => ({ meta: [{ title: "Adicionar familiar — Amparo" }] }),
  component: Familiar,
});

const RELATIONS = [
  "Pai",
  "Mãe",
  "Avô",
  "Avó",
  "Cônjuge",
  "Irmão(ã)",
  "Outro",
];

const ACCEPTED_MIME = ["image/jpeg", "image/png"];

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  birthDate: z.string().optional(),
  relationship: z.string().min(1, "Selecione o parentesco"),
});

function Familiar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    birthDate: "",
    relationship: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error("Use apenas JPEG ou PNG");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(familyId: string, patientId: string): Promise<string | null> {
    if (!photoFile) return null;
    const ext = photoFile.type === "image/png" ? "png" : "jpg";
    const path = `${familyId}/${patientId}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from("medical-documents")
      .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
    if (error) {
      console.warn("avatar upload failed", error);
      return null;
    }
    return path;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const familyId = sessionStorage.getItem("amparo_onboarding_family_id");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      let fid = familyId;
      if (!fid) {
        const { data: fam } = await supabase
          .from("family_members")
          .select("family_id")
          .eq("user_id", userId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        fid = fam?.family_id ?? null;
      }
      if (!fid) throw new Error("Família não encontrada");

      const { data: patient, error: patErr } = await supabase
        .from("patients")
        .insert({
          family_id: fid,
          name: parsed.data.name,
          birth_date: parsed.data.birthDate || null,
          notes: `Parentesco: ${parsed.data.relationship}`,
          created_by: userId,
        })
        .select("id")
        .single();
      if (patErr) throw patErr;

      const photoPath = await uploadPhoto(fid, patient.id);
      if (photoPath) {
        await supabase
          .from("patients")
          .update({ photo_url: photoPath })
          .eq("id", patient.id);
      }

      await supabase
        .from("profiles")
        .update({ onboarding_step: 2 })
        .eq("id", userId);

      sessionStorage.setItem("amparo_onboarding_patient_id", patient.id);
      navigate({ to: "/onboarding/emergencia" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao adicionar familiar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <OnboardingProgress current={4} total={5} />

      <header className="mt-8">
        <h1 className="text-2xl font-bold text-foreground">
          Quem você quer organizar primeiro?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você poderá adicionar mais pessoas depois.
        </p>
      </header>

      <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-input bg-muted text-muted-foreground"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8" />
            )}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" />
            {photoPreview ? "Trocar foto" : "Adicionar foto"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-[52px]"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth">Data de nascimento</Label>
          <Input
            id="birth"
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="h-[52px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Grau de parentesco</Label>
          <Select
            value={form.relationship}
            onValueChange={(v) => setForm({ ...form, relationship: v })}
          >
            <SelectTrigger className="h-[52px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-[52px] w-full text-base"
        >
          {loading ? "Salvando..." : "Continuar"}
        </Button>
      </form>
    </main>
  );
}
