import { createFileRoute } from "@tanstack/react-router";

function Stub({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 pb-24">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Em construção.</p>
    </main>
  );
}

export const Route = createFileRoute("/medicamentos")({
  head: () => ({ meta: [{ title: "Medicamentos — Amparo" }] }),
  component: () => <Stub title="Medicamentos" />,
});
