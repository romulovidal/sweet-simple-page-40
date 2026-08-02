CREATE TABLE public.harpa_overrides (
  number integer PRIMARY KEY,
  title text NOT NULL,
  secoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.harpa_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.harpa_overrides TO authenticated;
GRANT ALL ON public.harpa_overrides TO service_role;

ALTER TABLE public.harpa_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Harpa overrides are viewable by everyone"
ON public.harpa_overrides FOR SELECT
USING (true);

CREATE POLICY "Admins can insert harpa overrides"
ON public.harpa_overrides FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update harpa overrides"
ON public.harpa_overrides FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete harpa overrides"
ON public.harpa_overrides FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_harpa_overrides_updated_at
BEFORE UPDATE ON public.harpa_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();