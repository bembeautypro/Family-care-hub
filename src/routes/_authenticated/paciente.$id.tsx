import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  MoreVertical,
  Phone,
  Plus,
  User,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MEDICAL_DOCS_BUCKET, getSignedMedicalDocUrl } from "@/lib/supabase/storage";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/paciente/$id")({
  head: () => ({ meta: [{ title: "Paciente — Amparo" }] }),
  component: PacientePage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string;
  family_id: string | null;
  name: string;
  photo_url: string | null;
  birth_date: string | null;
  blood_type: string | null;
  height: number | null;
  weight: number | null;
  health_insurance_name: string | null;
  health_insurance_number: string | null;
  preferred_hospital: string | null;
  notes: string | null;
  created_by: string | null;
};

type Allergy = {
  id: string;
  patient_id: string;
  allergy: string;
  severity: "critical" | "high" | "medium" | "low";
  notes: string | null;
};

type Condition = {
  id: string;
  patient_id: string;
  name: string;
  description: string | null;
  diagnosed_at: string | null;
  status: "active" | "inactive" | "unknown";
};

type EmergencyContact = {
  id: string;
  patient_id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  priority: number;
};

type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  status: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"] as const;

const BLOOD_TYPE_LABELS: Record<string, string> = {
  "A+": "A+",
  "A-": "A-",
  "B+": "B+",
  "B-": "B-",
  "AB+": "AB+",
  "AB-": "AB-",
  "O+": "O+",
  "O-": "O-",
  unknown: "Não sei",
};

