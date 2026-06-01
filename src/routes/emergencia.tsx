import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Share2, Link2, ShieldOff, AlertTriangle, Phone, Pill } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PatientSelector } from "@/components/patients/PatientSelector";
import { usePatients } from "@/hooks/useActivePatient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/emergencia")({
  head: () => ({ meta: [{ title: "Central de Emergência — Amparo" }] }),
  component: EmergenciaPage,
});

type EmergencyLink = {
  id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  access_count: number | null;
  created_at: string;
};

type Allergy = {
  id: string;
  allergy: string;
  severity: string | null;
};

type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  status: string;
};

type Contact = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string;
  priority: number | null;
};

type PatientPreview = {
  blood_type: string | null;
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-700 border-gray-300",
};

function EmergenciaPage() {
  const navigate = useNavigate();
  const { patients, active, activeId, setActiveId, loading: loadingPatients } = usePatients();
  const [profile, setProfile] = useState<{ full_name: string | null; photo_url: string | null } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [emergencyLink, setEmergencyLink] = useState<EmergencyLink | null | undefined>(undefined);
  const [allergies, setAllergies] = useState<Allergy[] | null>(null);
  const [medications, setMedications] = useState<Medication[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [patientPreview, setPatientPreview] = useState<PatientPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Auth check
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth/login" });
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, photo_url")
        .eq("id", data.user.id)
        .maybeSingle();
      setProfile({ full_name: p?.full_name ?? null, photo_url: p?.photo_url ?? null });
      setAuthChecked(true);
    })();
  }, [navigate]);

  // Carrega dados do paciente ativo
  useEffect(() => {
    if (!active) return;

    const pid = active.id;

    // Emergency link ativo
    supabase
      .from("emergency_links")
      .select("*")
      .eq("patient_id", pid)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setEmergencyLink(data && data.length > 0 ? (data[0] as EmergencyLink) : null);
      });

    // Preview do paciente
    supabase
      .from("patients")
      .select("blood_type")
      .eq("id", pid)
      .maybeSingle()
      .then(({ data }) => {
        setPatientPreview(data as PatientPreview | null);
      });

    // Alergias
    supabase
      .from("patient_allergies")
      .select("id, allergy, severity")
      .eq("patient_id", pid)
      .is("deleted_at", null)
      .then(({ data }) => setAllergies((data ?? []) as Allergy[]));

    // Medicamentos ativos (até 3)
    supabase
      .from("medications")
      .select("id, name, dosage, status")
      .eq("patient_id", pid)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(3)
      .then(({ data }) => setMedications((data ?? []) as Medication[]));

    // Contatos de emergência
    supabase
      .from("emergency_contacts")
      .select("id, name, relationship, phone, priority")
      .eq("patient_id", pid)
      .is("deleted_at", null)
      .order("priority", { ascending: true })
      .then(({ data }) => setContacts((data ?? []) as Contact[]));
  }, [active]);

  async function generateLink() {
    if (!active) return;
    setGenerating(true);
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const token = crypto.randomUUID().replace(/-/g, "");

      const { data, error } = await supabase
        .from("emergency_links")
        .insert({
          patient_id: active.id,
          token,
          is_active: true,
          expires_at: expiresAt,
          access_count: 0,
        })
        .select()
        .single();

      if (error || !data) {
        toast.error("Erro ao gerar link. Tente novamente.");
        return;
      }
      setEmergencyLink(data as EmergencyLink);
      toast.success("Link de emergência gerado!");
    } finally {
      setGenerating(false);
    }
  }

  async function deactivateLink() {
    if (!emergencyLink) return;
    setDeactivating(true);
    try {
      const { error } = await supabase
        .from("emergency_links")
        .update({ is_active: false })
        .eq("id", emergencyLink.id);

      if (error) {
        toast.error("Erro ao desativar link.");
        return;
      }
      setEmergencyLink(null);
      toast.success("Link desativado com sucesso.");
    } finally {
      setDeactivating(false);
    }
  }

  function buildUrl(token: string) {
    return `${window.location.origin}/e/${token}`;
  }

  async function copyLink() {
    if (!emergencyLink) return;
    const url = buildUrl(emergencyLink.token);
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  async function shareLink() {
    if (!emergencyLink) return;
    const url = buildUrl(emergencyLink.token);
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Cartão de Emergência — Amparo",
          text: `Acesse as informações médicas de emergência de ${active?.name ?? "paciente"}.`,
          url,
        });
      } catch {
        // usuário cancelou
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado (compartilhamento não disponível neste dispositivo).");
    }
  }

  const isLoading = !authChecked || loadingPatients;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader userName={profile?.full_name} userPhoto={profile?.photo_url} />
      {patients && patients.length > 1 && (
        <PatientSelector patients={patients} activeId={activeId} onChange={setActiveId} />
      )}

      <main className="mx-auto max-w-md px-5 py-4 space-y-4">
        {isLoading ? (
          <EmergenciaSkeleton />
        ) : !active ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">Nenhum familiar cadastrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione o familiar que você cuida para acessar a central de emergência.
            </p>
            <Button asChild className="mt-4 h-[52px] w-full">
              <Link to="/onboarding/familiar">Cadastrar familiar</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Seção A — Preview do cartão */}
            <section className="rounded-2xl border bg-card p-4">
              <h2 className="mb-3 text-base font-semibold text-foreground">
                Cartão de emergência
              </h2>

              {/* Nome + tipo sanguíneo */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{active.name}</span>
                {patientPreview?.blood_type ? (
                  <Badge className="bg-red-600 text-white hover:bg-red-700 shrink-0">
                    {patientPreview.blood_type}
                  </Badge>
                ) : null}
              </div>

              {/* Alergias */}
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Alergias
                </p>
                {allergies === null ? (
                  <Skeleton className="h-6 w-32" />
                ) : allergies.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhuma alergia cadastrada</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {allergies.map((a) => (
                      <span
                        key={a.id}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          SEVERITY_COLORS[a.severity ?? "low"] ?? SEVERITY_COLORS.low
                        }`}
                      >
                        {a.allergy}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Medicamentos ativos */}
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medicamentos em uso
                </p>
                {medications === null ? (
                  <Skeleton className="h-6 w-48" />
                ) : medications.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhum medicamento ativo</span>
                ) : (
                  <ul className="space-y-1">
                    {medications.map((m) => (
                      <li key={m.id} className="flex items-center gap-1.5 text-sm">
                        <Pill className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          {m.name}
                          {m.dosage ? ` · ${m.dosage}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Contatos */}
              {contacts !== null && contacts.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contatos de emergência
                  </p>
                  <ul className="space-y-1">
                    {contacts.slice(0, 2).map((c) => (
                      <li key={c.id} className="flex items-center gap-1.5 text-sm">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          {c.name}
                          {c.relationship ? ` (${c.relationship})` : ""} · {c.phone}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CTA se dados incompletos */}
              {(!patientPreview?.blood_type ||
                (allergies !== null && allergies.length === 0) ||
                (contacts !== null && contacts.length === 0)) && (
                <Link
                  to={`/paciente/${active.id}` as never}
                  className="mt-1 inline-flex items-center text-sm font-medium text-primary"
                >
                  Preencher dados →
                </Link>
              )}
            </section>

            {/* Seção B — Link de emergência */}
            <section className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-destructive" />
                <h2 className="text-base font-semibold">Link de emergência</h2>
              </div>

              {emergencyLink === undefined ? (
                <Skeleton className="h-24 w-full" />
              ) : emergencyLink === null ? (
                <div className="text-center py-4">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="mb-4 text-sm text-muted-foreground">
                    Gere um link para que socorristas possam acessar as informações médicas
                    essenciais do paciente sem precisar de senha.
                  </p>
                  <Button
                    className="h-[52px] w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={generateLink}
                    disabled={generating}
                  >
                    {generating ? "Gerando..." : "Gerar link de emergência"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* URL truncada */}
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-mono text-muted-foreground">
                      {buildUrl(emergencyLink.token)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      onClick={copyLink}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-[44px] flex-1"
                      onClick={copyLink}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      className="h-[44px] flex-1"
                      onClick={shareLink}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Compartilhar
                    </Button>
                  </div>

                  {/* Meta do link */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {emergencyLink.expires_at && (
                      <Badge variant="outline" className="text-xs">
                        Expira em{" "}
                        {new Date(emergencyLink.expires_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      Acessado {emergencyLink.access_count ?? 0}{" "}
                      {emergencyLink.access_count === 1 ? "vez" : "vezes"}
                    </Badge>
                  </div>

                  {/* Desativar */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-[44px] w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <ShieldOff className="mr-2 h-4 w-4" />
                        Desativar link
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desativar link de emergência?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O link atual deixará de funcionar imediatamente. Você poderá gerar um
                          novo link a qualquer momento.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={deactivateLink}
                          disabled={deactivating}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deactivating ? "Desativando..." : "Sim, desativar"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function EmergenciaSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
