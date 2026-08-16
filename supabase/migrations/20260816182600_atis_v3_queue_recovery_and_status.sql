update public.atis_settings
set value = jsonb_set(value, '{default_country_code}', '"55"'::jsonb, true), updated_at = now()
where key = 'defaults' and not (value ? 'default_country_code');

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

  update public.atis_message_targets
     set status = 'failed',
         failed_at = coalesce(failed_at, now()),
         locked_at = null,
         locked_until = null,
         worker_id = null,
         last_error_code = coalesce(last_error_code, 'LEASE_EXPIRED'),
         last_error_message = coalesce(last_error_message, 'Worker lease expired after the maximum number of attempts'),
         updated_at = now()
   where status = 'processing'
     and locked_until is not null
     and locked_until < now()
     and attempt_count >= max_attempts;

  return query
  with candidates as (
    select t.id
    from public.atis_message_targets t
    join public.atis_messages m on m.id = t.message_id
    where (
        t.status = 'pending'
        or (t.status = 'processing' and t.locked_until is not null and t.locked_until < now())
      )
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

drop index if exists public.atis_message_targets_claim_idx;
create index if not exists atis_message_targets_claim_idx
  on public.atis_message_targets(status, available_at, locked_until, created_at)
  where status in ('pending','processing');

create or replace function public.atis_refresh_message_status(_message_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  _pending integer;
  _processing integer;
  _sent integer;
  _failed integer;
  _skipped integer;
  _cancelled integer;
  _total integer;
  _status text;
begin
  if _message_id is null then return; end if;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'skipped'),
    count(*) filter (where status = 'cancelled'),
    count(*)
  into _pending, _processing, _sent, _failed, _skipped, _cancelled, _total
  from public.atis_message_targets
  where message_id = _message_id;

  if _total = 0 then
    _status := 'queued';
  elsif _processing > 0 then
    _status := 'processing';
  elsif _pending > 0 then
    _status := 'queued';
  elsif _cancelled = _total then
    _status := 'cancelled';
  elsif _sent = _total or (_sent + _skipped = _total and _failed = 0 and _cancelled = 0) then
    _status := 'completed';
  elsif _sent > 0 then
    _status := 'partial';
  elsif _failed > 0 then
    _status := 'failed';
  else
    _status := 'cancelled';
  end if;

  update public.atis_messages
     set status = _status,
         updated_at = now()
   where id = _message_id
     and status is distinct from _status;
end;
$$;

create or replace function public.atis_message_target_status_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.atis_refresh_message_status(coalesce(new.message_id, old.message_id));
  if tg_op = 'UPDATE' and new.message_id is distinct from old.message_id then
    perform public.atis_refresh_message_status(old.message_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_atis_message_target_status on public.atis_message_targets;
create trigger trg_atis_message_target_status
after insert or update of status or delete on public.atis_message_targets
for each row execute function public.atis_message_target_status_trigger();

revoke all on function public.atis_refresh_message_status(uuid) from public, anon, authenticated;
revoke all on function public.atis_message_target_status_trigger() from public, anon, authenticated;
