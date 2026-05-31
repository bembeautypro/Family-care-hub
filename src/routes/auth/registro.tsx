import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, MailCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingProgress } from "@/components/onboarding/ProgressBar";

export const Route = createFileRoute("/auth/registro")({
  head: () => ({ meta: [{ title: "Criar conta — Amparo" }] }),
  component: Registro,
});

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome").max(100),
    email: z.string().trim().email("E-mail inválido").max(255),
    password: z.string().min(8, "Mínimo de 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

function Registro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirm: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding/familia`,
          data: { full_name: parsed.data.fullName },
        },
      });
      if (error) throw error;
      // With email confirmation required, session is null until the user clicks
      // the link. Show the verification screen.
      if (data.session) {
        // Edge case: project somehow auto-confirms — proceed directly.
        navigate({ to: "/onboarding/familia" });
        return;
      }
      setSubmittedEmail(parsed.data.email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar conta";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!submittedEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: submittedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding/familia`,
        },
      });
      if (error) throw error;
      toast.success("E-mail reenviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenviar");
    } finally {
      setResending(false);
    }
  }

  if (submittedEmail) {
    return (
      <main className="flex min-h-screen flex-col bg-background px-5 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <MailCheck className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Verifique seu e-mail
          </h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Enviamos um link de confirmação para{" "}
            <span className="font-medium text-foreground">{submittedEmail}</span>.
            Abra a mensagem e clique no link para continuar.
          </p>
        </div>

        <div className="flex flex-col gap-3 pb-4">
          <Button
            type="button"
            variant="outline"
            onClick={onResend}
            disabled={resending}
            className="h-[52px] w-full text-base"
          >
            {resending ? "Reenviando..." : "Reenviar e-mail"}
          </Button>
          <Button asChild className="h-[52px] w-full text-base">
            <Link to="/auth/login">Já confirmei — Entrar</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-6">
        <OnboardingProgress current={2} total={5} />
      </div>

      <header className="mt-8">
        <h1 className="text-2xl font-bold text-foreground">Criar sua conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Em segundos você começa a organizar.
        </p>
      </header>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="h-[52px]"
            autoComplete="name"
            required
          />
        </div>
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
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input
            id="confirm"
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="h-[52px]"
            autoComplete="new-password"
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-[52px] w-full text-base"
        >
          {loading ? "Criando..." : "Criar conta"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/auth/login" className="font-medium text-primary">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
