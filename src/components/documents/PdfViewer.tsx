import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Document as PdfDocument, Page as PdfPage, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// PDF.js worker via CDN (matches bundled pdfjs version).
// This module is only ever imported in the browser (lazy + ssr:false route).
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  url: string;
  onOpenExternal: () => void;
};

export default function PdfViewer({ url, onOpenExternal }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(360);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function updateWidth() {
      setPageWidth(Math.min(window.innerWidth - 40, 720));
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Não foi possível renderizar este PDF.
        <Button
          variant="link"
          onClick={onOpenExternal}
          className="ml-1 h-auto p-0 align-baseline"
        >
          Abrir externamente
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-3">
      <PdfDocument
        file={url}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setPageNumber(1);
        }}
        onLoadError={(err) => setError(err.message)}
        loading={<Skeleton className="h-96 w-full rounded-xl" />}
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
  );
}
