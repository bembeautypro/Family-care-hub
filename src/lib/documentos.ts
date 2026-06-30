import { supabase } from "@/integrations/supabase/client";

/**
 * Encapsula a string mágica "search_vector" (coluna gerada do Postgres).
 * Toda busca server-side de documentos deve usar este helper —
 * nunca duplicar o nome da coluna ou o config tsvector pelo app.
 */
const SEARCH_VECTOR_COLUMN = "search_vector";
const SEARCH_CONFIG = "portuguese";

export const DOCUMENT_LIST_COLUMNS =
  "id, title, type, file_path, file_mime_type, document_date, institution, doctor_name" as const;

export type DocumentListRow = {
  id: string;
  title: string;
  type: string | null;
  file_path: string;
  file_mime_type: string | null;
  document_date: string | null;
  institution: string | null;
  doctor_name: string | null;
};

export function searchDocuments(params: { patientId: string; query?: string }) {
  let req = supabase
    .from("documents")
    .select(DOCUMENT_LIST_COLUMNS)
    .eq("patient_id", params.patientId)
    .is("deleted_at", null)
    .order("document_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const q = params.query?.trim();
  if (q) {
    req = req.textSearch(SEARCH_VECTOR_COLUMN, q, { config: SEARCH_CONFIG });
  }
  return req;
}
