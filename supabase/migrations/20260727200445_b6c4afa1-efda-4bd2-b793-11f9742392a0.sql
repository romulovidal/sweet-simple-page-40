-- Culto Selections: admin curates hymns for a specific culto date
CREATE TABLE public.culto_selections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  culto_date date NOT NULL,
  schedule_id uuid REFERENCES public.culto_schedules(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_culto_selections_date ON public.culto_selections(culto_date DESC);
CREATE INDEX idx_culto_selections_active ON public.culto_selections(is_active, culto_date DESC);

GRANT SELECT ON public.culto_selections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.culto_selections TO authenticated;
GRANT ALL ON public.culto_selections TO service_role;

ALTER TABLE public.culto_selections ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read active selections
CREATE POLICY "Culto selections are viewable by everyone"
  ON public.culto_selections FOR SELECT
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert culto selections"
  ON public.culto_selections FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update culto selections"
  ON public.culto_selections FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete culto selections"
  ON public.culto_selections FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_culto_selections_updated_at
  BEFORE UPDATE ON public.culto_selections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();