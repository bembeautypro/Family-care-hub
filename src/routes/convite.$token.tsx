import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/familia.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({ meta: [{ title: "Aceitar convite — Amparo" }] }),
  component: ConvitePage,
});

type Role = "admin" | "editor" | "viewer" | "caregiver";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
  caregiver: "Cuidador",
};

type InvitationData = {
  role: Role;
  families: { name: string } | null;
};

function ConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const acceptInvite = useServerFn(acceptInvitation);

  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function init() {
    setLoading(true);

    // Fetch invitation info (no auth required)
    const { data: inv, error } = await supabase
      .from("invitations")
      .select("id, role, status, expires_at, families(name)")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (error || !inv) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    if (new Date(inv.expires_at as string) < new Date()) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    setInvitation({
      role: inv.role as Role,
      families: inv.families as { name: string } | null,
    });

    // Check if user is logged in
    const { data: userData } = await supabase.auth.getUser();
    setIsLoggedIn(!!userData.user);

    setLoading(false);
  }

  async function handleAccept() {
    setAccepting(true);
    try {
      const result = await acceptInvite({ data: { token } });
      if (result.alreadyMember) {
        toast.info("Você já é membro desta família.");
      } else {
        toast.success("Convite aceito! Bem-vindo à família.");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao aceitar convite",
      );
    } finally {
      setAccepting(false);
    }
  }

  const familyName = invitation?.families?.name ?? "sua família";
  const roleLabel =
    invitation?.role ? ROLE_LABELS[invitation.role] : "";

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          Carregando convite...
        </p>
      </main>
    );
  }

  if (invalid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-foreground">
          Convite inválido ou expirado
        </h1>
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          Este link de convite não é mais válido. Peça ao administrador da
          família para gerar um novo convite.
        </p>
        <Button
          className="mt-8 h-[52px] w-full max-w-xs"
          onClick={() => navigate({ to: "/" })}
        >
          Ir para o início
        </Button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
        <Users className="h-10 w-10 text-primary" />
      </div>

      <h1 className="mt-6 text-center text-2xl font-bold text-foreground">
        Convite para família
      </h1>

      <p className="mt-3 max-w-sm text-center text-sm text-muted-foreground">
        Você foi convidado para a família{" "}
        <span className="font-medium text-foreground">{familyName}</span> como{" "}
        <span className="font-medium text-foreground">{roleLabel}</span>.
        {!isLoggedIn && " Crie uma conta ou entre para aceitar."}
      </p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        {isLoggedIn ? (
          <Button
            className="h-[52px] w-full text-base"
            disabled={accepting}
            onClick={handleAccept}
          >
            {accepting ? "Aceitando..." : "Aceitar convite"}
          </Button>
        ) : (
          <>
            <Button
              className="h-[52px] w-full text-base"
              onClick={() =>
                navigate({
                  to: "/auth/registro",
                  search: { invite: token },
                })
              }
            >
              Criar conta
            </Button>
            <Button
              variant="outline"
              className="h-[52px] w-full text-base"
              onClick={() =>
                navigate({
                  to: "/auth/login",
                  search: { invite: token },
                })
              }
            >
              Já tenho conta — Entrar
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
