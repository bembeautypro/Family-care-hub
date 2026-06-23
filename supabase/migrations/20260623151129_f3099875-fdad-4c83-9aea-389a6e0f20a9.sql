-- 1) Backfill responsible_user_id em appointments antigos usando o primeiro admin ativo da família do paciente
UPDATE public.appointments a
SET responsible_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (p.id) p.id AS patient_id, fm.user_id
  FROM public.patients p
  JOIN public.family_members fm ON fm.family_id = p.family_id
  WHERE fm.status = 'active' AND fm.role = 'admin'
  ORDER BY p.id, fm.created_at ASC
) sub
WHERE a.responsible_user_id IS NULL
  AND a.patient_id = sub.patient_id;

-- Fallback: se ainda restou algum (sem admin), usa qualquer membro ativo
UPDATE public.appointments a
SET responsible_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (p.id) p.id AS patient_id, fm.user_id
  FROM public.patients p
  JOIN public.family_members fm ON fm.family_id = p.family_id
  WHERE fm.status = 'active'
  ORDER BY p.id, fm.created_at ASC
) sub
WHERE a.responsible_user_id IS NULL
  AND a.patient_id = sub.patient_id;

-- 2) Tornar responsible_user_id NOT NULL
ALTER TABLE public.appointments
  ALTER COLUMN responsible_user_id SET NOT NULL;

-- 3) Adicionar coluna status em medication_doses
ALTER TABLE public.medication_doses
  ADD COLUMN status text NOT NULL DEFAULT 'taken'
  CHECK (status IN ('taken', 'skipped'));

-- Reversão:
-- ALTER TABLE public.appointments ALTER COLUMN responsible_user_id DROP NOT NULL;
-- ALTER TABLE public.medication_doses DROP COLUMN status;