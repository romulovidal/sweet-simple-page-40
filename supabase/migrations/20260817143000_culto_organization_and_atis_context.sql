create table if not exists public.culto_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid null references public.culto_schedules(id) on delete set null,
  title text not null,
  service_date date not null,
  start_time time without time zone null,
  minister_name text null,
  leader_name text null,
  theme text null,
  scripture_reference text null,
  location text null,
  notes text null,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint culto_events_title_nonempty check (length(btrim(title)) between 1 and 120),
  constraint culto_events_minister_len check (minister_name is null or length(minister_name) <= 160),
  constraint culto_events_leader_len check (leader_name is null or length(leader_name) <= 160),
  constraint culto_events_theme_len check (theme is null or length(theme) <= 300),
  constraint culto_events_scripture_len check (scripture_reference is null or length(scripture_reference) <= 120),
  constraint culto_events_location_len check (location is null or length(location) <= 240),
  constraint culto_events_notes_len check (notes is null or length(notes) <= 2000)
);

create index if not exists culto_events_active_date_idx on public.culto_events(is_active, service_date, start_time);
create index if not exists culto_events_schedule_date_idx on public.culto_events(schedule_id, service_date);

alter table public.culto_events enable row level security;

drop policy if exists "Active culto events are viewable by everyone" on public.culto_events;
create policy "Active culto events are viewable by everyone"
on public.culto_events for select
using (is_active = true);

drop policy if exists "Admins gerenciam culto_events" on public.culto_events;
create policy "Admins gerenciam culto_events"
on public.culto_events for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.set_culto_events_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_culto_events_updated_at on public.culto_events;
create trigger trg_culto_events_updated_at
before update on public.culto_events
for each row execute function public.set_culto_events_updated_at();

create or replace function public.atis_get_culto_candidates(_days integer default 14, _timezone text default 'America/Fortaleza')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone _timezone)::date;
  v_days integer := greatest(1, least(coalesce(_days,14), 60));
  v_result jsonb;
begin
  with dates as (
    select generate_series(v_today, v_today + (v_days - 1), interval '1 day')::date as service_date
  ), recurring as (
    select
      null::uuid as event_id,
      s.id as schedule_id,
      s.name as title,
      d.service_date,
      s.time as start_time,
      null::text as minister_name,
      null::text as leader_name,
      null::text as theme,
      null::text as scripture_reference,
      null::text as location,
      null::text as notes,
      false as organized
    from dates d
    join public.culto_schedules s
      on s.is_active = true
     and s.day_of_week = extract(dow from d.service_date)::integer
    where not exists (
      select 1 from public.culto_events e
      where e.is_active=true and e.service_date=d.service_date and e.schedule_id=s.id
    )
  ), organized as (
    select
      e.id as event_id,
      e.schedule_id,
      e.title,
      e.service_date,
      coalesce(e.start_time, s.time) as start_time,
      e.minister_name,
      e.leader_name,
      e.theme,
      e.scripture_reference,
      e.location,
      e.notes,
      true as organized
    from public.culto_events e
    left join public.culto_schedules s on s.id=e.schedule_id
    where e.is_active=true
      and e.service_date between v_today and v_today + (v_days - 1)
  ), all_rows as (
    select * from organized
    union all
    select * from recurring
  ), future_rows as (
    select *
    from all_rows r
    where r.service_date > v_today
       or r.start_time is null
       or (r.service_date + r.start_time) >= (now() at time zone _timezone)
    order by r.service_date, r.start_time nulls last, r.organized desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event_id,
    'schedule_id', schedule_id,
    'title', title,
    'service_date', service_date,
    'start_time', case when start_time is null then null else to_char(start_time,'HH24:MI') end,
    'minister_name', minister_name,
    'leader_name', leader_name,
    'theme', theme,
    'scripture_reference', scripture_reference,
    'location', location,
    'notes', notes,
    'organized', organized
  ) order by service_date, start_time nulls last), '[]'::jsonb)
  into v_result
  from future_rows;
  return v_result;
end;
$$;

revoke all on function public.atis_get_culto_candidates(integer,text) from public;
grant execute on function public.atis_get_culto_candidates(integer,text) to service_role;
