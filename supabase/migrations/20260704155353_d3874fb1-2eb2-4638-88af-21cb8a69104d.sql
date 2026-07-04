CREATE OR REPLACE FUNCTION public.get_retention_metrics(_days_back int DEFAULT 30)
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

  WITH params AS (
    SELECT (current_date - _days_back) AS start_date, current_date AS today
  ),
  -- Expand device_streaks histories
  device_days AS (
    SELECT ds.device_id AS entity, d::date AS day
    FROM public.device_streaks ds,
         LATERAL unnest(ds.history) AS d
  ),
  user_days AS (
    SELECT us.user_id::text AS entity, d::date AS day
    FROM public.user_streaks us,
         LATERAL unnest(us.history) AS d
  ),
  combined AS (
    SELECT 'device'::text AS source, entity, day FROM device_days
    UNION ALL
    SELECT 'user'::text, entity, day FROM user_days
  ),
  cohorts AS (
    SELECT source, day AS cohort_day, entity
    FROM combined, params
    WHERE day >= params.start_date AND day <= params.today
  ),
  retention_calc AS (
    SELECT
      c.source,
      c.cohort_day,
      COUNT(DISTINCT c.entity) AS cohort_size,
      COUNT(DISTINCT c.entity) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM combined cb
          WHERE cb.source = c.source AND cb.entity = c.entity AND cb.day = c.cohort_day + 1
        ) AND c.cohort_day + 1 <= (SELECT today FROM params)
      ) AS d1,
      COUNT(DISTINCT c.entity) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM combined cb
          WHERE cb.source = c.source AND cb.entity = c.entity AND cb.day = c.cohort_day + 7
        ) AND c.cohort_day + 7 <= (SELECT today FROM params)
      ) AS d7,
      COUNT(DISTINCT c.entity) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM combined cb
          WHERE cb.source = c.source AND cb.entity = c.entity AND cb.day = c.cohort_day + 30
        ) AND c.cohort_day + 30 <= (SELECT today FROM params)
      ) AS d30,
      -- Eligibility flags: cohort day must be old enough for the window to have passed
      ((SELECT today FROM params) - c.cohort_day) >= 1  AS eligible_d1,
      ((SELECT today FROM params) - c.cohort_day) >= 7  AS eligible_d7,
      ((SELECT today FROM params) - c.cohort_day) >= 30 AS eligible_d30
    FROM cohorts c
    GROUP BY c.source, c.cohort_day
  ),
  per_day AS (
    SELECT
      source,
      cohort_day,
      cohort_size,
      d1, d7, d30,
      eligible_d1, eligible_d7, eligible_d30
    FROM retention_calc
    ORDER BY cohort_day
  ),
  summary AS (
    SELECT
      source,
      SUM(cohort_size) FILTER (WHERE eligible_d1)::int  AS base_d1,
      SUM(d1)          FILTER (WHERE eligible_d1)::int  AS ret_d1,
      SUM(cohort_size) FILTER (WHERE eligible_d7)::int  AS base_d7,
      SUM(d7)          FILTER (WHERE eligible_d7)::int  AS ret_d7,
      SUM(cohort_size) FILTER (WHERE eligible_d30)::int AS base_d30,
      SUM(d30)         FILTER (WHERE eligible_d30)::int AS ret_d30
    FROM per_day
    GROUP BY source
  )
  SELECT jsonb_build_object(
    'days_back', _days_back,
    'generated_at', now(),
    'summary', COALESCE(jsonb_object_agg(s.source, jsonb_build_object(
      'd1',  jsonb_build_object('base', s.base_d1,  'retained', s.ret_d1,  'rate', CASE WHEN COALESCE(s.base_d1,0)  > 0 THEN round(s.ret_d1::numeric  / s.base_d1  * 100, 1) ELSE NULL END),
      'd7',  jsonb_build_object('base', s.base_d7,  'retained', s.ret_d7,  'rate', CASE WHEN COALESCE(s.base_d7,0)  > 0 THEN round(s.ret_d7::numeric  / s.base_d7  * 100, 1) ELSE NULL END),
      'd30', jsonb_build_object('base', s.base_d30, 'retained', s.ret_d30, 'rate', CASE WHEN COALESCE(s.base_d30,0) > 0 THEN round(s.ret_d30::numeric / s.base_d30 * 100, 1) ELSE NULL END)
    )), '{}'::jsonb),
    'per_day', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.cohort_day) FROM per_day p), '[]'::jsonb)
  )
  INTO _result
  FROM summary s;

  RETURN COALESCE(_result, jsonb_build_object('summary', '{}'::jsonb, 'per_day', '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_retention_metrics(int) TO authenticated;