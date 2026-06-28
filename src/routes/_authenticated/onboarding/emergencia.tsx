import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OnboardingProgress } from "@/components/onboarding/ProgressBar";

export const Route = createFileRoute("/_authenticated/onboarding/emergencia")({
  head: () => ({ meta: [{ title: "Dados de emergência — Amparo" }] }),
  component: Emergencia,
});

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"];
const SEVERITIES = [
  { value: "leve", label: "Leve", db: "low", className: "bg-yellow-100 text-yellow-900" },
  { value: "moderada", label: "Moderada", db: "medium", className: "bg-orange-100 text-orange-900" },
  { value: "grave", label: "Grave", db: "high", className: "bg-red-100 text-red-900" },
] as const;

type Allergy = { name: string; severity: "leve" | "moderada" | "grave" };

function phoneMask(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
}

function Emergencia() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const [bloodType, setBloodType] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [allergySev, setAllergySev] = useState<Allergy["severity"]>("leve");
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [insurance, setInsurance] = useState({ name: "", number: "" });
  const [contact, setContact] = useState({ name: "", rel: "", phone: "" });


  async function getPatientId(): Promise<{ patientId: string; userId: string }> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Sessão expirada");
    let pid = sessionStorage.getItem("amparo_onboarding_patient_id");
    if (!pid) {
      const { data: pat } = await supabase
        .from("patients")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      pid = pat?.id ?? null;
    }
    if (!pid) throw new Error("Paciente não encontrado");
    return { patientId: pid, userId };
  }

  async function finishOnboarding(userId: string) {
    await supabase
      .from("profiles")
      .update({ onboarding_step: 3 })
      .eq("id", userId);
    sessionStorage.removeItem("amparo_onboarding_family_id");
    sessionStorage.removeItem("amparo_onboarding_patient_id");
    sessionStorage.removeItem("amparo_onboarding_role");
    navigate({ to: "/onboarding/primeira-acao" });
  }

  async function onSkip() {
    setSkipping(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      await finishOnboarding(userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSkipping(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { patientId, userId } = await getPatientId();

      const updates: {
        blood_type?: string;
        health_insurance_name?: string;
        health_insurance_number?: string;
      } = {};
      if (bloodType && bloodType !== "Não sei") updates.blood_type = bloodType;
      if (insurance.name) updates.health_insurance_name = insurance.name;
      if (insurance.number) updates.health_insurance_number = insurance.number;
      if (Object.keys(updates).length > 0) {
        await supabase.from("patients").update(updates).eq("id", patientId);
      }

      if (allergies.length > 0) {
        await supabase.from("patient_allergies").insert(
          allergies.map((a) => ({
            patient_id: patientId,
            allergy: a.name,
            severity:
              SEVERITIES.find((s) => s.value === a.severity)?.db ?? "low",
          })),
        );
      }

      if (conditions.length > 0) {
        await supabase.from("patient_conditions").insert(
          conditions.map((c) => ({ patient_id: patientId, name: c })),
        );
      }

      if (contact.name && contact.phone) {
        await supabase.from("emergency_contacts").insert({
          patient_id: patientId,
          name: contact.name,
          relationship: contact.rel || null,
          phone: contact.phone,
          priority: 1,
        });
      }

      await finishOnboarding(userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  function addAllergy() {
    const name = allergyInput.trim();
    if (!name) return;
    setAllergies((prev) => [...prev, { name, severity: allergySev }]);
    setAllergyInput("");
  }
  function addCondition() {
    const name = conditionInput.trim();
    if (!name) return;
    setConditions((prev) => [...prev, name]);
    setConditionInput("");
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <OnboardingProgress current={5} total={5} />

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={skipping || loading}
          className="h-[44px] px-4 text-sm font-medium"
        >
          Preencher depois →
        </Button>
      </div>

      <header className="mt-8">
        <h1 className="text-2xl font-bold text-foreground">
          Preencha o essencial para emergências
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Essas informações ficam acessíveis em segundos durante uma emergência.
        </p>
      </header>

      <form className="mt-8 space-y-8" onSubmit={onSubmit}>
        <Section title="Para emergências">
          <div className="space-y-2">
            <Label>Tipo sanguíneo</Label>
            <Select value={bloodType} onValueChange={setBloodType}>
              <SelectTrigger className="h-[52px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Alergias</Label>
            <div className="flex gap-2">
              <Input
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                placeholder="Ex.: Penicilina"
                className="h-[52px] flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAllergy();
                  }
                }}
              />
              <Select value={allergySev} onValueChange={(v) => setAllergySev(v as Allergy["severity"])}>
                <SelectTrigger className="h-[52px] w-32">
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
            <Button type="button" variant="outline" onClick={addAllergy} className="w-full">
              Adicionar alergia
            </Button>
            {allergies.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {allergies.map((a, i) => {
                  const sev = SEVERITIES.find((s) => s.value === a.severity)!;
                  return (
                    <Badge
                      key={`${a.name}-${i}`}
                      variant="secondary"
                      className={`gap-1 ${sev.className}`}
                    >
                      {a.name} · {sev.label}
                      <button
                        type="button"
                        onClick={() => setAllergies((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        <Section title="Condições médicas">
          <div className="space-y-2">
            <Label>Adicionar condição</Label>
            <div className="flex gap-2">
              <Input
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                placeholder="Ex.: Diabetes tipo 2"
                className="h-[52px] flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCondition();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCondition}>
                Adicionar
              </Button>
            </div>
            {conditions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {conditions.map((c, i) => (
                  <Badge key={`${c}-${i}`} variant="secondary" className="gap-1">
                    {c}
                    <button
                      type="button"
                      onClick={() => setConditions((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Convênio">
          <div className="space-y-2">
            <Label>Nome do convênio</Label>
            <Input
              value={insurance.name}
              onChange={(e) => setInsurance({ ...insurance, name: e.target.value })}
              className="h-[52px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Número da carteirinha</Label>
            <Input
              value={insurance.number}
              onChange={(e) => setInsurance({ ...insurance, number: e.target.value })}
              className="h-[52px]"
            />
          </div>
        </Section>

        <Section title="Contato de emergência">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              className="h-[52px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Parentesco</Label>
            <Input
              value={contact.rel}
              onChange={(e) => setContact({ ...contact, rel: e.target.value })}
              className="h-[52px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: phoneMask(e.target.value) })}
              inputMode="tel"
              placeholder="(11) 99999-9999"
              className="h-[52px]"
            />
          </div>
        </Section>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-[52px] w-full text-base"
        >
          {loading ? "Salvando..." : "Salvar e continuar"}
        </Button>
      </form>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}
