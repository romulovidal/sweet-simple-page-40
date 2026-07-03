
ALTER TABLE public.culto_reminders
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE public.culto_reminders
  ALTER COLUMN minutes_before DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_culto_reminders_scheduled_at
  ON public.culto_reminders(scheduled_at)
  WHERE scheduled_at IS NOT NULL;
