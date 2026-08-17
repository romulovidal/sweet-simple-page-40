-- ATIS queue + birthday schedulers. Both are idempotent and service-role protected.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname = 'atis-runner-every-minute' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname = 'atis-birthday-runner-every-minute' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'atis-birthday-runner-every-minute',
  '* * * * *',
  $$select private.edge_call('atis-birthday-runner', jsonb_build_object('cron', now()));$$
);

SELECT cron.schedule(
  'atis-runner-every-minute',
  '* * * * *',
  $$select private.edge_call('atis-runner', jsonb_build_object('cron', now()));$$
);