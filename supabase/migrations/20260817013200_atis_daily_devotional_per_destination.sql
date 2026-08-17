alter table public.atis_destination_feature_settings
  drop constraint if exists atis_destination_feature_key_chk;

alter table public.atis_destination_feature_settings
  add constraint atis_destination_feature_key_chk check (
    (feature_kind = 'ai' and feature_key = any (array[
      'ask_bible','exegetai','chapter_summary','word_meaning','connections','timeline','devotional'
    ]))
    or
    (feature_kind = 'push' and feature_key = any (array[
      'general','daily-verse','motivational','culto-reminder'
    ]))
    or
    (feature_kind = 'automation' and feature_key = any (array[
      'birthdays','daily_devotional'
    ]))
  );

create index if not exists atis_destination_feature_automation_lookup_idx
  on public.atis_destination_feature_settings(feature_key, enabled, destination_type)
  where feature_kind = 'automation' and enabled = true;

select cron.schedule(
  'atis-content-runner-every-minute',
  '* * * * *',
  $$select private.edge_call('atis-content-runner', jsonb_build_object('cron', now()));$$
)
where not exists (
  select 1 from cron.job where jobname = 'atis-content-runner-every-minute'
);
