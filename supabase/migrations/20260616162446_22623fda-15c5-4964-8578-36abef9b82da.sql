
-- ============================================================
-- P0-01 (A1): preserve forensic trail on access_logs
-- ============================================================
ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS family_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS patient_id_snapshot uuid;

-- Backfill from current FK values (and infer family from patient when missing)
UPDATE public.access_logs al
  SET family_id_snapshot = COALESCE(al.family_id_snapshot, al.family_id,
        (SELECT p.family_id FROM public.patients p WHERE p.id = al.patient_id)),
      patient_id_snapshot = COALESCE(al.patient_id_snapshot, al.patient_id);

CREATE INDEX IF NOT EXISTS idx_access_logs_family_snapshot
  ON public.access_logs(family_id_snapshot);

-- Trigger: auto-populate snapshots on insert
CREATE OR REPLACE FUNCTION public.access_logs_set_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.family_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    SELECT family_id INTO NEW.family_id
      FROM public.patients WHERE id = NEW.patient_id;
  END IF;
  NEW.family_id_snapshot  := COALESCE(NEW.family_id_snapshot,  NEW.family_id);
  NEW.patient_id_snapshot := COALESCE(NEW.patient_id_snapshot, NEW.patient_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS access_logs_set_snapshots_trg ON public.access_logs;
CREATE TRIGGER access_logs_set_snapshots_trg
  BEFORE INSERT ON public.access_logs
  FOR EACH ROW EXECUTE FUNCTION public.access_logs_set_snapshots();

-- Replace policy to read via snapshot (survives FK SET NULL)
DROP POLICY IF EXISTS "members can read own family access_logs" ON public.access_logs;
CREATE POLICY "members can read own family access_logs"
  ON public.access_logs FOR SELECT
  USING (family_id_snapshot IS NOT NULL
         AND public.is_family_member(family_id_snapshot));

-- ============================================================
-- P0-02 (M1): rate-limit table for /e/$token
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emergency_rate_limits (
  ip_address   text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_address, window_start)
);

CREATE INDEX IF NOT EXISTS idx_emergency_rate_limits_window
  ON public.emergency_rate_limits(window_start);

GRANT ALL ON public.emergency_rate_limits TO service_role;

ALTER TABLE public.emergency_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only service_role (server fn) reads/writes.
