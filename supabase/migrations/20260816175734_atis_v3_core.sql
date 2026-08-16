create table if not exists public.atis_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atis_instances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider text not null default 'evolution',
  external_instance_id text,
  external_instance_name text,
  status text not null default 'disconnected' check (status in ('disconnected','connecting','qr_required','connected','error','unknown')),
  connected_number text,
  connected_name text,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  last_status_check_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_instance_name)
);

create table if not exists public.atis_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  source text not null default 'manual' check (source in ('manual','app','import','provider')),
  provider_contact_id text,
  tags text[] not null default '{}'::text[],
  notes text,
  whatsapp_opt_in boolean not null default false,
  opt_in_source text,
  opt_in_at timestamptz,
  opt_out_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atis_contacts_user_id_uidx
  on public.atis_contacts(user_id)
  where user_id is not null;
create index if not exists atis_contacts_tags_gin_idx on public.atis_contacts using gin(tags);
create index if not exists atis_contacts_active_idx on public.atis_contacts(is_active, whatsapp_opt_in);

create table if not exists public.atis_groups (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.atis_instances(id) on delete restrict,
  provider_group_id text not null,
  name text not null,
  description text,
  participant_count integer not null default 0 check (participant_count >= 0),
  allow_automations boolean not null default true,
  is_active boolean not null default true,
  synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(instance_id, provider_group_id)
);

create index if not exists atis_groups_instance_active_idx on public.atis_groups(instance_id, is_active);

create table if not exists public.atis_group_members (
  group_id uuid not null references public.atis_groups(id) on delete cascade,
  provider_member_id text not null,
  contact_id uuid references public.atis_contacts(id) on delete set null,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text,
  is_admin boolean not null default false,
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(group_id, provider_member_id)
);

create index if not exists atis_group_members_contact_idx on public.atis_group_members(contact_id) where contact_id is not null;
create index if not exists atis_group_members_phone_idx on public.atis_group_members(phone_e164) where phone_e164 is not null;

create table if not exists public.atis_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text not null default 'custom' check (category in ('birthday','welcome','devotional','daily_verse','reading_plan','broadcast','custom')),
  content text not null,
  variables text[] not null default '{}'::text[],
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atis_automations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  type text not null default 'custom' check (type in ('birthday','welcome','devotional','daily_verse','reading_plan','broadcast','custom')),
  enabled boolean not null default false,
  timezone text not null default 'America/Fortaleza',
  trigger_type text not null check (trigger_type in ('schedule','event','manual')),
  schedule_cron text,
  event_key text,
  template_id uuid references public.atis_templates(id) on delete set null,
  target_selector jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((trigger_type <> 'schedule') or schedule_cron is not null),
  check ((trigger_type <> 'event') or event_key is not null)
);

create index if not exists atis_automations_due_idx on public.atis_automations(enabled, next_run_at) where enabled = true;

