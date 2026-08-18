alter table public.atis_unanswered_questions
  add column if not exists fingerprint text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists last_inbound_message_id uuid;

update public.atis_unanswered_questions
set fingerprint = md5(
      regexp_replace(
        regexp_replace(lower(btrim(question)), '^atis[[:space:],:-]*', '', 'i'),
        '[[:space:]]+', ' ', 'g'
      ) || '|' || coalesce(route, '') || '|' || reason
    ),
    first_seen_at = coalesce(first_seen_at, created_at),
    last_seen_at = coalesce(last_seen_at, updated_at, created_at),
    last_inbound_message_id = coalesce(last_inbound_message_id, inbound_message_id)
where fingerprint is null or last_inbound_message_id is null;

alter table public.atis_unanswered_questions
  alter column fingerprint set not null;

alter table public.atis_unanswered_questions
  drop constraint if exists atis_unanswered_questions_occurrence_count_check;
alter table public.atis_unanswered_questions
  add constraint atis_unanswered_questions_occurrence_count_check
  check (occurrence_count >= 1);

alter table public.atis_unanswered_questions
  drop constraint if exists atis_unanswered_questions_status_check;
alter table public.atis_unanswered_questions
  add constraint atis_unanswered_questions_status_check
  check (status = any (array['open'::text, 'reviewing'::text, 'resolved'::text, 'ignored'::text]));

alter table public.atis_unanswered_questions
  drop constraint if exists atis_unanswered_questions_last_inbound_message_id_fkey;
alter table public.atis_unanswered_questions
  add constraint atis_unanswered_questions_last_inbound_message_id_fkey
  foreign key (last_inbound_message_id)
  references public.atis_inbound_messages(id)
  on delete set null;

create unique index if not exists atis_unanswered_questions_fingerprint_key
  on public.atis_unanswered_questions(fingerprint);
create index if not exists atis_unanswered_questions_status_last_seen_idx
  on public.atis_unanswered_questions(status, last_seen_at desc);
create index if not exists atis_unanswered_questions_reason_last_seen_idx
  on public.atis_unanswered_questions(reason, last_seen_at desc);

revoke all on table public.atis_unanswered_questions from anon;
revoke insert, update, delete, truncate, references, trigger on table public.atis_unanswered_questions from authenticated;
grant select on table public.atis_unanswered_questions to authenticated;
grant all on table public.atis_unanswered_questions to service_role;

create or replace function public.atis_record_unanswered(
  _inbound_message_id uuid,
  _destination_type text,
  _destination_id uuid,
  _question text,
  _route text default null,
  _answer text default null,
  _reason text default 'assistant_uncertain'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_question text;
  fingerprint_value text;
  row_id uuid;
begin
  if _inbound_message_id is null then
    raise exception 'INBOUND_MESSAGE_ID_REQUIRED';
  end if;
  if _destination_type not in ('contact', 'individual', 'group') then
    raise exception 'INVALID_DESTINATION_TYPE';
  end if;
  if _destination_id is null then
    raise exception 'DESTINATION_ID_REQUIRED';
  end if;
  if _question is null or length(btrim(_question)) < 1 then
    raise exception 'QUESTION_REQUIRED';
  end if;

  normalized_question := regexp_replace(
    regexp_replace(lower(btrim(left(_question, 5000))), '^atis[[:space:],:-]*', '', 'i'),
    '[[:space:]]+', ' ', 'g'
  );
  fingerprint_value := md5(normalized_question || '|' || coalesce(btrim(_route), '') || '|' || coalesce(btrim(_reason), 'assistant_uncertain'));

  insert into public.atis_unanswered_questions (
    inbound_message_id,
    last_inbound_message_id,
    destination_type,
    destination_id,
    question,
    route,
    answer,
    reason,
    status,
    fingerprint,
    occurrence_count,
    first_seen_at,
    last_seen_at,
    updated_at
  ) values (
    _inbound_message_id,
    _inbound_message_id,
    _destination_type,
    _destination_id,
    left(_question, 5000),
    nullif(btrim(_route), ''),
    case when _answer is null then null else left(_answer, 5000) end,
    coalesce(nullif(btrim(_reason), ''), 'assistant_uncertain'),
    'open',
    fingerprint_value,
    1,
    now(),
    now(),
    now()
  )
  on conflict (fingerprint) do update
  set last_inbound_message_id = excluded.last_inbound_message_id,
      destination_type = excluded.destination_type,
      destination_id = excluded.destination_id,
      route = excluded.route,
      answer = excluded.answer,
      reason = excluded.reason,
      occurrence_count = public.atis_unanswered_questions.occurrence_count + 1,
      last_seen_at = now(),
      updated_at = now(),
      status = case
        when public.atis_unanswered_questions.status = 'resolved' then 'open'
        else public.atis_unanswered_questions.status
      end,
      resolved_at = case
        when public.atis_unanswered_questions.status = 'resolved' then null
        else public.atis_unanswered_questions.resolved_at
      end,
      resolved_by = case
        when public.atis_unanswered_questions.status = 'resolved' then null
        else public.atis_unanswered_questions.resolved_by
      end
  returning id into row_id;

  return row_id;
end;
$$;

revoke all on function public.atis_record_unanswered(uuid,text,uuid,text,text,text,text) from public;
revoke all on function public.atis_record_unanswered(uuid,text,uuid,text,text,text,text) from anon;
revoke all on function public.atis_record_unanswered(uuid,text,uuid,text,text,text,text) from authenticated;
grant execute on function public.atis_record_unanswered(uuid,text,uuid,text,text,text,text) to service_role;