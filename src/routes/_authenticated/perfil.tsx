import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, LogOut, Trash2, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MEDICAL_DOCS_BUCKET, getSignedMedicalDocUrl } from "@/lib/supabase/storage";
import { updateProfile, deleteAccount } from "@/lib/perfil.functions";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Amparo" }] }),
  component: PerfilPage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  phone: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

type Profile = {
  full_name: string | null;
  phone: string | null;
  photo_url: string | null;
};

function PerfilPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const doUpdateProfile = useServerFn(updateProfile);
  const doDeleteAccount = useServerFn(deleteAccount);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Avatar upload
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Delete account dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [soloAdminWarning, setSoloAdminWarning] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth/login" });
        return;
      }
      setUserId(data.user.id);
      const { data: p, error } = await supabase
        .from("profiles")
        .select("full_name, phone, photo_url")
        .eq("id", data.user.id)
        .single();
      if (error) {
        toast.error("Erro ao carregar perfil");
        setLoadingProfile(false);
        return;
      }
      setProfile(p as Profile);
      reset({ full_name: p?.full_name ?? "", phone: p?.phone ?? "" });

      if (p?.photo_url) {
        try {
          const signed = await getSignedMedicalDocUrl(p.photo_url, 300);
          setAvatarUrl(signed);
        } catch {
          setAvatarUrl(null);
        }
      }
      setLoadingProfile(false);
    });
  }, [navigate, reset]);

  async function onSaveProfile(values: ProfileForm) {
    try {
      await doUpdateProfile({ data: values });
      setProfile((prev) => prev ? { ...prev, full_name: values.full_name, phone: values.phone ?? null } : prev);
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  async function uploadAvatar(file: File) {
    if (!userId) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Use apenas JPEG ou PNG");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto deve ter no máximo 5 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `profiles/${userId}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(MEDICAL_DOCS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ photo_url: path })
        .eq("id", userId);
      if (updateErr) throw updateErr;

      const signed = await getSignedMedicalDocUrl(path, 300);
      setAvatarUrl(signed);
      setProfile((prev) => prev ? { ...prev, photo_url: path } : prev);
      toast.success("Foto atualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadAvatar(file);
    e.target.value = "";
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth/login" });
  }

  async function handleDeleteAccount() {
    setSoloAdminWarning(false);
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteAccount() {
    if (deleteConfirmText !== "EXCLUIR") return;
    setDeletingAccount(true);
    try {
      await doDeleteAccount({});
      await supabase.auth.signOut();
      navigate({ to: "/auth/login" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir conta";
      if (msg === "SOLO_ADMIN") {
        setDeleteDialogOpen(false);
        setSoloAdminWarning(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setDeletingAccount(false);
    }
  }

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader showEmergency={false} />

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <h1 className="text-2xl font-bold">Meu perfil</h1>

        {loadingProfile ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-[52px] w-full rounded-lg" />
            <Skeleton className="h-[52px] w-full rounded-lg" />
            <Skeleton className="h-[52px] w-full rounded-lg" />
          </div>
        ) : (
          <>
            {/* ── Dados pessoais ──────────────────────────────── */}
            <section className="rounded-2xl border bg-card p-5 space-y-5">
              <h2 className="text-base font-semibold">Dados pessoais</h2>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile?.full_name ?? ""} /> : null}
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                {isMobile ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingAvatar}
                      onClick={() => cameraRef.current?.click()}
                    >
                      <Camera className="mr-1.5 h-4 w-4" />
                      Câmera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingAvatar}
                      onClick={() => galleryRef.current?.click()}
                    >
                      <ImagePlus className="mr-1.5 h-4 w-4" />
                      Galeria
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={() => galleryRef.current?.click()}
                  >
                    <User className="mr-1.5 h-4 w-4" />
                    Alterar foto
                  </Button>
                )}

                {/* Hidden inputs */}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  className="hidden"
                  onChange={onPickFile}
                />
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={onPickFile}
                />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input
                    id="full_name"
                    className="h-[52px]"
                    {...register("full_name")}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-destructive">{errors.full_name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+55 (11) 99999-0000"
                    className="h-[52px]"
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="h-[52px] w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                  ) : (
                    "Salvar alterações"
                  )}
                </Button>
              </form>
            </section>

            {/* ── Conta ───────────────────────────────────────── */}
            <section className="rounded-2xl border bg-card p-5 space-y-3">
              <h2 className="text-base font-semibold">Conta</h2>

              <Button
                variant="outline"
                className="h-[52px] w-full justify-start gap-3"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5" />
                Sair
              </Button>

              <Button
                variant="outline"
                className="h-[52px] w-full justify-start gap-3 border-destructive text-destructive hover:bg-destructive/5"
                onClick={handleDeleteAccount}
              >
                <Trash2 className="h-5 w-5" />
                Excluir conta
              </Button>
            </section>

            {/* ── Aviso de único admin ─────────────────────────── */}
            {soloAdminWarning && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 space-y-3 text-sm text-amber-900">
                <p className="font-semibold">Não é possível excluir sua conta</p>
                <p>
                  Você é o único administrador de uma ou mais famílias. Promova outro membro
                  como administrador antes de excluir sua conta.
                </p>
                <Button asChild variant="outline" size="sm" className="border-amber-400 text-amber-900 hover:bg-amber-100">
                  <Link to="/familia">Gerenciar família →</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── AlertDialog exclusão ─────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(o) => { if (!o) { setDeleteDialogOpen(false); setDeleteConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os seus dados serão removidos e você
              perderá acesso ao aplicativo.
              <br /><br />
              Para confirmar, digite <strong>EXCLUIR</strong> no campo abaixo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="mt-1"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "EXCLUIR" || deletingAccount}
              onClick={confirmDeleteAccount}
            >
              {deletingAccount ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</> : "Excluir minha conta"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
