-- Add new columns
ALTER TABLE public.clinical_events
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS doctor_name text;

-- Normalize legacy values before adding CHECK
UPDATE public.clinical_events SET type = 'other' WHERE type IS NULL;
UPDATE public.clinical_events
SET type = CASE type
  WHEN 'procedure' THEN 'surgery'
  WHEN 'other' THEN 'family_note'
  ELSE type
END
WHERE type NOT IN ('consultation','exam','hospitalization','surgery','symptom','fall_accident','medication_change','diagnosis','followup','crisis','vaccine','family_note');

UPDATE public.clinical_events SET severity = 'low' WHERE severity IS NULL OR severity NOT IN ('low','medium','high','critical');

-- Drop existing constraints if any (idempotent)
ALTER TABLE public.clinical_events DROP CONSTRAINT IF EXISTS clinical_events_type_check;
ALTER TABLE public.clinical_events DROP CONSTRAINT IF EXISTS clinical_events_severity_check;

ALTER TABLE public.clinical_events
  ADD CONSTRAINT clinical_events_type_check CHECK (type IN (
    'consultation','exam','hospitalization','surgery','symptom',
    'fall_accident','medication_change','diagnosis','followup',
    'crisis','vaccine','family_note'
  ));

ALTER TABLE public.clinical_events
  ADD CONSTRAINT clinical_events_severity_check CHECK (severity IN ('low','medium','high','critical'));

-- Indexes for timeline performance
CREATE INDEX IF NOT EXISTS idx_clinical_events_patient_date
  ON public.clinical_events (patient_id, event_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_events_tags
  ON public.clinical_events USING GIN (tags);