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
    join public.atis_instances i on i.id = m.instance_id
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
      and i.status = 'connected'
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
