CREATE OR REPLACE VIEW public.current_daily_verse
WITH (security_invoker = on) AS
SELECT id, verse_text, verse_ref, scheduled_date, created_at
FROM public.daily_verse_queue
WHERE scheduled_date <= ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
ORDER BY scheduled_date DESC, created_at DESC
LIMIT 1;

GRANT SELECT ON public.current_daily_verse TO anon;
GRANT SELECT ON public.current_daily_verse TO authenticated;
GRANT SELECT ON public.current_daily_verse TO service_role;