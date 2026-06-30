import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Heart, Pill, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/design")({
  head: () => ({
    meta: [
      { title: "Design system — Amparo" },
      { name: "description", content: "Preview interno de cores, tipografia e componentes do Amparo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignPreview,
});

const SWATCHES: { name: string; varName: string; fg?: string }[] = [
  { name: "background", varName: "--color-background", fg: "text-foreground" },
  { name: "foreground", varName: "--color-foreground", fg: "text-background" },
  { name: "primary", varName: "--color-primary", fg: "text-primary-foreground" },
  { name: "secondary", varName: "--color-secondary", fg: "text-secondary-foreground" },
  { name: "muted", varName: "--color-muted", fg: "text-muted-foreground" },
  { name: "accent", varName: "--color-accent", fg: "text-accent-foreground" },
  { name: "destructive", varName: "--color-destructive", fg: "text-destructive-foreground" },
  { name: "surface", varName: "--color-surface", fg: "text-foreground" },
  { name: "success", varName: "--color-success", fg: "text-primary-foreground" },
  { name: "warn", varName: "--color-warn", fg: "text-primary-foreground" },
  { name: "alert", varName: "--color-alert", fg: "text-primary-foreground" },
  { name: "border", varName: "--color-border", fg: "text-foreground" },
];

function DesignPreview() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Amparo · Cuida v1.0
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Design system preview
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Página interna para conferir rapidamente cores, tipografia, botões,
            inputs e cards em diferentes larguras. Redimensione a janela ou
            troque o dispositivo no preview.
          </p>
        </header>

        <Separator />

        {/* Typography */}
        <section className="space-y-5">
          <SectionTitle>Tipografia · Plus Jakarta Sans</SectionTitle>
          <div className="space-y-3">
            <p style={{ fontSize: "var(--fs-display)" }} className="font-bold leading-tight">
              Display 40 · Aa Bb Cc
            </p>
            <h1 className="text-[32px] font-bold leading-tight">H1 32 · A saúde da sua família</h1>
            <h2 className="text-2xl font-semibold">H2 24 · Próximos compromissos</h2>
            <h3 className="text-xl font-semibold">H3 20 · Medicamentos ativos</h3>
            <p className="text-[17px]">Lg 17 · Texto de leitura mais confortável</p>
            <p className="text-[15px]">Body 15 · Parágrafo padrão usado em cards e formulários.</p>
            <p className="text-[13px] text-muted-foreground">Sm 13 · Descrições e legendas.</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Xs 11 · Rótulos auxiliares
            </p>
          </div>
        </section>

        {/* Colors */}
        <section className="space-y-5">
          <SectionTitle>Cores semânticas</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SWATCHES.map((s) => (
              <div
                key={s.name}
                className="flex h-24 flex-col justify-between rounded-2xl border border-border p-3 shadow-sm"
                style={{ backgroundColor: `var(${s.varName})` }}
              >
                <span className={`text-sm font-semibold ${s.fg ?? "text-foreground"}`}>
                  {s.name}
                </span>
                <span className={`text-[11px] font-mono ${s.fg ?? "text-foreground"} opacity-80`}>
                  {s.varName}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-5">
          <SectionTitle>Botões</SectionTitle>
          <div className="flex flex-wrap gap-3">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destrutivo</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg" className="h-[52px]">Large 52px</Button>
            <Button size="icon" aria-label="Buscar">
              <Search />
            </Button>
            <Button disabled>Desabilitado</Button>
          </div>
        </section>

        {/* Inputs */}
        <section className="space-y-5">
          <SectionTitle>Formulário</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ds-name">Nome</Label>
              <Input id="ds-name" placeholder="Ex.: Maria Silva" className="h-[52px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-email">E-mail</Label>
              <Input id="ds-email" type="email" placeholder="maria@exemplo.com" className="h-[52px]" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ds-notes">Observações</Label>
              <Textarea id="ds-notes" placeholder="Anotações livres..." rows={4} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-4 sm:col-span-2">
              <div>
                <Label htmlFor="ds-switch" className="text-base">Receber lembretes</Label>
                <p className="text-sm text-muted-foreground">
                  Notificações push nos horários dos medicamentos.
                </p>
              </div>
              <Switch id="ds-switch" defaultChecked />
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-5">
          <SectionTitle>Badges</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Badge>Padrão</Badge>
            <Badge variant="secondary">Secundário</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Crítico</Badge>
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-5">
          <SectionTitle>Cards</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Pill className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate">Losartana 50mg</CardTitle>
                  <CardDescription>1 comprimido · 08:00</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Próxima dose em 2 horas. Toque em "Tomei" para registrar.
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Tomei</Button>
                <Button size="sm" variant="outline">Adiar</Button>
              </CardFooter>
            </Card>

            <Card style={{ borderLeft: "4px solid var(--color-alert)" }}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate">Pressão alta</CardTitle>
                  <CardDescription>Hoje · severidade alta</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Pico de 160/100 registrado. Avisar o cardiologista no retorno.
              </CardContent>
            </Card>

            <Card className="bg-secondary">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Heart className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate">Dona Helena</CardTitle>
                  <CardDescription>78 anos · mãe</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                3 medicamentos ativos · 2 compromissos esta semana.
              </CardContent>
              <CardFooter>
                <Button className="w-full">Abrir perfil</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Status banners */}
        <section className="space-y-5">
          <SectionTitle>Estados</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusBanner tone="success" title="Dose registrada" body="Losartana 50mg às 08:02." />
            <StatusBanner tone="warn" title="Atraso de 15min" body="Próxima dose passou do horário." />
            <StatusBanner tone="alert" title="Falta crítica" body="Sem registro há 3 doses seguidas." />
            <StatusBanner tone="accent" title="Novo familiar" body="Convite enviado para João." />
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

function StatusBanner({
  tone,
  title,
  body,
}: {
  tone: "success" | "warn" | "alert" | "accent";
  title: string;
  body: string;
}) {
  const map = {
    success: { bg: "var(--c-success-soft)", fg: "var(--c-success)" },
    warn: { bg: "var(--c-warn-soft)", fg: "var(--c-warn)" },
    alert: { bg: "var(--c-alert-soft)", fg: "var(--c-alert)" },
    accent: { bg: "var(--c-accent-soft)", fg: "var(--c-accent)" },
  }[tone];
  return (
    <div
      className="rounded-xl border border-border p-4"
      style={{ backgroundColor: map.bg }}
    >
      <p className="text-sm font-semibold" style={{ color: map.fg }}>
        {title}
      </p>
      <p className="text-sm text-foreground/80">{body}</p>
    </div>
  );
}
