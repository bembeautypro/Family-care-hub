-- Tabela de registros de tomada de medicamentos (uma linha por dose programada confirmada)
CREATE TABLE public.medication_doses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_doses TO authenticated;
GRANT ALL ON public.medication_doses TO service_role;

ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;

-- Membros da família do paciente podem ver
CREATE POLICY "Family members can view doses"
  ON public.medication_doses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = medication_doses.patient_id
        AND public.is_family_member(p.family_id)
    )
  );

-- Membros podem registrar
CREATE POLICY "Family members can insert doses"
  ON public.medication_doses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = medication_doses.patient_id
        AND public.is_family_member(p.family_id)
    )
  );

-- Membros podem corrigir/desfazer registro
CREATE POLICY "Family members can update doses"
  ON public.medication_doses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = medication_doses.patient_id
        AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "Family members can delete doses"
  ON public.medication_doses FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = medication_doses.patient_id
        AND public.is_family_member(p.family_id)
    )
  );

-- Índice para consultas do dashboard (doses do dia por paciente)
CREATE INDEX idx_medication_doses_patient_scheduled
  ON public.medication_doses (patient_id, scheduled_at DESC);

-- Reversão: DROP TABLE public.medication_doses CASCADE;