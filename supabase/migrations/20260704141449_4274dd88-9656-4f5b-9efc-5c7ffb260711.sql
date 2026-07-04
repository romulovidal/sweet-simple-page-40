
-- Rate limiting table (fixed window per identifier + endpoint)
CREATE TABLE public.rate_limits (
  identifier text NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (identifier, endpoint, window_start)
);

-- No client access — only used by edge functions via service_role
GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Restrictive: block anon and authenticated entirely (defense in depth)
CREATE POLICY "no_client_access_rate_limits"
ON public.rate_limits
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Index for cleanup
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits (window_start);

-- Atomic check-and-increment. Returns { allowed boolean, current int, limit int, retry_after int }
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  _identifier text,
  _endpoint text,
  _max integer,
  _window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz := to_timestamp((floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds));
  _count integer;
  _retry_after integer;
BEGIN
  INSERT INTO public.rate_limits (identifier, endpoint, window_start, count)
  VALUES (_identifier, _endpoint, _bucket, 1)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO _count;

  -- Opportunistic cleanup of rows older than 1 hour (1% of calls)
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  END IF;

  _retry_after := GREATEST(
    0,
    _window_seconds - CAST(EXTRACT(EPOCH FROM (now() - _bucket)) AS integer)
  );

  RETURN jsonb_build_object(
    'allowed', _count <= _max,
    'current', _count,
    'limit', _max,
    'retry_after', _retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, text, integer, integer) TO service_role;
