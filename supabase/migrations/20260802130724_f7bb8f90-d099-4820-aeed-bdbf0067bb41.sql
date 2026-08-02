CREATE TABLE public.harpa_playbacks (
  hino_number integer PRIMARY KEY,
  youtube_url text,
  cues jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.harpa_playbacks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.harpa_playbacks TO authenticated;
GRANT ALL ON public.harpa_playbacks TO service_role;

ALTER TABLE public.harpa_playbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playbacks are viewable by everyone"
ON public.harpa_playbacks FOR SELECT
USING (true);

CREATE POLICY "Admins can insert playbacks"
ON public.harpa_playbacks FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update playbacks"
ON public.harpa_playbacks FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete playbacks"
ON public.harpa_playbacks FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_harpa_playbacks_updated_at
BEFORE UPDATE ON public.harpa_playbacks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();