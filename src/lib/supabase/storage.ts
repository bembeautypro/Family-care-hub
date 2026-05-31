import { supabase } from "@/integrations/supabase/client";

export const MEDICAL_DOCS_BUCKET = "medical-documents";

/**
 * Gera uma URL assinada de curta duração para um arquivo do bucket privado
 * `medical-documents`. Sempre prefira esta função em vez de armazenar/exibir
 * URLs públicas — o bucket é PRIVADO e o `file_path` é o que vive no banco.
 *
 * Convenção de path: `{family_id}/{patient_id}/{filename}` (alinhado às RLS
 * policies de storage.objects definidas na migration de fundação).
 */
export async function getSignedMedicalDocUrl(
  filePath: string,
  expiresInSeconds = 60 * 5,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEDICAL_DOCS_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Falha ao gerar URL assinada para ${filePath}: ${error?.message ?? "sem URL"}`,
    );
  }

  return data.signedUrl;
}
