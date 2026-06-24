import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { Document as PdfDocument, Page as PdfPage, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getSignedMedicalDocUrl } from "@/lib/supabase/storage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";

// PDF.js worker via CDN (matches react-pdf bundled pdfjs version)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const Route = createFileRoute("/_authenticated/documentos/$id")({
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
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState<number>(360);

  useEffect(() => {
    function updateWidth() {
      const w = Math.min(window.innerWidth - 40, 720);
      setPageWidth(w);
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

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
          setLoadError(err instanceof Error ? err.message : "Erro ao gerar URL do arquivo.");
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
          <div className="rounded-2xl border bg-card p-3">
            <PdfDocument
              file={signedUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setPageNumber(1);
              }}
              onLoadError={(err) => setLoadError(err.message)}
              loading={<Skeleton className="h-96 w-full rounded-xl" />}
              error={
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Não foi possível renderizar este PDF.
                  <Button
                    variant="link"
                    onClick={openExternal}
                    className="ml-1 h-auto p-0 align-baseline"
                  >
                    Abrir externamente
                  </Button>
                </div>
              }
            >
              <PdfPage
                pageNumber={pageNumber}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </PdfDocument>
            {numPages && numPages > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {pageNumber} de {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                >
                  Próxima
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
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
