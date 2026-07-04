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
BEGIN
  DELETE FROM public.push_log WHERE sent_at < now() - interval '30 days';
  GET DIAGNOSTICS _push_log_deleted = ROW_COUNT;

  DELETE FROM public.admin_activity_log WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS _admin_log_deleted = ROW_COUNT;

  DELETE FROM public.device_streaks WHERE updated_at < now() - interval '180 days';
  GET DIAGNOSTICS _device_deleted = ROW_COUNT;

  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  GET DIAGNOSTICS _rate_deleted = ROW_COUNT;

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
    'device_history_trimmed', _history_trimmed,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_data() TO service_role;