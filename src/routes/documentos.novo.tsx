import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/documentos/novo")({
  head: () => ({ meta: [{ title: "Novo documento — Amparo" }] }),
  component: () => (
    <main className="min-h-screen bg-background px-5 py-8 pb-24">
      <h1 className="text-2xl font-bold">Novo documento</h1>
      <p className="mt-2 text-sm text-muted-foreground">Em construção.</p>
    </main>
  ),
});
