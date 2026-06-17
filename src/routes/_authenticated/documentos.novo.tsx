import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Camera, ImagePlus, Upload, FileText, X, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { MEDICAL_DOCS_BUCKET } from "@/lib/supabase/storage";
import { usePatients } from "@/hooks/useActivePatient";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/_authenticated/documentos/novo")({
  head: () => ({ meta: [{ title: "Novo documento — Amparo" }] }),
  component: NovoDocumento,
});

type DocType =
  | "prescription"
  | "exam"
  | "report"
  | "medical_request"
  | "insurance_card"
  | "id_document"
  | "discharge"
  | "vaccine"
  | "medication_photo"
  | "other";

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "prescription", label: "Receita" },
  { value: "exam", label: "Exame" },
  { value: "report", label: "Laudo" },
  { value: "medical_request", label: "Pedido médico" },
  { value: "insurance_card", label: "Cartão do convênio" },
  { value: "id_document", label: "Documento de identidade" },
  { value: "discharge", label: "Alta hospitalar" },
  { value: "vaccine", label: "Vacina" },
  { value: "medication_photo", label: "Foto de embalagem" },
  { value: "other", label: "Outro" },
];

const VALID_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const metaSchema = z.object({
  title: z.string().trim().min(2, "Título precisa ter ao menos 2 caracteres"),
  type: z.enum([
    "prescription",
    "exam",
    "report",
    "medical_request",
    "insurance_card",
    "id_document",
    "discharge",
    "vaccine",
    "medication_photo",
    "other",
  ]),
  document_date: z.string().optional(),
  doctor_name: z.string().trim().optional(),
  institution: z.string().trim().optional(),
  expiry_date: z.string().optional(),
  notes: z.string().trim().optional(),
});

type MetaForm = z.infer<typeof metaSchema>;

function NovoDocumento() {
  const navigate = useNavigate();
  const { active, loading: loadingPatients } = usePatients();
  const isMobile = useIsMobile();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<MetaForm>({
    title: "",
    type: "other",
    document_date: "",
    doctor_name: "",
    institution: "",
    expiry_date: "",
    notes: "",
  });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);

  // Drop state for desktop
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/auth/login" });
    });
  }, [navigate]);

  // Revoke previous object URL when file changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function validateAndSetFile(candidate: File | null) {
    if (!candidate) return;

    // HEIC check — browsers usually expose image/heic or image/heif
    if (
      candidate.type === "image/heic" ||
      candidate.type === "image/heif" ||
      candidate.name.toLowerCase().endsWith(".heic") ||
      candidate.name.toLowerCase().endsWith(".heif")
    ) {
      toast.error(
        "Formato não suportado. Tire uma foto pelo botão da câmera ou converta para JPG antes de subir.",
      );
      return;
    }

    if (!(VALID_MIME as readonly string[]).includes(candidate.type)) {
      toast.error("Formato inválido. Use JPEG, PNG ou PDF.");
      return;
    }

    if (candidate.size > MAX_BYTES) {
      toast.error("Arquivo muito grande. O limite é 20 MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(candidate);
    if (candidate.type !== "application/pdf") {
      setPreviewUrl(URL.createObjectURL(candidate));
    } else {
      setPreviewUrl(null);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0] ?? null;
    validateAndSetFile(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!file) {
      toast.error("Selecione um arquivo para continuar.");
      return;
    }

    if (!active) {
      toast.error("Nenhum paciente ativo.");
      return;
    }

    const parsed = metaSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Usuário não autenticado.");

      const uuid = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const safeName = `${uuid}.${ext}`;
      const storagePath = `patients/${active.id}/documents/${uuid}/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(MEDICAL_DOCS_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert({
        patient_id: active.id,
        uploaded_by: user.id,
        title: parsed.data.title,
        type: parsed.data.type,
        file_path: storagePath,
        file_mime_type: file.type,
        file_size_bytes: file.size,
        document_date: parsed.data.document_date || null,
        doctor_name: parsed.data.doctor_name || null,
        institution: parsed.data.institution || null,
        expiry_date: parsed.data.expiry_date || null,
        ocr_text: parsed.data.notes || null,
      });

      if (insertError) {
        // Best-effort cleanup of the orphaned storage object
        await supabase.storage.from(MEDICAL_DOCS_BUCKET).remove([storagePath]);
        throw insertError;
      }

      toast.success("Documento salvo com sucesso.");
      navigate({ to: "/documentos" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar documento.");
    } finally {
      setSaving(false);
    }
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  }

  return (
    <main className="min-h-screen bg-background px-5 pb-24 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/documentos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>
      <h1 className="mt-3 text-2xl font-bold">Novo documento</h1>

      {loadingPatients ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando paciente...</p>
      ) : !active ? (
        <p className="mt-6 text-sm text-muted-foreground">Nenhum paciente ativo.</p>
      ) : (
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          {/* ── File selection ── */}
          <section className="space-y-3">
            <Label>Arquivo *</Label>

            {!file ? (
              isMobile ? (
                /* Mobile: two stacked buttons */
                <div className="grid gap-3">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 w-full gap-2 text-base"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-5 w-5" />
                    Tirar foto
                  </Button>

                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="sr-only"
                    onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 w-full gap-2 text-base"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    <ImagePlus className="h-5 w-5" />
                    Escolher da galeria
                  </Button>
                </div>
              ) : (
                /* Desktop: drag-and-drop zone */
                <>
                  <input
                    ref={desktopInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="sr-only"
                    onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => desktopInputRef.current?.click()}
                    onKeyDown={(e) => e.key === "Enter" && desktopInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
                      dragging
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        Arraste um arquivo ou clique para selecionar
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        JPEG, PNG ou PDF · máximo 20 MB
                      </p>
                    </div>
                  </div>
                </>
              )
            ) : (
              /* Preview */
              <div className="relative overflow-hidden rounded-2xl border bg-card">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview do documento"
                    className="max-h-64 w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-8">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="Remover arquivo"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow backdrop-blur-sm active:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          {/* ── Metadata form — shown after file is selected ── */}
          {file && (
            <section className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Receita cardiologista junho"
                  className="h-[52px]"
                  required
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as DocType })}
                >
                  <SelectTrigger className="h-[52px]">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Document date */}
              <div className="space-y-2">
                <Label htmlFor="document_date">Data do documento</Label>
                <Input
                  id="document_date"
                  type="date"
                  value={form.document_date ?? ""}
                  onChange={(e) => setForm({ ...form, document_date: e.target.value })}
                  className="h-[52px]"
                />
              </div>

              {/* Doctor */}
              <div className="space-y-2">
                <Label htmlFor="doctor_name">Médico</Label>
                <Input
                  id="doctor_name"
                  value={form.doctor_name ?? ""}
                  onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
                  placeholder="Ex.: Dra. Ana Lima"
                  className="h-[52px]"
                />
              </div>

              {/* Institution */}
              <div className="space-y-2">
                <Label htmlFor="institution">Instituição</Label>
                <Input
                  id="institution"
                  value={form.institution ?? ""}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  placeholder="Ex.: Hospital das Clínicas"
                  className="h-[52px]"
                />
              </div>

              {/* Expiry date */}
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Validade</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={form.expiry_date ?? ""}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className="h-[52px]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Qualquer informação adicional sobre o documento…"
                  rows={3}
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                disabled={saving}
                className="h-[52px] w-full text-base"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  "Salvar documento"
                )}
              </Button>
            </section>
          )}
        </form>
      )}
    </main>
  );
}
