do $migration$
declare
  runner_job_id bigint;
begin
  select jobid into runner_job_id
  from cron.job
  where jobname = 'atis-runner-every-minute'
  limit 1;

  if runner_job_id is null then
    raise exception 'ATIS_RUNNER_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id := runner_job_id,
    schedule := '* * * * *',
    command := $cmd$
      select case
        when exists (
          select 1
          from public.atis_message_targets
          where (status = 'pending' and available_at <= now())
             or (status = 'processing' and locked_until is not null and locked_until <= now())
        )
        or exists (
          select 1
          from public.atis_automations
          where enabled = true
            and trigger_type = 'schedule'
            and schedule_cron is not null
        )
        or exists (
          select 1
          from public.atis_instances
          where last_status_check_at is null
             or last_status_check_at <= now() - interval '5 minutes'
        )
        then private.edge_call('atis-runner', jsonb_build_object('cron', now(), 'wake_reason', 'conditional_scheduler'))
        else null::bigint
      end;
    $cmd$
  );
end
$migration$;

select cron.schedule(
  'atis-cron-history-cleanup-weekly',
  '17 6 * * 0',
  $cleanup$
    delete from cron.job_run_details
    where end_time < now() - interval '30 days'
      and jobid in (
        select jobid
        from cron.job
        where jobname in (
          'atis-runner-every-minute',
          'atis-content-runner-every-minute',
          'atis-birthday-runner-every-minute',
          'atis-cron-history-cleanup-weekly'
        )
      );
  $cleanup$
);