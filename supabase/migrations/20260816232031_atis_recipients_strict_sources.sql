-- ATIS recipient model: strict source separation
-- Contacts = app profiles only
-- Individuals = manually registered external numbers
-- Groups = explicitly registered by an admin after on-demand provider discovery

DELETE FROM public.atis_groups;
DELETE FROM public.atis_contacts WHERE source <> 'app';

ALTER TABLE public.atis_contacts DROP CONSTRAINT IF EXISTS atis_contacts_source_check;
ALTER TABLE public.atis_contacts
  ADD CONSTRAINT atis_contacts_source_check CHECK (source = 'app');
ALTER TABLE public.atis_contacts ALTER COLUMN source SET DEFAULT 'app';
ALTER TABLE public.atis_contacts DROP COLUMN IF EXISTS provider_contact_id;

CREATE UNIQUE INDEX IF NOT EXISTS atis_contacts_user_id_uidx
  ON public.atis_contacts(user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.atis_individuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone_e164 text NOT NULL UNIQUE,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  notes text,
  birth_date date,
  allow_messages boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atis_individuals_phone_e164_check CHECK (phone_e164 ~ '^[+][1-9][0-9]{7,14}$')
);

ALTER TABLE public.atis_individuals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atis_individuals_admin_select ON public.atis_individuals;
CREATE POLICY atis_individuals_admin_select
  ON public.atis_individuals
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::text));

DROP TRIGGER IF EXISTS update_atis_individuals_updated_at ON public.atis_individuals;
CREATE TRIGGER update_atis_individuals_updated_at
  BEFORE UPDATE ON public.atis_individuals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_atis_individuals_active_name
  ON public.atis_individuals(is_active, name);
CREATE INDEX IF NOT EXISTS idx_atis_individuals_tags
  ON public.atis_individuals USING gin(tags);

ALTER TABLE public.atis_groups
  ADD COLUMN IF NOT EXISTS allow_manual_send boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS provider_exists boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE public.atis_groups ALTER COLUMN allow_automations SET DEFAULT false;

ALTER TABLE public.atis_group_members DROP CONSTRAINT IF EXISTS atis_group_members_contact_id_fkey;
DROP INDEX IF EXISTS public.idx_atis_group_members_contact_id;
ALTER TABLE public.atis_group_members DROP COLUMN IF EXISTS contact_id;

ALTER TABLE public.atis_message_targets
  ADD COLUMN IF NOT EXISTS individual_id uuid REFERENCES public.atis_individuals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atis_message_targets_individual_id
  ON public.atis_message_targets(individual_id)
  WHERE individual_id IS NOT NULL;

ALTER TABLE public.atis_message_targets DROP CONSTRAINT IF EXISTS atis_message_targets_check;
ALTER TABLE public.atis_message_targets
  ADD CONSTRAINT atis_message_targets_check CHECK (
    (target_type = 'individual' AND individual_id IS NOT NULL AND phone_e164 IS NOT NULL AND contact_id IS NULL AND group_id IS NULL)
    OR
    (target_type = 'contact' AND contact_id IS NOT NULL AND phone_e164 IS NOT NULL AND individual_id IS NULL AND group_id IS NULL)
    OR
    (target_type = 'group' AND group_id IS NOT NULL AND provider_target_id IS NOT NULL AND individual_id IS NULL AND contact_id IS NULL)
  );

COMMENT ON TABLE public.atis_contacts IS 'ATIS contacts originating exclusively from registered app profiles with a WhatsApp number. Never populated from the connected WhatsApp address book.';
COMMENT ON TABLE public.atis_individuals IS 'External WhatsApp recipients explicitly created by an ATIS administrator; not app users and not imported from the connected phone.';
COMMENT ON TABLE public.atis_groups IS 'WhatsApp groups explicitly registered by an ATIS administrator after on-demand discovery. Unselected provider groups are never persisted here.';
COMMENT ON TABLE public.atis_group_members IS 'Membership snapshot for ATIS-registered groups only. Members are not promoted/imported into contacts.';