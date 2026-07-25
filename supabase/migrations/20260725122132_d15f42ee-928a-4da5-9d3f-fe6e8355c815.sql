ALTER TABLE public.atis_groups
  ADD COLUMN IF NOT EXISTS notification_times jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.atis_groups.notification_times IS
  'Map of notification type -> "HH:MM" (Fortaleza-CE). If a type has no entry, the global default time is used.';