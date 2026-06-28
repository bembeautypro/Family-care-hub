import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MoreVertical,
  Copy,
  Share2,
  UserPlus,
  Info,
  Users,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { generateInviteLink, changeMemberRole, removeMember } from "@/lib/familia.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";

export const Route = createFileRoute("/_authenticated/familia")({
  head: () => ({ meta: [{ title: "Família — Amparo" }] }),
  component: FamiliaPage,
});

type Role = "admin" | "editor" | "viewer" | "caregiver";

type Member = {
  id: string;
  role: Role;
  status: string;
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  } | null;
};

type Invitation = {
  id: string;
  role: Role;
  email: string | null;
  token: string;
  expires_at: string;
  status: string;
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
  caregiver: "Cuidador",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Gerencia família, convida e remove membros, edita tudo",
  editor: "Adiciona e edita dados clínicos",
  viewer: "Apenas visualiza",
  caregiver: "Acessa agenda, medicamentos e emergência",
};

const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin: "bg-primary/10 text-primary hover:bg-primary/10",
  editor: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  viewer: "bg-muted text-muted-foreground hover:bg-muted",
  caregiver: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function FamiliaPage() {
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite sheet state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Member actions state
  const [actionMember, setActionMember] = useState<Member | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  // Change role sheet state
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [changingRole, setChangingRole] = useState(false);

  // Remove member dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const generateInvite = useServerFn(generateInviteLink);
  const changeRole = useServerFn(changeMemberRole);
  const removeServerFn = useServerFn(removeMember);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        // gate em _authenticated/route.tsx garante usuário
        return;
      }
      setCurrentUserId(data.user.id);
    });
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  async function loadData() {
    setLoading(true);
    try {
      // Get the user's active family membership
      const { data: membership, error: memErr } = await supabase
        .from("family_members")
        .select("id, role, status, family_id, families(id, name)")
        .eq("user_id", currentUserId!)
        .eq("status", "active")
        .maybeSingle();

      if (memErr) {
        toast.error(memErr.message);
        setLoading(false);
        return;
      }

      if (!membership) {
        setLoading(false);
        return;
      }

      const fId = membership.family_id as string;
      const fName =
        (membership.families as { id: string; name: string } | null)?.name ??
        null;
      setFamilyId(fId);
      setFamilyName(fName);
      setCurrentUserRole(membership.role as Role);

      // Load all active members
      const { data: membersData, error: membersErr } = await supabase
        .from("family_members")
        .select("id, role, status, user_id, profiles(id, full_name, photo_url)")
        .eq("family_id", fId)
        .eq("status", "active");

      if (membersErr) {
        toast.error(membersErr.message);
      } else {
        setMembers((membersData ?? []) as unknown as Member[]);
      }

      // Load pending invitations (admin only)
      if (membership.role === "admin") {
        const { data: invData, error: invErr } = await supabase
          .from("invitations")
          .select("id, role, email, token, expires_at, status")
          .eq("family_id", fId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString());

        if (invErr) {
          toast.error(invErr.message);
        } else {
          setInvitations((invData ?? []) as Invitation[]);
        }
      } else {
        setInvitations([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateInvite() {
    if (!familyId) return;
    setInviteLoading(true);
    try {
      const result = await generateInvite({
        data: {
          family_id: familyId,
          role: inviteRole,
          email: inviteEmail.trim() || undefined,
        },
      });
      setGeneratedToken(result.token);
      toast.success("Link de convite gerado!");
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar convite");
    } finally {
      setInviteLoading(false);
    }
  }

  function buildInviteUrl(token: string): string {
    return `${window.location.origin}/convite/${token}`;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function shareLink(token: string) {
    const url = buildInviteUrl(token);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Convite Amparo", url });
      } catch {
        // user cancelled
      }
    } else {
      await copyToClipboard(url);
    }
  }

  function openMemberActions(member: Member) {
    setActionMember(member);
    setActionSheetOpen(true);
  }

  function openChangeRole() {
    if (!actionMember) return;
    setNewRole(actionMember.role as Role);
    setActionSheetOpen(false);
    setChangeRoleOpen(true);
  }

  function openRemoveDialog() {
    setActionSheetOpen(false);
    setRemoveDialogOpen(true);
  }

  async function handleChangeRole() {
    if (!actionMember) return;
    setChangingRole(true);
    try {
      await changeRole({ data: { member_id: actionMember.id, role: newRole } });
      toast.success("Papel alterado com sucesso.");
      setChangeRoleOpen(false);
      setActionMember(null);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar papel");
    } finally {
      setChangingRole(false);
    }
  }

  async function handleRemoveMember() {
    if (!actionMember) return;
    setRemoving(true);
    try {
      await removeServerFn({ data: { member_id: actionMember.id } });
      toast.success("Membro removido da família.");
      setRemoveDialogOpen(false);
      setActionMember(null);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover membro");
    } finally {
      setRemoving(false);
    }
  }

  // Determine if the action member can be acted upon
  // Can't manage yourself if you're the only admin
  const isOnlyAdmin =
    members !== null &&
    members.filter((m) => m.role === "admin").length === 1 &&
    actionMember?.user_id === currentUserId &&
    actionMember?.role === "admin";

  const isAdmin = currentUserRole === "admin";

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background pb-24">
        <AppHeader />

        <main className="mx-auto max-w-md space-y-6 px-5 py-4">
          <header>
            <h1 className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-7 w-40" />
              ) : familyName ? (
                familyName
              ) : (
                "Família"
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie os membros e acessos da sua família.
            </p>
          </header>

          {/* No family state */}
          {!loading && !familyId && (
            <div className="rounded-2xl border bg-card p-6 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Você ainda não pertence a nenhuma família.
              </p>
            </div>
          )}

          {/* Members section */}
          {(loading || familyId) && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Membros ativos</h2>

              {loading || members === null ? (
                <div className="space-y-3">
                  <Skeleton className="h-[72px] w-full rounded-2xl" />
                  <Skeleton className="h-[72px] w-full rounded-2xl" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum membro encontrado.
                </p>
              ) : (
                <ul className="space-y-3">
                  {members.map((member) => {
                    const isMe = member.user_id === currentUserId;
                    const name = member.profiles?.full_name ?? "Usuário";
                    const photo = member.profiles?.photo_url ?? null;
                    const initials = getInitials(name);
                    const onlyAdminSelf =
                      isMe &&
                      member.role === "admin" &&
                      members.filter((m) => m.role === "admin").length === 1;
                    const canManage = isAdmin && !isMe && !onlyAdminSelf;
                    const canManageOther = isAdmin && !isMe;

                    return (
                      <li
                        key={member.id}
                        className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3"
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          {photo ? (
                            <AvatarImage src={photo} alt={name} />
                          ) : null}
                          <AvatarFallback className="text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {name}
                            {isMe && (
                              <span className="ml-1 text-muted-foreground font-normal">
                                (você)
                              </span>
                            )}
                          </p>
                          <Badge
                            variant="secondary"
                            className={`mt-1 text-xs ${ROLE_BADGE_CLASS[member.role as Role]}`}
                          >
                            {ROLE_LABELS[member.role as Role]}
                          </Badge>
                        </div>

                        {isAdmin && canManageOther && (
                          <button
                            type="button"
                            aria-label="Ações do membro"
                            onClick={() => openMemberActions(member)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Invite section — admin only */}
          {!loading && isAdmin && familyId && (
            <section className="space-y-3">
              <Button
                className="h-[52px] w-full"
                onClick={() => {
                  setInviteEmail("");
                  setInviteRole("viewer");
                  setGeneratedToken(null);
                  setInviteOpen(true);
                }}
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Convidar membro
              </Button>
            </section>
          )}

          {/* Pending invitations — admin only */}
          {!loading && isAdmin && invitations && invitations.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Convites pendentes</h2>
              <ul className="space-y-3">
                {invitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-2xl border bg-card px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {ROLE_LABELS[inv.role as Role]}
                        </p>
                        {inv.email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {inv.email}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            Expira em{" "}
                            {format(new Date(inv.expires_at), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() =>
                          copyToClipboard(buildInviteUrl(inv.token))
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        {/* Invite Sheet */}
        <Sheet
          open={inviteOpen}
          onOpenChange={(o) => {
            if (!o) {
              setInviteOpen(false);
              setGeneratedToken(null);
            }
          }}
        >
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-left">Convidar membro</SheetTitle>
            </SheetHeader>

            {generatedToken ? (
              <div className="mt-4 space-y-4 pb-6">
                <p className="text-sm text-muted-foreground">
                  Compartilhe este link com a pessoa que você quer convidar.
                </p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {buildInviteUrl(generatedToken)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-[52px]"
                    onClick={() =>
                      copyToClipboard(buildInviteUrl(generatedToken))
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                  <Button
                    className="h-[52px]"
                    onClick={() => shareLink(generatedToken)}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Compartilhar
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="h-[52px] w-full"
                  onClick={() => {
                    setGeneratedToken(null);
                    setInviteEmail("");
                    setInviteRole("viewer");
                  }}
                >
                  Gerar novo convite
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">
                    E-mail{" "}
                    <span className="text-muted-foreground font-normal">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="pessoa@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-[52px]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="invite-role">Papel</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center text-muted-foreground"
                          aria-label="Informações sobre papéis"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[220px]">
                        <ul className="space-y-1 text-xs">
                          {(
                            Object.entries(ROLE_DESCRIPTIONS) as [
                              Role,
                              string,
                            ][]
                          ).map(([role, desc]) => (
                            <li key={role}>
                              <span className="font-medium">
                                {ROLE_LABELS[role]}:
                              </span>{" "}
                              {desc}
                            </li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as Role)}
                  >
                    <SelectTrigger id="invite-role" className="h-[52px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_LABELS) as [Role, string][]).map(
                        ([role, label]) => (
                          <SelectItem key={role} value={role}>
                            <div className="flex flex-col items-start">
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground">
                                {ROLE_DESCRIPTIONS[role]}
                              </span>
                            </div>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="h-[52px] w-full"
                  disabled={inviteLoading}
                  onClick={handleGenerateInvite}
                >
                  {inviteLoading ? "Gerando..." : "Gerar link de convite"}
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Member actions sheet */}
        <Sheet
          open={actionSheetOpen}
          onOpenChange={(o) => !o && setActionSheetOpen(false)}
        >
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-left">
                {actionMember?.profiles?.full_name ?? "Membro"}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid gap-2 pb-6">
              <button
                type="button"
                onClick={openChangeRole}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left active:bg-muted"
              >
                <span className="text-base font-medium">Alterar papel</span>
              </button>
              <button
                type="button"
                onClick={openRemoveDialog}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-destructive active:bg-muted"
              >
                <span className="text-base font-medium">
                  Remover da família
                </span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Change role sheet */}
        <Sheet
          open={changeRoleOpen}
          onOpenChange={(o) => !o && setChangeRoleOpen(false)}
        >
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-left">Alterar papel</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 pb-6">
              <p className="text-sm text-muted-foreground">
                Escolha o novo papel para{" "}
                <span className="font-medium text-foreground">
                  {actionMember?.profiles?.full_name ?? "este membro"}
                </span>
                .
              </p>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as Role)}
              >
                <SelectTrigger className="h-[52px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(
                    ([role, label]) => (
                      <SelectItem key={role} value={role}>
                        <div className="flex flex-col items-start">
                          <span>{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {ROLE_DESCRIPTIONS[role]}
                          </span>
                        </div>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Button
                className="h-[52px] w-full"
                disabled={changingRole}
                onClick={handleChangeRole}
              >
                {changingRole ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Remove member dialog */}
        <AlertDialog
          open={removeDialogOpen}
          onOpenChange={(o) => !o && setRemoveDialogOpen(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Remover{" "}
                {actionMember?.profiles?.full_name ?? "este membro"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta pessoa perderá acesso à família. Você poderá convidá-la
                novamente mais tarde.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={removing}
                onClick={handleRemoveMember}
              >
                {removing ? "Removendo..." : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BottomNav />
      </div>
    </TooltipProvider>
  );
}
