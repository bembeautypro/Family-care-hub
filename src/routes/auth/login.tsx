import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/familia.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardingRouteForStep } from "@/lib/onboarding/redirect";

const searchSchema = z.object({
  invite: z.string().optional(),
});

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Entrar — Amparo" }] }),
  validateSearch: (search) => searchSchema.parse(search),
  component: Login,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe a senha").max(72),
});

function Login() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const acceptInvite = useServerFn(acceptInvitation);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;

      // Accept pending invite if present
      if (search.invite) {
        try {
          const result = await acceptInvite({ data: { token: search.invite } });
          if (result.alreadyMember) {
            toast.info("Você já é membro desta família.");
          } else {
            toast.success("Convite aceito! Bem-vindo à família.");
          }
          navigate({ to: "/dashboard" });
          return;
        } catch (invErr) {
          toast.error(
            invErr instanceof Error ? invErr.message : "Erro ao aceitar convite",
          );
          // Continue to normal onboarding flow even if invite fails
        }
      }

      const userId = data.user?.id;
      let step = 0;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_step")
          .eq("id", userId)
          .maybeSingle();
        step = profile?.onboarding_step ?? 0;
      }
      navigate({ to: onboardingRouteForStep(step) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao entrar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mt-10">
        <h1 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entre para continuar organizando.
        </p>
      </header>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-[52px]"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="h-[52px]"
            autoComplete="current-password"
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-[52px] w-full text-base"
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link
            to="/auth/registro"
            search={search.invite ? { invite: search.invite } : {}}
            className="font-medium text-primary"
          >
            Criar conta
          </Link>
        </p>
      </form>
    </main>
  );
}
