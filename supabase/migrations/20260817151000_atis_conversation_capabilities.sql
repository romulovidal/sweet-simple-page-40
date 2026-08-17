create table if not exists public.atis_destination_profiles (
  id uuid primary key default gen_random_uuid(),
  destination_type text not null check (destination_type in ('contact','individual','group')),
  contact_id uuid null references public.atis_contacts(id) on delete cascade,
  individual_id uuid null references public.atis_individuals(id) on delete cascade,
  group_id uuid null references public.atis_groups(id) on delete cascade,
  conversation_mode text not null default 'normal' check (conversation_mode in ('normal','study','concise')),
  response_style text not null default 'balanced' check (response_style in ('concise','balanced','detailed')),
  quiet_hours_enabled boolean not null default false,
  quiet_start time without time zone null,
  quiet_end time without time zone null,
  timezone text not null default 'America/Fortaleza',
  cooldown_seconds integer not null default 4 check (cooldown_seconds between 0 and 300),
  max_replies_per_10m integer not null default 8 check (max_replies_per_10m between 1 and 50),
  mention_only boolean not null default false,
  enable_buttons boolean not null default false,
  enable_audio boolean not null default false,
  continue_in_app boolean not null default true,
  custom_instruction text null check (custom_instruction is null or length(custom_instruction) <= 1000),
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atis_destination_profiles_target_check check (
    (destination_type='contact' and contact_id is not null and individual_id is null and group_id is null) or
    (destination_type='individual' and individual_id is not null and contact_id is null and group_id is null) or
    (destination_type='group' and group_id is not null and contact_id is null and individual_id is null)
  )
);

create unique index if not exists atis_destination_profiles_contact_uidx on public.atis_destination_profiles(contact_id) where destination_type='contact';
create unique index if not exists atis_destination_profiles_individual_uidx on public.atis_destination_profiles(individual_id) where destination_type='individual';
create unique index if not exists atis_destination_profiles_group_uidx on public.atis_destination_profiles(group_id) where destination_type='group';

alter table public.atis_destination_profiles enable row level security;
drop policy if exists "atis_destination_profiles_admin_select" on public.atis_destination_profiles;
create policy "atis_destination_profiles_admin_select" on public.atis_destination_profiles for select to authenticated
using (public.has_role((select auth.uid()), 'admin'::text));

create table if not exists public.atis_conversation_state (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.atis_instances(id) on delete cascade,
  remote_jid text not null,
  destination_type text null check (destination_type is null or destination_type in ('contact','individual','group')),
  destination_id uuid null,
  conversation_mode text not null default 'normal' check (conversation_mode in ('normal','study','concise')),
  last_route text null,
  memory jsonb not null default '{}'::jsonb,
  pending_action jsonb not null default '{}'::jsonb,
  last_reply_at timestamptz null,
  reply_window_start timestamptz null,
  reply_window_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(instance_id, remote_jid)
);
create index if not exists atis_conversation_state_destination_idx on public.atis_conversation_state(destination_type,destination_id);
alter table public.atis_conversation_state enable row level security;
drop policy if exists "atis_conversation_state_admin_select" on public.atis_conversation_state;
create policy "atis_conversation_state_admin_select" on public.atis_conversation_state for select to authenticated
using (public.has_role((select auth.uid()), 'admin'::text));

create table if not exists public.atis_unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  inbound_message_id uuid not null unique references public.atis_inbound_messages(id) on delete cascade,
  destination_type text null check (destination_type is null or destination_type in ('contact','individual','group')),
  destination_id uuid null,
  question text not null check (length(question) between 1 and 5000),
  route text null,
  answer text null,
  reason text not null default 'assistant_uncertain',
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  resolution_note text null check (resolution_note is null or length(resolution_note) <= 2000),
  resolved_by uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atis_unanswered_questions_status_created_idx on public.atis_unanswered_questions(status,created_at desc);
alter table public.atis_unanswered_questions enable row level security;
drop policy if exists "atis_unanswered_questions_admin_select" on public.atis_unanswered_questions;
create policy "atis_unanswered_questions_admin_select" on public.atis_unanswered_questions for select to authenticated
using (public.has_role((select auth.uid()), 'admin'::text));

create table if not exists public.atis_prayer_requests (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.atis_instances(id) on delete cascade,
  contact_id uuid null references public.atis_contacts(id) on delete set null,
  individual_id uuid null references public.atis_individuals(id) on delete set null,
  source_remote_jid text not null,
  sender_name text null,
  content text not null check (length(content) between 3 and 4000),
  is_private boolean not null default true,
  consent_confirmed_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','praying','answered','archived')),
  admin_note text null check (admin_note is null or length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz null,
  constraint atis_prayer_requests_direct_target_check check (contact_id is not null or individual_id is not null)
);
create index if not exists atis_prayer_requests_status_created_idx on public.atis_prayer_requests(status,created_at desc);
alter table public.atis_prayer_requests enable row level security;
drop policy if exists "atis_prayer_requests_admin_select" on public.atis_prayer_requests;
create policy "atis_prayer_requests_admin_select" on public.atis_prayer_requests for select to authenticated
using (public.has_role((select auth.uid()), 'admin'::text));

create or replace function public.atis_check_reply_budget(
  _instance_id uuid,
  _remote_jid text,
  _cooldown_seconds integer default 4,
  _max_replies_per_10m integer default 8,
  _now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_state public.atis_conversation_state%rowtype;
  v_cooldown integer := greatest(0, least(coalesce(_cooldown_seconds,4),300));
  v_max integer := greatest(1, least(coalesce(_max_replies_per_10m,8),50));
  v_window_start timestamptz;
  v_count integer;
begin
  if _instance_id is null or nullif(btrim(_remote_jid),'') is null then
    return jsonb_build_object('allowed',false,'reason','INVALID_CONVERSATION');
  end if;

  insert into public.atis_conversation_state(instance_id,remote_jid,reply_window_start,reply_window_count)
  values (_instance_id,btrim(_remote_jid),_now,0)
  on conflict (instance_id,remote_jid) do nothing;

  select * into row_state from public.atis_conversation_state
  where instance_id=_instance_id and remote_jid=btrim(_remote_jid)
  for update;

  if row_state.last_reply_at is not null and row_state.last_reply_at > _now - make_interval(secs => v_cooldown) then
    return jsonb_build_object('allowed',false,'reason','COOLDOWN','retry_after_seconds',greatest(1,ceil(extract(epoch from (row_state.last_reply_at + make_interval(secs => v_cooldown) - _now)))::integer));
  end if;

  if row_state.reply_window_start is null or row_state.reply_window_start <= _now - interval '10 minutes' then
    v_window_start := _now;
    v_count := 0;
  else
    v_window_start := row_state.reply_window_start;
    v_count := row_state.reply_window_count;
  end if;

  if v_count >= v_max then
    return jsonb_build_object('allowed',false,'reason','RATE_LIMIT','retry_after_seconds',greatest(1,ceil(extract(epoch from (v_window_start + interval '10 minutes' - _now)))::integer));
  end if;

  update public.atis_conversation_state set
    last_reply_at=_now,
    reply_window_start=v_window_start,
    reply_window_count=v_count+1,
    updated_at=_now
  where id=row_state.id;

  return jsonb_build_object('allowed',true,'reason','OK','window_count',v_count+1,'window_max',v_max);
end;
$$;

revoke all on function public.atis_check_reply_budget(uuid,text,integer,integer,timestamptz) from public;
grant execute on function public.atis_check_reply_budget(uuid,text,integer,integer,timestamptz) to service_role;
