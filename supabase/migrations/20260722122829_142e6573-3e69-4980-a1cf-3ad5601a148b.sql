
CREATE TABLE public.atis_config (
  id int PRIMARY KEY DEFAULT 1,
  bot_name text NOT NULL DEFAULT 'Atis',
  avatar_url text,
  persona text DEFAULT 'Sou o Atis, assistente ministerial da Bíblia Atalaia. Falo com tom pastoral, breve e respeitoso.',
  timezone text NOT NULL DEFAULT 'America/Fortaleza',
  active boolean NOT NULL DEFAULT true,
  mention_only_default boolean NOT NULL DEFAULT true,
  trigger_words text[] NOT NULL DEFAULT ARRAY['atis','@atis'],
  commands jsonb NOT NULL DEFAULT '{"versiculo":true,"buscar":true,"hino":true,"devocional":true,"oracao":true,"estudo":true,"aniversariantes":true}'::jsonb,
  evolution_url text,
  evolution_instance text,
  bot_number text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atis_config_singleton CHECK (id = 1)
);

CREATE TABLE public.atis_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  tags text[] NOT NULL DEFAULT '{}',
  opt_in boolean NOT NULL DEFAULT true,
  birthday date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.atis_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_group_id text UNIQUE,
  name text NOT NULL,
  respond_mode text NOT NULL DEFAULT 'mention_only' CHECK (respond_mode IN ('mention_only','always','off')),
  active boolean NOT NULL DEFAULT true,
  welcome_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.atis_birthdays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  birth_date date NOT NULL,
  phone text,
  group_id uuid REFERENCES public.atis_groups(id) ON DELETE SET NULL,
  message_template text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX atis_birthdays_birth_date_idx ON public.atis_birthdays (birth_date);

CREATE TABLE public.atis_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('contact','tag','group','all')),
  target_ref text,
  content_type text NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','verse','hino','study','devotional')),
  scheduled_at timestamptz,
  recurrence text CHECK (recurrence IS NULL OR recurrence IN ('once','daily','weekly')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX atis_broadcasts_scheduled_idx ON public.atis_broadcasts (scheduled_at) WHERE status = 'pending';

CREATE TABLE public.atis_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  theme text,
  base_text text NOT NULL,
  refs text[] NOT NULL DEFAULT '{}',
  questions text[] NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.atis_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  wa_from text,
  wa_to text,
  wa_group_id text,
  body text,
  command text,
  status text,
  error text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX atis_messages_log_created_at_idx ON public.atis_messages_log (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_config, public.atis_contacts, public.atis_groups,
  public.atis_birthdays, public.atis_broadcasts, public.atis_studies, public.atis_messages_log TO authenticated;
GRANT ALL ON public.atis_config, public.atis_contacts, public.atis_groups,
  public.atis_birthdays, public.atis_broadcasts, public.atis_studies, public.atis_messages_log TO service_role;

ALTER TABLE public.atis_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_birthdays   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_broadcasts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_studies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_messages_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage atis_config" ON public.atis_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage atis_contacts" ON public.atis_contacts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage atis_groups" ON public.atis_groups
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage atis_birthdays" ON public.atis_birthdays
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage atis_broadcasts" ON public.atis_broadcasts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage atis_studies" ON public.atis_studies
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage atis_messages_log" ON public.atis_messages_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER atis_config_updated_at BEFORE UPDATE ON public.atis_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER atis_contacts_updated_at BEFORE UPDATE ON public.atis_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER atis_groups_updated_at BEFORE UPDATE ON public.atis_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER atis_birthdays_updated_at BEFORE UPDATE ON public.atis_birthdays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER atis_broadcasts_updated_at BEFORE UPDATE ON public.atis_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER atis_studies_updated_at BEFORE UPDATE ON public.atis_studies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.atis_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