create table if not exists public.atis_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.atis_automations(id) on delete cascade,
  trigger_source text not null check (trigger_source in ('scheduler','event','manual','retry')),
  scheduled_for timestamptz not null,
  idempotency_key text,
  status text not null default 'running' check (status in ('queued','running','succeeded','partial','failed','skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  targets_found integer not null default 0 check (targets_found >= 0),
  messages_created integer not null default 0 check (messages_created >= 0),
  messages_skipped integer not null default 0 check (messages_skipped >= 0),
  messages_failed integer not null default 0 check (messages_failed >= 0),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists atis_automation_runs_idempotency_uidx on public.atis_automation_runs(idempotency_key) where idempotency_key is not null;
create unique index if not exists atis_automation_runs_scheduler_uidx on public.atis_automation_runs(automation_id, scheduled_for) where trigger_source = 'scheduler';
create index if not exists atis_automation_runs_recent_idx on public.atis_automation_runs(automation_id, started_at desc);

create table if not exists public.atis_messages (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.atis_instances(id) on delete restrict,
  automation_run_id uuid references public.atis_automation_runs(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual','automation','event','system')),
  source_id uuid,
  message_type text not null default 'text' check (message_type in ('text','image','document')),
  content text not null,
  media_url text,
  status text not null default 'queued' check (status in ('queued','processing','completed','partial','failed','cancelled')),
  priority smallint not null default 0 check (priority between -100 and 100),
  scheduled_for timestamptz not null default now(),
  available_at timestamptz not null default now(),
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atis_messages_dedupe_uidx on public.atis_messages(dedupe_key) where dedupe_key is not null;
create index if not exists atis_messages_queue_idx on public.atis_messages(status, available_at, scheduled_for, priority desc) where status in ('queued','processing');

create table if not exists public.atis_message_targets (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.atis_messages(id) on delete cascade,
  target_type text not null check (target_type in ('individual','contact','group')),
  target_key text not null,
  contact_id uuid references public.atis_contacts(id) on delete set null,
  group_id uuid references public.atis_groups(id) on delete set null,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  provider_target_id text,
  display_name text,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_until timestamptz,
  worker_id text,
  provider_message_id text,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(message_id, target_key),
  check (
    (target_type = 'individual' and phone_e164 is not null)
    or (target_type = 'contact' and contact_id is not null and phone_e164 is not null)
    or (target_type = 'group' and group_id is not null and provider_target_id is not null)
  )
);

create index if not exists atis_message_targets_claim_idx
  on public.atis_message_targets(status, available_at, locked_until, created_at)
  where status = 'pending';
create index if not exists atis_message_targets_message_idx on public.atis_message_targets(message_id, status);

create table if not exists public.atis_message_attempts (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.atis_message_targets(id) on delete cascade,
  attempt_no integer not null check (attempt_no > 0),
  provider text not null default 'evolution',
  http_status integer,
  provider_message_id text,
  success boolean not null default false,
  error_code text,
  error_message text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  response_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(target_id, attempt_no)
);

create index if not exists atis_message_attempts_target_idx on public.atis_message_attempts(target_id, created_at desc);

create table if not exists public.atis_webhook_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid references public.atis_instances(id) on delete set null,
  provider_event_id text,
  event_type text not null,
  payload_hash text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create unique index if not exists atis_webhook_events_provider_event_uidx on public.atis_webhook_events(provider_event_id) where provider_event_id is not null;
create index if not exists atis_webhook_events_status_idx on public.atis_webhook_events(status, received_at);

create trigger trg_atis_settings_updated_at before update on public.atis_settings for each row execute function public.update_updated_at_column();
create trigger trg_atis_instances_updated_at before update on public.atis_instances for each row execute function public.update_updated_at_column();
create trigger trg_atis_contacts_updated_at before update on public.atis_contacts for each row execute function public.update_updated_at_column();
create trigger trg_atis_groups_updated_at before update on public.atis_groups for each row execute function public.update_updated_at_column();
create trigger trg_atis_group_members_updated_at before update on public.atis_group_members for each row execute function public.update_updated_at_column();
create trigger trg_atis_templates_updated_at before update on public.atis_templates for each row execute function public.update_updated_at_column();
create trigger trg_atis_automations_updated_at before update on public.atis_automations for each row execute function public.update_updated_at_column();
create trigger trg_atis_messages_updated_at before update on public.atis_messages for each row execute function public.update_updated_at_column();
create trigger trg_atis_message_targets_updated_at before update on public.atis_message_targets for each row execute function public.update_updated_at_column();

alter table public.atis_settings enable row level security;
alter table public.atis_instances enable row level security;
alter table public.atis_contacts enable row level security;
alter table public.atis_groups enable row level security;
alter table public.atis_group_members enable row level security;
alter table public.atis_templates enable row level security;
alter table public.atis_automations enable row level security;
alter table public.atis_automation_runs enable row level security;
alter table public.atis_messages enable row level security;
alter table public.atis_message_targets enable row level security;
alter table public.atis_message_attempts enable row level security;
alter table public.atis_webhook_events enable row level security;

revoke all on public.atis_settings, public.atis_instances, public.atis_contacts, public.atis_groups, public.atis_group_members, public.atis_templates, public.atis_automations, public.atis_automation_runs, public.atis_messages, public.atis_message_targets, public.atis_message_attempts, public.atis_webhook_events from anon, authenticated;
grant select on public.atis_settings, public.atis_instances, public.atis_contacts, public.atis_groups, public.atis_group_members, public.atis_templates, public.atis_automations, public.atis_automation_runs, public.atis_messages, public.atis_message_targets, public.atis_message_attempts, public.atis_webhook_events to authenticated;

create policy atis_settings_admin_select on public.atis_settings for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_instances_admin_select on public.atis_instances for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_contacts_admin_select on public.atis_contacts for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_groups_admin_select on public.atis_groups for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_group_members_admin_select on public.atis_group_members for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_templates_admin_select on public.atis_templates for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_automations_admin_select on public.atis_automations for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_automation_runs_admin_select on public.atis_automation_runs for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_messages_admin_select on public.atis_messages for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_message_targets_admin_select on public.atis_message_targets for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_message_attempts_admin_select on public.atis_message_attempts for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy atis_webhook_events_admin_select on public.atis_webhook_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.atis_claim_message_targets(
  _worker_id text,
  _limit integer default 20,
  _lease_seconds integer default 60
)
returns setof public.atis_message_targets
language plpgsql
security definer
set search_path = public
as $$
begin
  if _worker_id is null or btrim(_worker_id) = '' then
    raise exception 'worker_id is required';
  end if;

  return query
  with candidates as (
    select t.id
    from public.atis_message_targets t
    join public.atis_messages m on m.id = t.message_id
    where t.status = 'pending'
      and t.attempt_count < t.max_attempts
      and t.available_at <= now()
      and (t.locked_until is null or t.locked_until < now())
      and m.status in ('queued','processing')
      and m.available_at <= now()
      and m.scheduled_for <= now()
    order by m.priority desc, t.available_at asc, t.created_at asc
    for update of t skip locked
    limit greatest(1, least(coalesce(_limit, 20), 100))
  )
  update public.atis_message_targets t
     set status = 'processing',
         attempt_count = t.attempt_count + 1,
         locked_at = now(),
         locked_until = now() + make_interval(secs => greatest(15, least(coalesce(_lease_seconds, 60), 600))),
         worker_id = _worker_id,
         updated_at = now()
    from candidates c
   where t.id = c.id
  returning t.*;
end;
$$;

revoke all on function public.atis_claim_message_targets(text, integer, integer) from public, anon, authenticated;
grant execute on function public.atis_claim_message_targets(text, integer, integer) to service_role;

insert into public.atis_settings(key, value, description)
values
  ('delivery', '{"max_messages_per_minute":8,"min_delay_ms":3000,"max_attempts":3,"retry_delays_seconds":[60,300,900],"quiet_hours":{"enabled":false,"start":"22:00","end":"07:00"}}'::jsonb, 'ATIS delivery limits and retry policy'),
  ('defaults', '{"timezone":"America/Fortaleza","provider":"evolution"}'::jsonb, 'ATIS non-secret defaults')
on conflict (key) do nothing;
