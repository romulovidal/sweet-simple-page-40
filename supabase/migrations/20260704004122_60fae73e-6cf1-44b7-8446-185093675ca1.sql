-- Ajusta a view e a policy do versículo do dia para o fuso de Fortaleza-CE (UTC-3, sem horário de verão)
CREATE OR REPLACE VIEW public.current_daily_verse
WITH (security_invoker = on) AS
SELECT id, verse_text, verse_ref, scheduled_date, created_at
FROM public.daily_verse_queue
WHERE scheduled_date = ((now() AT TIME ZONE 'America/Fortaleza')::date)
ORDER BY created_at DESC
LIMIT 1;

GRANT SELECT ON public.current_daily_verse TO anon;
GRANT SELECT ON public.current_daily_verse TO authenticated;
GRANT SELECT ON public.current_daily_verse TO service_role;

DROP POLICY IF EXISTS "Public can read current manual daily verse" ON public.daily_verse_queue;

CREATE POLICY "Public can read current manual daily verse"
  ON public.daily_verse_queue
  FOR SELECT
  TO public
  USING (scheduled_date = ((now() AT TIME ZONE 'America/Fortaleza')::date));