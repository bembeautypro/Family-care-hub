
-- 1) Push subscriptions per device
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS push_subscriptions_user_active_idx
  ON public.push_subscriptions (user_id)
  WHERE disabled_at IS NULL;

-- 2) Reminder log (idempotency for cron)
CREATE TABLE IF NOT EXISTS public.medication_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipient_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  UNIQUE (medication_id, scheduled_for)
);

GRANT SELECT ON public.medication_reminder_log TO authenticated;
GRANT ALL ON public.medication_reminder_log TO service_role;

ALTER TABLE public.medication_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can read reminder log"
  ON public.medication_reminder_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      JOIN public.patients p ON p.id = m.patient_id
      WHERE m.id = medication_reminder_log.medication_id
        AND public.is_family_member(p.family_id)
    )
  );

CREATE INDEX IF NOT EXISTS medication_reminder_log_scheduled_idx
  ON public.medication_reminder_log (scheduled_for DESC);

-- 3) Patient timezone for window calculation
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
