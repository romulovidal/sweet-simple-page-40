do $$
declare
  _jobid bigint;
begin
  select jobid into _jobid from cron.job where jobname = 'atis-bible-indexer-every-minute' limit 1;
  if _jobid is not null then perform cron.unschedule(_jobid); end if;

  select jobid into _jobid from cron.job where jobname = 'atis-bible-indexer-history-cleanup-weekly' limit 1;
  if _jobid is not null then perform cron.unschedule(_jobid); end if;
end $$;

select cron.schedule(
  'atis-bible-indexer-every-minute',
  '* * * * *',
  $cron$
    select case
      when exists (
        select 1
        from public.atis_bible_semantic_chunks
        where embedding is null
      )
      then private.edge_call(
        'atis-bible-indexer',
        jsonb_build_object('cron', now(), 'purpose', 'semantic_bible_index')
      )
      else null::bigint
    end;
  $cron$
);

select cron.schedule(
  'atis-bible-indexer-history-cleanup-weekly',
  '29 6 * * 0',
  $cron$
    delete from cron.job_run_details
    where end_time < now() - interval '30 days'
      and jobid in (
        select jobid from cron.job
        where jobname in (
          'atis-bible-indexer-every-minute',
          'atis-bible-indexer-history-cleanup-weekly'
        )
      );
  $cron$
);