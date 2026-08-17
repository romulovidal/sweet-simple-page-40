alter table public.atis_automations drop constraint if exists atis_automations_type_check;
alter table public.atis_automations add constraint atis_automations_type_check check (
  type = any (array[
    'birthday'::text,
    'welcome'::text,
    'devotional'::text,
    'daily_verse'::text,
    'reading_plan'::text,
    'broadcast'::text,
    'series'::text,
    'culto'::text,
    'inactivity'::text,
    'goal'::text,
    'custom'::text
  ])
);
