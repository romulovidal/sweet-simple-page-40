
CREATE TABLE public.device_streaks (
  device_id text PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  history text[] NOT NULL DEFAULT '{}',
  last_seen_date date,
  user_agent text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.device_streaks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_streaks TO authenticated;
GRANT ALL ON public.device_streaks TO service_role;

ALTER TABLE public.device_streaks ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can upsert/read their device row. We can't tie to auth for anon.
CREATE POLICY "Anyone can read device streaks"
  ON public.device_streaks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert device streaks"
  ON public.device_streaks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update device streaks"
  ON public.device_streaks FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete device streaks"
  ON public.device_streaks FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_device_streaks_updated_at
  BEFORE UPDATE ON public.device_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
