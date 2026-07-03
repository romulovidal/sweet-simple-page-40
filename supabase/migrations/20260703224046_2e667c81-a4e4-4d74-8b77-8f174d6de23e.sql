DROP POLICY IF EXISTS "Public can read today verse" ON public.daily_verse_queue;
CREATE POLICY "Public can read verse queue"
  ON public.daily_verse_queue
  FOR SELECT
  TO public
  USING (true);
GRANT SELECT ON public.daily_verse_queue TO anon, authenticated;