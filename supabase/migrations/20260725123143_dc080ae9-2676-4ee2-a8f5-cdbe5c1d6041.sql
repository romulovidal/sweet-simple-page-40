
alter table public.atis_series add column if not exists group_ids uuid[] not null default '{}';

create table if not exists public.atis_series_group_progress (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.atis_series(id) on delete cascade,
  group_id uuid not null references public.atis_groups(id) on delete cascade,
  current_day integer not null default 1,
  last_sent_date date,
  active boolean not null default true,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, group_id)
);

grant select, insert, update, delete on public.atis_series_group_progress to authenticated;
grant all on public.atis_series_group_progress to service_role;

alter table public.atis_series_group_progress enable row level security;

create policy "Admins manage series group progress"
on public.atis_series_group_progress
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create trigger update_atis_series_group_progress_updated_at
before update on public.atis_series_group_progress
for each row execute function public.update_updated_at_column();
