ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.profiles.birth_date IS
  'Optional member birth date. Used by ATIS birthday synchronization; independent from WhatsApp and WhatsApp opt-in.';