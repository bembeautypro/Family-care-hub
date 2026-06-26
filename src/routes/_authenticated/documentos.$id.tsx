import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getSignedMedicalDocUrl } from "@/lib/supabase/storage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";

// react-pdf depends on pdfjs which references DOMMatrix (browser-only).
// Disable SSR for this route and lazy-load the viewer to keep pdfjs out of the
// server bundle entirely.
const PdfViewer = lazy(() => import("@/components/documents/PdfViewer"));

export const Route = createFileRoute("/_authenticated/documentos/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Documento — Amparo" }] }),
  component: DocumentViewer,
});

type DocumentRow = {
  id: string;
  title: string;
  file_path: string;
  file_mime_type: string | null;
};

function DocumentViewer() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_path, file_mime_type")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setLoadError(error?.message ?? "Documento não encontrado.");
        return;
      }
      setDoc(data as DocumentRow);
      try {
        const url = await getSignedMedicalDocUrl(data.file_path, 3600);
        if (!cancelled) setSignedUrl(url);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Erro ao gerar URL do arquivo.";
          setLoadError(msg);
          toast.error(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isPdf = useMemo(() => {
    const mime = doc?.file_mime_type ?? "";
    if (mime === "application/pdf") return true;
    if (doc?.file_path?.toLowerCase().endsWith(".pdf")) return true;
    return false;
  }, [doc]);

  const isImage = useMemo(() => {
    const mime = doc?.file_mime_type ?? "";
    return mime.startsWith("image/");
  }, [doc]);

  function openExternal() {
    if (signedUrl) window.open(signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-5 py-4">
        <header className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/documentos" })}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
            {doc?.title ?? "Documento"}
          </h1>
          {signedUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={openExternal}
              aria-label="Abrir em nova aba"
            >
              <ExternalLink className="h-5 w-5" />
            </Button>
          )}
        </header>

        {loadError ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/documentos">Voltar para documentos</Link>
            </Button>
          </div>
        ) : !signedUrl ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : isPdf ? (
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
            <PdfViewer url={signedUrl} onOpenExternal={openExternal} />
          </Suspense>
        ) : isImage ? (
          <div className="rounded-2xl border bg-card p-3">
            <img
              src={signedUrl}
              alt={doc?.title ?? "Documento"}
              className="mx-auto max-h-[80vh] w-auto rounded-lg"
            />
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Visualização inline não disponível para este tipo de arquivo.
            </p>
            <Button onClick={openExternal} className="mt-4">
              <Download className="mr-2 h-4 w-4" />
              Abrir arquivo
            </Button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
