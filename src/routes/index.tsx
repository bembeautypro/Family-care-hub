import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Amparo — A saúde da sua família em um só lugar" },
      {
        name: "description",
        content:
          "Organize remédios, exames, consultas e emergências de quem você cuida.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <main className="flex min-h-screen flex-col bg-background px-5 py-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <Heart className="h-10 w-10 text-primary" strokeWidth={2.2} />
        </div>
        <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          A saúde da sua família em um só lugar.
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          Organize remédios, exames, consultas e informações de emergência de
          quem você cuida.
        </p>
      </div>

      <div className="flex flex-col gap-4 pb-4">
        <Button asChild size="lg" className="h-[52px] w-full text-base">
          <Link to="/auth/registro">Começar organização</Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Já tenho conta{" "}
          <Link
            to="/auth/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            → Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
