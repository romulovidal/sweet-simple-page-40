CREATE TABLE public.atis_crisis_mutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  pastor_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_phone, pastor_phone)
);
CREATE INDEX atis_crisis_mutes_contact_idx ON public.atis_crisis_mutes (contact_phone);
CREATE INDEX atis_crisis_mutes_pastor_idx ON public.atis_crisis_mutes (pastor_phone);
GRANT ALL ON public.atis_crisis_mutes TO service_role;
ALTER TABLE public.atis_crisis_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins can view crisis mutes" ON public.atis_crisis_mutes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));