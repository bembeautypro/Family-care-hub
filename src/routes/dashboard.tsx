import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { onboardingRouteForStep } from "@/lib/onboarding/redirect";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Início — Amparo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth/login" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, onboarding_step")
        .eq("id", data.user.id)
        .maybeSingle();
      const step = profile?.onboarding_step ?? 0;
      if (step < 3) {
        navigate({ to: onboardingRouteForStep(step) });
        return;
      }
      setName(profile?.full_name ?? null);
    })();
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo</p>
          <h1 className="text-2xl font-bold">{name ?? "..."}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sair
        </Button>
      </header>

      <section className="mt-10 rounded-2xl border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">Tudo pronto!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O painel completo será montado nos próximos passos do produto.
        </p>
        <Button asChild className="mt-6 h-[52px] w-full">
          <Link to="/onboarding/primeira-acao">Ver primeira ação</Link>
        </Button>
      </section>
    </main>
  );
}