const SEVERITY_META: Record<Allergy["severity"], { label: string; className: string }> = {
  critical: { label: "Crítica", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
  medium: { label: "Média", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  low: { label: "Baixa", className: "bg-muted text-muted-foreground hover:bg-muted" },
};

const CONDITION_STATUS_META: Record<Condition["status"], { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  inactive: { label: "Inativa", className: "bg-muted text-muted-foreground hover:bg-muted" },
  unknown: { label: "Desconhecida", className: "bg-background border text-muted-foreground hover:bg-background" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Main component ────────────────────────────────────────────────────────────

function PacientePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [userId, setUserId] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [patientAvatarUrl, setPatientAvatarUrl] = useState<string | null>(null);

  const [tab, setTab] = useState("dados");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth/login" });
        return;
      }
      setUserId(data.user.id);
      const { data: p, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (error || !p) {
        toast.error("Paciente não encontrado");
        navigate({ to: "/dashboard" });
        return;
      }
      setPatient(p as Patient);
      if (p.photo_url) {
        try {
          const signed = await getSignedMedicalDocUrl(p.photo_url as string, 300);
          setPatientAvatarUrl(signed);
        } catch {
          setPatientAvatarUrl(null);
        }
      }
      setLoadingPatient(false);
    });
  }, [id, navigate]);

  async function refreshPatient() {
    const { data: p } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (p) {
      setPatient(p as Patient);
      if ((p as Patient).photo_url) {
        try {
          const signed = await getSignedMedicalDocUrl((p as Patient).photo_url!, 300);
          setPatientAvatarUrl(signed);
        } catch {
          setPatientAvatarUrl(null);
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader showEmergency={false} />

      <main className="mx-auto max-w-md px-5 py-4">
        {loadingPatient || !patient ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* ── Patient header ─────────────────────────── */}
            <div className="mb-4 flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {patientAvatarUrl ? (
                  <AvatarImage src={patientAvatarUrl} alt={patient.name} />
                ) : null}
                <AvatarFallback className="text-xl">{initials(patient.name)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold">{patient.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {calcAge(patient.birth_date) !== null && (
                    <span className="text-sm text-muted-foreground">
                      {calcAge(patient.birth_date)} anos
                    </span>
                  )}
                  {patient.blood_type && patient.blood_type !== "unknown" && (
                    <Badge variant="secondary" className="text-xs">
                      {patient.blood_type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* ── Tabs ───────────────────────────────────── */}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full overflow-x-auto flex h-auto p-1 gap-1">
                <TabsTrigger value="dados" className="flex-1 text-xs px-2 py-1.5">Dados gerais</TabsTrigger>
                <TabsTrigger value="alergias" className="flex-1 text-xs px-2 py-1.5">Alergias</TabsTrigger>
                <TabsTrigger value="condicoes" className="flex-1 text-xs px-2 py-1.5">Condições</TabsTrigger>
                <TabsTrigger value="medicamentos" className="flex-1 text-xs px-2 py-1.5">Medicamentos</TabsTrigger>
                <TabsTrigger value="contatos" className="flex-1 text-xs px-2 py-1.5">Contatos</TabsTrigger>
              </TabsList>

              <TabsContent value="dados">
                <DadosGeraisTab
                  patient={patient}
                  patientAvatarUrl={patientAvatarUrl}
                  userId={userId}
                  isMobile={isMobile}
                  onRefresh={refreshPatient}
                />
              </TabsContent>

              <TabsContent value="alergias">
                <AlergiasTab patientId={id} userId={userId} />
              </TabsContent>

              <TabsContent value="condicoes">
                <CondicoesTab patientId={id} userId={userId} />
              </TabsContent>

              <TabsContent value="medicamentos">
                <MedicamentosTab patientId={id} />
              </TabsContent>

              <TabsContent value="contatos">
                <ContatosTab patientId={id} userId={userId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

// ── Tab: Dados Gerais ─────────────────────────────────────────────────────────

function DadosGeraisTab({
  patient,
  patientAvatarUrl,
  userId,
  isMobile,
  onRefresh,
}: {
  patient: Patient;
  patientAvatarUrl: string | null;
  userId: string | null;
  isMobile: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: patient.name,
    birth_date: patient.birth_date ?? "",
    blood_type: patient.blood_type ?? "unknown",
    height: patient.height ? String(patient.height) : "",
    weight: patient.weight ? String(patient.weight) : "",
    health_insurance_name: patient.health_insurance_name ?? "",
    health_insurance_number: patient.health_insurance_number ?? "",
    preferred_hospital: patient.preferred_hospital ?? "",
    notes: patient.notes ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(patientAvatarUrl);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Use apenas JPEG ou PNG");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function handleSave() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    setSaving(true);
    try {
      let newPhotoPath = patient.photo_url;

      if (photoFile) {
        setUploadingPhoto(true);
        const ext = photoFile.type === "image/png" ? "png" : "jpg";
        const filename = `avatar.${ext}`;
        const path = `patients/${patient.id}/profile/${filename}`;
        const { error: uploadErr } = await supabase.storage
          .from(MEDICAL_DOCS_BUCKET)
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
        if (uploadErr) throw uploadErr;
        newPhotoPath = path;
        setUploadingPhoto(false);
      }

      const { error } = await supabase
        .from("patients")
        .update({
          name: form.name.trim(),
          birth_date: form.birth_date || null,
          blood_type: form.blood_type || null,
          height: form.height ? Number(form.height) : null,
          weight: form.weight ? Number(form.weight) : null,
          health_insurance_name: form.health_insurance_name || null,
          health_insurance_number: form.health_insurance_number || null,
          preferred_hospital: form.preferred_hospital || null,
          notes: form.notes || null,
          photo_url: newPhotoPath,
        })
        .eq("id", patient.id);

      if (error) throw error;
      toast.success("Dados atualizados.");
      setEditOpen(false);
      setPhotoFile(null);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  }

  const age = calcAge(patient.birth_date);

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informações gerais</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {age !== null && (
            <>
              <dt className="text-muted-foreground">Idade</dt>
              <dd className="font-medium">{age} anos</dd>
            </>
          )}
          {patient.birth_date && (
            <>
              <dt className="text-muted-foreground">Nascimento</dt>
              <dd className="font-medium">{new Date(patient.birth_date + "T00:00:00").toLocaleDateString("pt-BR")}</dd>
            </>
          )}
          {patient.blood_type && (
            <>
              <dt className="text-muted-foreground">Tipo sanguíneo</dt>
              <dd>
                <Badge variant="secondary">{BLOOD_TYPE_LABELS[patient.blood_type] ?? patient.blood_type}</Badge>
              </dd>
            </>
          )}
          {patient.weight && (
            <>
              <dt className="text-muted-foreground">Peso</dt>
              <dd className="font-medium">{patient.weight} kg</dd>
            </>
          )}
          {patient.height && (
            <>
              <dt className="text-muted-foreground">Altura</dt>
              <dd className="font-medium">{patient.height} cm</dd>
            </>
          )}
          {patient.health_insurance_name && (
            <>
              <dt className="text-muted-foreground">Convênio</dt>
              <dd className="font-medium">{patient.health_insurance_name}</dd>
            </>
          )}
          {patient.health_insurance_number && (
            <>
              <dt className="text-muted-foreground">Carteirinha</dt>
              <dd className="font-medium">{patient.health_insurance_number}</dd>
            </>
          )}
          {patient.preferred_hospital && (
            <>
              <dt className="text-muted-foreground col-span-2">Hospital de preferência</dt>
              <dd className="col-span-2 font-medium">{patient.preferred_hospital}</dd>
            </>
          )}
        </dl>

        {patient.notes && (
          <div className="border-t pt-3 text-sm">
            <p className="text-muted-foreground mb-1">Observações</p>
            <p className="whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setPhotoFile(null); setPhotoPreview(patientAvatarUrl); } }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar dados</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4 pb-6">
            {/* Photo */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  {photoPreview ? <AvatarImage src={photoPreview} alt={patient.name} /> : null}
                  <AvatarFallback className="text-xl">{initials(patient.name)}</AvatarFallback>
                </Avatar>
                {uploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {isMobile && (
                  <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                    <Camera className="mr-1.5 h-4 w-4" /> Câmera
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                  <ImagePlus className="mr-1.5 h-4 w-4" /> {isMobile ? "Galeria" : "Alterar foto"}
                </Button>
              </div>
              <input ref={cameraRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={onPickPhoto} />
              <input ref={galleryRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onPickPhoto} />
            </div>

            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-[52px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="h-[52px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo sanguíneo</Label>
              <Select
                value={form.blood_type}
                onValueChange={(v) => setForm({ ...form, blood_type: v })}
              >
                <SelectTrigger className="h-[52px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {BLOOD_TYPE_LABELS[bt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="h-[52px]"
                  placeholder="Ex.: 70"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Altura (cm)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                  className="h-[52px]"
                  placeholder="Ex.: 170"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Convênio</Label>
              <Input
                value={form.health_insurance_name}
                onChange={(e) => setForm({ ...form, health_insurance_name: e.target.value })}
                className="h-[52px]"
                placeholder="Ex.: Unimed"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Número da carteirinha</Label>
              <Input
                value={form.health_insurance_number}
                onChange={(e) => setForm({ ...form, health_insurance_number: e.target.value })}
                className="h-[52px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Hospital de preferência</Label>
              <Input
                value={form.preferred_hospital}
                onChange={(e) => setForm({ ...form, preferred_hospital: e.target.value })}
                className="h-[52px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button
              className="h-[52px] w-full"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Tab: Alergias ─────────────────────────────────────────────────────────────

function AlergiasTab({ patientId, userId }: { patientId: string; userId: string | null }) {
  const [allergies, setAllergies] = useState<Allergy[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Allergy | null>(null);
  const [toRemove, setToRemove] = useState<Allergy | null>(null);
  const [actionItem, setActionItem] = useState<Allergy | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    allergy: "",
    severity: "medium" as Allergy["severity"],
    notes: "",
  });

  async function load() {
    const { data, error } = await supabase
      .from("patient_allergies")
      .select("*")
      .eq("patient_id", patientId)
      .is("deleted_at", null)
      .order("severity", { ascending: true });
    if (error) { toast.error(error.message); setAllergies([]); return; }
    setAllergies((data ?? []) as Allergy[]);
  }

  useEffect(() => { void load(); }, [patientId]);

  function openAdd() {
    setEditingItem(null);
    setForm({ allergy: "", severity: "medium", notes: "" });
    setSheetOpen(true);
  }

  function openEdit(item: Allergy) {
    setEditingItem(item);
    setForm({ allergy: item.allergy, severity: item.severity, notes: item.notes ?? "" });
    setActionItem(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.allergy.trim()) { toast.error("Informe o nome da alergia"); return; }
    setSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("patient_allergies")
          .update({ allergy: form.allergy.trim(), severity: form.severity, notes: form.notes || null })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Alergia atualizada.");
      } else {
        const { error } = await supabase
          .from("patient_allergies")
          .insert({ patient_id: patientId, allergy: form.allergy.trim(), severity: form.severity, notes: form.notes || null });
        if (error) throw error;
        toast.success("Alergia adicionada.");
      }
      setSheetOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(item: Allergy) {
    const { error } = await supabase
      .from("patient_allergies")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Alergia removida.");
    setToRemove(null);
    setActionItem(null);
    void load();
  }

  const SEVERITY_ORDER: Allergy["severity"][] = ["critical", "high", "medium", "low"];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Alergias</h3>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {allergies === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : allergies.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma alergia registrada.
        </div>
      ) : (
        <ul className="space-y-2">
          {allergies.map((a) => {
            const meta = SEVERITY_META[a.severity];
            return (
              <li key={a.id} className="rounded-2xl border bg-card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.allergy}</p>
                  {a.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                  <button
                    type="button"
                    onClick={() => setActionItem(a)}
                    aria-label="Ações"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Actions sheet */}
      <Sheet open={!!actionItem} onOpenChange={(o) => !o && setActionItem(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">{actionItem?.allergy}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2 pb-6">
            <ActionButton label="Editar" onClick={() => actionItem && openEdit(actionItem)} />
            <ActionButton label="Remover" danger onClick={() => { if (actionItem) { setToRemove(actionItem); setActionItem(null); } }} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Add/Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => !o && setSheetOpen(false)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingItem ? "Editar alergia" : "Nova alergia"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="space-y-1.5">
              <Label>Alergia</Label>
              <Input
                value={form.allergy}
                onChange={(e) => setForm({ ...form, allergy: e.target.value })}
                className="h-[52px]"
                placeholder="Ex.: Penicilina"
              />
            </div>

            <div className="space-y-2">
              <Label>Severidade</Label>
              <RadioGroup
                value={form.severity}
                onValueChange={(v) => setForm({ ...form, severity: v as Allergy["severity"] })}
                className="grid grid-cols-2 gap-2"
              >
                {SEVERITY_ORDER.map((s) => {
                  const meta = SEVERITY_META[s];
                  return (
                    <label
                      key={s}
                      htmlFor={`sev-${s}`}
                      className={`flex h-[44px] cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                        form.severity === s ? "border-primary bg-primary/5" : "border-input"
                      }`}
                    >
                      <RadioGroupItem id={`sev-${s}`} value={s} className="sr-only" />
                      {meta.label}
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Ex.: Reação anafilática grave"
              />
            </div>

            <Button className="h-[52px] w-full" disabled={saving} onClick={handleSave}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Remove confirm */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {toRemove?.allergy}?</AlertDialogTitle>
            <AlertDialogDescription>Esta alergia será removida do registro.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toRemove && handleRemove(toRemove)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Tab: Condições médicas ────────────────────────────────────────────────────

function CondicoesTab({ patientId, userId }: { patientId: string; userId: string | null }) {
  const [conditions, setConditions] = useState<Condition[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Condition | null>(null);
  const [toRemove, setToRemove] = useState<Condition | null>(null);
  const [actionItem, setActionItem] = useState<Condition | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    diagnosed_at: "",
    status: "active" as Condition["status"],
  });

  async function load() {
    const { data, error } = await supabase
      .from("patient_conditions")
      .select("*")
      .eq("patient_id", patientId)
      .is("deleted_at", null)
      .order("diagnosed_at", { ascending: false });
    if (error) { toast.error(error.message); setConditions([]); return; }
    setConditions((data ?? []) as Condition[]);
  }

  useEffect(() => { void load(); }, [patientId]);

  function openAdd() {
    setEditingItem(null);
    setForm({ name: "", description: "", diagnosed_at: "", status: "active" });
    setSheetOpen(true);
  }

  function openEdit(item: Condition) {
    setEditingItem(item);
    setForm({ name: item.name, description: item.description ?? "", diagnosed_at: item.diagnosed_at ?? "", status: item.status });
    setActionItem(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Informe o nome da condição"); return; }
    setSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("patient_conditions")
          .update({ name: form.name.trim(), description: form.description || null, diagnosed_at: form.diagnosed_at || null, status: form.status })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Condição atualizada.");
      } else {
        const { error } = await supabase
          .from("patient_conditions")
          .insert({ patient_id: patientId, name: form.name.trim(), description: form.description || null, diagnosed_at: form.diagnosed_at || null, status: form.status });
        if (error) throw error;
        toast.success("Condição adicionada.");
      }
      setSheetOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(item: Condition) {
    const { error } = await supabase
      .from("patient_conditions")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Condição arquivada.");
    setToRemove(null);
    setActionItem(null);
    void load();
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Condições médicas</h3>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {conditions === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : conditions.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma condição médica registrada.
        </div>
      ) : (
        <ul className="space-y-2">
          {conditions.map((c) => {
            const meta = CONDITION_STATUS_META[c.status];
            return (
              <li key={c.id} className="rounded-2xl border bg-card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  {c.diagnosed_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Diagnosticado em {new Date(c.diagnosed_at + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                  <button
                    type="button"
                    onClick={() => setActionItem(c)}
                    aria-label="Ações"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Actions sheet */}
      <Sheet open={!!actionItem} onOpenChange={(o) => !o && setActionItem(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">{actionItem?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2 pb-6">
            <ActionButton label="Editar" onClick={() => actionItem && openEdit(actionItem)} />
            <ActionButton label="Arquivar" danger onClick={() => { if (actionItem) { setToRemove(actionItem); setActionItem(null); } }} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Add/Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => !o && setSheetOpen(false)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingItem ? "Editar condição" : "Nova condição"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="space-y-1.5">
              <Label>Nome da condição</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-[52px]"
                placeholder="Ex.: Diabetes tipo 2"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data do diagnóstico</Label>
              <Input
                type="date"
                value={form.diagnosed_at}
                onChange={(e) => setForm({ ...form, diagnosed_at: e.target.value })}
                className="h-[52px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Condition["status"] })}>
                <SelectTrigger className="h-[52px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                  <SelectItem value="unknown">Desconhecida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="h-[52px] w-full" disabled={saving} onClick={handleSave}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Archive confirm */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar {toRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Esta condição será arquivada e removida da lista ativa.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toRemove && handleArchive(toRemove)}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Tab: Medicamentos ─────────────────────────────────────────────────────────

function MedicamentosTab({ patientId }: { patientId: string }) {
  const [meds, setMeds] = useState<Medication[] | null>(null);

  useEffect(() => {
    supabase
      .from("medications")
      .select("id, name, dosage, frequency, status")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); setMeds([]); return; }
        setMeds((data ?? []) as Medication[]);
      });
  }, [patientId]);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Medicamentos ativos</h3>
        <Button asChild variant="ghost" size="sm">
          <Link to="/medicamentos">Ver todos →</Link>
        </Button>
      </div>

      {meds === null ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      ) : meds.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum medicamento ativo.
          <br />
          <Button asChild variant="link" size="sm" className="mt-1">
            <Link to="/medicamentos/novo">Adicionar medicamento</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {meds.map((m) => (
            <li key={m.id} className="rounded-2xl border bg-card p-4">
              <p className="font-medium">{m.name}</p>
              <p className="text-sm text-muted-foreground">
                {[m.dosage, m.frequency].filter(Boolean).join(" · ") || "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Tab: Contatos de emergência ───────────────────────────────────────────────

function ContatosTab({ patientId, userId }: { patientId: string; userId: string | null }) {
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmergencyContact | null>(null);
  const [toRemove, setToRemove] = useState<EmergencyContact | null>(null);
  const [actionItem, setActionItem] = useState<EmergencyContact | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    relationship: "",
    phone: "",
    email: "",
  });

  async function load() {
    const { data, error } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("patient_id", patientId)
      .is("deleted_at", null)
      .order("priority", { ascending: true });
    if (error) { toast.error(error.message); setContacts([]); return; }
    setContacts((data ?? []) as EmergencyContact[]);
  }

  useEffect(() => { void load(); }, [patientId]);

  function openAdd() {
    setEditingItem(null);
    setForm({ name: "", relationship: "", phone: "", email: "" });
    setSheetOpen(true);
  }

  function openEdit(item: EmergencyContact) {
    setEditingItem(item);
    setForm({ name: item.name, relationship: item.relationship ?? "", phone: item.phone ?? "", email: item.email ?? "" });
    setActionItem(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Informe o nome do contato"); return; }
    setSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("emergency_contacts")
          .update({ name: form.name.trim(), relationship: form.relationship || null, phone: form.phone || null, email: form.email || null })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Contato atualizado.");
      } else {
        const maxPriority = contacts ? Math.max(0, ...contacts.map((c) => c.priority)) : 0;
        const { error } = await supabase
          .from("emergency_contacts")
          .insert({ patient_id: patientId, name: form.name.trim(), relationship: form.relationship || null, phone: form.phone || null, email: form.email || null, priority: maxPriority + 1 });
        if (error) throw error;
        toast.success("Contato adicionado.");
      }
      setSheetOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(item: EmergencyContact) {
    const { error } = await supabase
      .from("emergency_contacts")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contato removido.");
    setToRemove(null);
    setActionItem(null);
    void load();
  }

  async function moveUp(index: number) {
    if (!contacts || index === 0) return;
    const a = contacts[index];
    const b = contacts[index - 1];
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("emergency_contacts").update({ priority: b.priority }).eq("id", a.id),
      supabase.from("emergency_contacts").update({ priority: a.priority }).eq("id", b.id),
    ]);
    if (e1 || e2) { toast.error("Erro ao reordenar"); return; }
    void load();
  }

  async function moveDown(index: number) {
    if (!contacts || index >= contacts.length - 1) return;
    const a = contacts[index];
    const b = contacts[index + 1];
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("emergency_contacts").update({ priority: b.priority }).eq("id", a.id),
      supabase.from("emergency_contacts").update({ priority: a.priority }).eq("id", b.id),
    ]);
    if (e1 || e2) { toast.error("Erro ao reordenar"); return; }
    void load();
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Contatos de emergência</h3>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {contacts === null ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum contato de emergência registrado.
        </div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c, index) => (
            <li key={c.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveUp(index)}
                    aria-label="Mover para cima"
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground disabled:opacity-30 active:bg-muted"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === contacts.length - 1}
                    onClick={() => moveDown(index)}
                    aria-label="Mover para baixo"
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground disabled:opacity-30 active:bg-muted"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.relationship && (
                        <p className="text-xs text-muted-foreground">{c.relationship}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActionItem(c)}
                      aria-label="Ações"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="mt-2 flex items-center gap-1.5 text-sm text-primary"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{c.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Actions sheet */}
      <Sheet open={!!actionItem} onOpenChange={(o) => !o && setActionItem(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">{actionItem?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2 pb-6">
            <ActionButton label="Editar" onClick={() => actionItem && openEdit(actionItem)} />
            <ActionButton label="Remover" danger onClick={() => { if (actionItem) { setToRemove(actionItem); setActionItem(null); } }} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Add/Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => !o && setSheetOpen(false)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingItem ? "Editar contato" : "Novo contato de emergência"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="space-y-1.5">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-[52px]"
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Parentesco</Label>
              <Input
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                className="h-[52px]"
                placeholder="Ex.: Filha, Cônjuge"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-[52px]"
                placeholder="+55 (11) 99999-0000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-[52px]"
              />
            </div>

            <Button className="h-[52px] w-full" disabled={saving} onClick={handleSave}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Remove confirm */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {toRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Este contato será removido da lista de emergência.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toRemove && handleRemove(toRemove)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Shared ActionButton ───────────────────────────────────────────────────────

function ActionButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left active:bg-muted ${
        danger ? "text-destructive" : ""
      }`}
    >
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}
