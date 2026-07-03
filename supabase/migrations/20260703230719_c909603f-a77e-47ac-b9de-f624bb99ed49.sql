GRANT SELECT ON public.daily_verse_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_verse_queue TO authenticated;
GRANT ALL ON public.daily_verse_queue TO service_role;

DROP POLICY IF EXISTS "Public can read feature flags only" ON public.admin_settings;
CREATE POLICY "Public can read safe app settings"
  ON public.admin_settings
  FOR SELECT
  TO public
  USING (key = ANY (ARRAY['ai_features', 'app_features', 'daily_verse_version']));