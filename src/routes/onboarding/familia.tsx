import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OnboardingProgress } from "@/components/onboarding/ProgressBar";
import { createFamilyWithAdmin } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/onboarding/familia")({
  head: () => ({ meta: [{ title: "Criar família — Amparo" }] }),
  component: Familia,
});

const ROLES = [
  { value: "filho", label: "Filho(a)" },
  { value: "conjuge", label: "Cônjuge" },
  { value: "cuidador", label: "Cuidador(a)" },
  { value: "outro", label: "Outro" },
] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Dê um nome à família").max(100),
  role: z.enum(["filho", "conjuge", "cuidador", "outro"]),
});

function Familia() {
  const navigate = useNavigate();
  const createFamily = useServerFn(createFamilyWithAdmin);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ name: string; role: "filho" | "conjuge" | "cuidador" | "outro" }>(
    { name: "", role: "filho" },
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const result = await createFamily({ data: parsed.data });
      sessionStorage.setItem("amparo_onboarding_family_id", result.familyId);
      sessionStorage.setItem("amparo_onboarding_role", result.role);
      navigate({ to: "/onboarding/familiar" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar família";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <OnboardingProgress current={3} total={5} />

      <header className="mt-8">
        <h1 className="text-2xl font-bold text-foreground">Crie sua família</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Um espaço compartilhado para organizar a saúde de quem você cuida.
        </p>
      </header>

      <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Nome da família</Label>
          <Input
            id="name"
            placeholder="Ex.: Família Silva"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-[52px]"
            required
          />
        </div>

        <div className="space-y-3">
          <Label>Seu papel</Label>
          <RadioGroup
            value={form.role}
            onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}
            className="grid grid-cols-2 gap-3"
          >
            {ROLES.map((r) => (
              <label
                key={r.value}
                htmlFor={`role-${r.value}`}
                className={`flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  form.role === r.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-input bg-background text-muted-foreground"
                }`}
              >
                <RadioGroupItem id={`role-${r.value}`} value={r.value} className="sr-only" />
                {r.label}
              </label>
            ))}
          </RadioGroup>
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
