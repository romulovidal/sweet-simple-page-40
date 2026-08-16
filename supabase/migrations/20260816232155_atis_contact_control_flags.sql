ALTER TABLE public.atis_contacts
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

CREATE INDEX IF NOT EXISTS idx_atis_contacts_active_blocked
  ON public.atis_contacts(is_active, blocked);

COMMENT ON COLUMN public.atis_contacts.blocked IS 'ATIS-local administrative block. Does not modify the user profile or WhatsApp registration.';