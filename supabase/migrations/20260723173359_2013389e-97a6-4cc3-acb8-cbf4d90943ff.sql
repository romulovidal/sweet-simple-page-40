
-- Series
CREATE TABLE public.atis_series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme text,
  items jsonb not null default '[]'::jsonb,
  send_time text not null default '07:00',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_series TO authenticated;
GRANT ALL ON public.atis_series TO service_role;
ALTER TABLE public.atis_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all series" ON public.atis_series FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.atis_series_subscribers (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.atis_series(id) on delete cascade,
  phone text not null,
  name text,
  contact_id uuid references public.atis_contacts(id) on delete set null,
  current_day integer not null default 1,
  started_at timestamptz not null default now(),
  active boolean not null default true,
  last_sent_date date,
  created_at timestamptz not null default now(),
  unique (series_id, phone)
);
CREATE INDEX ON public.atis_series_subscribers (active, series_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_series_subscribers TO authenticated;
GRANT ALL ON public.atis_series_subscribers TO service_role;
ALTER TABLE public.atis_series_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all series subs" ON public.atis_series_subscribers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Plan subscribers
CREATE TABLE public.atis_plan_subscribers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.admin_plans(id) on delete cascade,
  phone text not null,
  name text,
  contact_id uuid references public.atis_contacts(id) on delete set null,
  send_time text not null default '07:00',
  current_day integer not null default 1,
  started_at timestamptz not null default now(),
  active boolean not null default true,
  last_sent_date date,
  created_at timestamptz not null default now(),
  unique (plan_id, phone)
);
CREATE INDEX ON public.atis_plan_subscribers (active, plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_plan_subscribers TO authenticated;
GRANT ALL ON public.atis_plan_subscribers TO service_role;
ALTER TABLE public.atis_plan_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all plan subs" ON public.atis_plan_subscribers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Crisis alerts
CREATE TABLE public.atis_crisis_alerts (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null,
  contact_name text,
  matched_keywords text[] not null default '{}',
  severity text not null default 'medium',
  snippet text,
  pastor_notified boolean not null default false,
  handled boolean not null default false,
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
CREATE INDEX ON public.atis_crisis_alerts (handled, created_at DESC);
CREATE INDEX ON public.atis_crisis_alerts (contact_phone, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_crisis_alerts TO authenticated;
GRANT ALL ON public.atis_crisis_alerts TO service_role;
ALTER TABLE public.atis_crisis_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all alerts" ON public.atis_crisis_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Welcome tracking
ALTER TABLE public.atis_contacts ADD COLUMN IF NOT EXISTS welcomed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atis_welcomed_at timestamptz;

-- updated_at triggers
CREATE TRIGGER atis_series_updated BEFORE UPDATE ON public.atis_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
