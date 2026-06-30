-- A3 — torna o snapshot de família obrigatório em access_logs
-- Backfill defensivo (caso o trigger access_logs_set_snapshots tenha sido contornado no passado)
UPDATE public.access_logs al
SET family_id_snapshot = COALESCE(
  al.family_id_snapshot,
  al.family_id,
  (SELECT p.family_id FROM public.patients p WHERE p.id = al.patient_id)
)
WHERE al.family_id_snapshot IS NULL;

-- Linhas órfãs irrecuperáveis (sem patient e sem família) são removidas (não há como auditá-las)
DELETE FROM public.access_logs WHERE family_id_snapshot IS NULL;

ALTER TABLE public.access_logs
  ALTER COLUMN family_id_snapshot SET NOT NULL;