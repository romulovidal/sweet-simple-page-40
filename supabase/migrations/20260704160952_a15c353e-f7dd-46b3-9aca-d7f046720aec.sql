CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id text,
  event_name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_name_time ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX idx_analytics_events_user_time ON public.analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_device_time ON public.analytics_events (device_id, created_at DESC) WHERE device_id IS NOT NULL;

GRANT ALL ON public.analytics_events TO service_role;
-- Admin lê via has_role; usuários finais nunca leem essa tabela diretamente.

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read analytics" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Block client writes on analytics" ON public.analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Block client updates on analytics" ON public.analytics_events
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Admins can delete analytics" ON public.analytics_events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Retenção: extender cleanup_old_data para apagar eventos com >90 dias
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _push_log_deleted int;
  _admin_log_deleted int;
  _device_deleted int;
  _rate_deleted int;
  _history_trimmed int;
  _analytics_deleted int;
BEGIN
  DELETE FROM public.push_log WHERE sent_at < now() - interval '30 days';
  GET DIAGNOSTICS _push_log_deleted = ROW_COUNT;

  DELETE FROM public.admin_activity_log WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS _admin_log_deleted = ROW_COUNT;

  DELETE FROM public.device_streaks WHERE updated_at < now() - interval '180 days';
  GET DIAGNOSTICS _device_deleted = ROW_COUNT;

  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  GET DIAGNOSTICS _rate_deleted = ROW_COUNT;

  DELETE FROM public.analytics_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS _analytics_deleted = ROW_COUNT;

  WITH trimmed AS (
    UPDATE public.device_streaks ds
    SET history = (
      SELECT array_agg(v ORDER BY v)
      FROM (
        SELECT unnest(ds.history) AS v
        ORDER BY 1 DESC
        LIMIT 365
      ) t
    )
    WHERE array_length(ds.history, 1) > 365
    RETURNING 1
  )
  SELECT count(*) INTO _history_trimmed FROM trimmed;

  RETURN jsonb_build_object(
    'push_log_deleted', _push_log_deleted,
    'admin_activity_log_deleted', _admin_log_deleted,
    'device_streaks_deleted', _device_deleted,
    'rate_limits_deleted', _rate_deleted,
    'analytics_events_deleted', _analytics_deleted,
    'device_history_trimmed', _history_trimmed,
    'ran_at', now()
  );
END;
$$;

-- RPC para agregações do admin (top eventos + série diária)
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_days_back int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH win AS (
    SELECT now() - make_interval(days => _days_back) AS since
  ),
  base AS (
    SELECT * FROM public.analytics_events, win WHERE created_at >= win.since
  ),
  totals AS (
    SELECT
      count(*)::int AS total_events,
      count(DISTINCT COALESCE(user_id::text, device_id))::int AS unique_actors
    FROM base
  ),
  top_events AS (
    SELECT event_name, count(*)::int AS n
    FROM base GROUP BY event_name ORDER BY n DESC LIMIT 10
  ),
  by_day AS (
    SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, count(*)::int AS n
    FROM base GROUP BY 1 ORDER BY 1
  ),
  top_chapters AS (
    SELECT props->>'book' AS book, (props->>'chapter')::int AS chapter, count(*)::int AS n
    FROM base
    WHERE event_name = 'chapter_view' AND props ? 'book' AND props ? 'chapter'
    GROUP BY 1,2 ORDER BY n DESC LIMIT 10
  ),
  top_searches AS (
    SELECT lower(props->>'q') AS q, count(*)::int AS n
    FROM base
    WHERE event_name = 'search' AND (props->>'q') IS NOT NULL AND length(props->>'q') > 0
    GROUP BY 1 ORDER BY n DESC LIMIT 10
  )
  SELECT jsonb_build_object(
    'days_back', _days_back,
    'generated_at', now(),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'top_events', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM top_events e), '[]'::jsonb),
    'by_day', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM by_day d), '[]'::jsonb),
    'top_chapters', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM top_chapters c), '[]'::jsonb),
    'top_searches', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM top_searches s), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(int) TO authenticated;