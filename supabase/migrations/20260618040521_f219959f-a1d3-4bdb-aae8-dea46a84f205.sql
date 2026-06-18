CREATE INDEX IF NOT EXISTS idx_medications_patient_active ON public.medications(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_patient_active ON public.appointments(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_patient_active ON public.documents(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient_active ON public.patient_conditions(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient_active ON public.patient_allergies(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_patient_active ON public.emergency_contacts(patient_id) WHERE deleted_at IS NULL;