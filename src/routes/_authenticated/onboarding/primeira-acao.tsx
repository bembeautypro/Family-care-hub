import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill, FileText, Calendar, Siren } from "lucide-react";

export const Route = createFileRoute("/onboarding/primeira-acao")({
  head: () => ({ meta: [{ title: "Primeira ação — Amparo" }] }),
  component: PrimeiraAcao,
});

const ACTIONS = [
  { to: "/medicamentos/novo", icon: Pill, label: "Adicionar medicamento", emoji: "💊" },
  { to: "/documentos/novo", icon: FileText, label: "Subir receita ou exame", emoji: "📄" },
  { to: "/agenda/nova", icon: Calendar, label: "Criar consulta", emoji: "📅" },
  { to: "/emergencia", icon: Siren, label: "Criar resumo de emergência", emoji: "🆘" },
] as const;

function PrimeiraAcao() {
  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <header className="mt-4">
        <h1 className="text-2xl font-bold text-foreground">
          O que você quer organizar agora?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha um ponto de partida. Você pode fazer todos depois.
        </p>
      </header>

      <div className="mt-8 grid gap-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-colors hover:bg-accent"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                <span aria-hidden>{a.emoji}</span>
                <Icon className="sr-only" />
              </div>
              <span className="text-base font-medium text-foreground">{a.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir para o início →
        </Link>
      </div>
    </main>
  );
}
