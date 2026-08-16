create or replace function public.atis_enqueue_automation_batch(
  _automation_id uuid,
  _scheduled_for timestamptz,
  _items jsonb,
  _trigger_source text default 'scheduler',
  _idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _run public.atis_automation_runs%rowtype;
  _item jsonb;
  _message_id uuid;
  _count integer := 0;
  _message_type text;
  _source_type text;
begin
  if _automation_id is null or _scheduled_for is null then
    raise exception 'automation_id and scheduled_for are required';
  end if;
  if _trigger_source not in ('scheduler','event','manual','retry') then
    raise exception 'invalid trigger_source';
  end if;
  if _items is null or jsonb_typeof(_items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;
  if jsonb_array_length(_items) > 1000 then
    raise exception 'automation batch exceeds 1000 targets';
  end if;

  insert into public.atis_automation_runs(
    automation_id, trigger_source, scheduled_for, idempotency_key, status, started_at
  ) values (
    _automation_id, _trigger_source, _scheduled_for,
    coalesce(_idempotency_key, _automation_id::text || ':' || _scheduled_for::text),
    'running', now()
  )
  on conflict do nothing
  returning * into _run;

  if _run.id is null then
    select * into _run
    from public.atis_automation_runs
    where automation_id = _automation_id
      and scheduled_for = _scheduled_for
      and trigger_source = _trigger_source
    order by created_at desc
    limit 1;

    if _run.id is null and _idempotency_key is not null then
      select * into _run
      from public.atis_automation_runs
      where idempotency_key = _idempotency_key
      limit 1;
    end if;

    return jsonb_build_object(
      'queued', false,
      'idempotent_replay', true,
      'run_id', _run.id,
      'status', _run.status,
      'messages_created', coalesce(_run.messages_created, 0)
    );
  end if;

  if jsonb_array_length(_items) = 0 then
    update public.atis_automation_runs
       set status = 'skipped',
           finished_at = now(),
           targets_found = 0,
           messages_created = 0,
           messages_skipped = 0,
           messages_failed = 0
     where id = _run.id;

    return jsonb_build_object(
      'queued', false,
      'idempotent_replay', false,
      'run_id', _run.id,
      'status', 'skipped',
      'messages_created', 0
    );
  end if;

  for _item in select value from jsonb_array_elements(_items)
  loop
    _message_type := coalesce(nullif(_item->>'message_type',''), 'text');
    _source_type := case when _trigger_source = 'event' then 'event' else 'automation' end;

    insert into public.atis_messages(
      instance_id,
      automation_run_id,
      source_type,
      source_id,
      message_type,
      content,
      media_url,
      status,
      priority,
      scheduled_for,
      available_at,
      dedupe_key,
      metadata,
      created_by
    ) values (
      (_item->>'instance_id')::uuid,
      _run.id,
      _source_type,
      _automation_id,
      _message_type,
      coalesce(_item->>'content',''),
      nullif(_item->>'media_url',''),
      'queued',
      greatest(-100, least(100, coalesce((_item->>'priority')::smallint, 0))),
      _scheduled_for,
      greatest(_scheduled_for, now()),
      nullif(_item->>'dedupe_key',''),
      coalesce(_item->'message_metadata', '{}'::jsonb),
      null
    )
    returning id into _message_id;

    insert into public.atis_message_targets(
      message_id,
      target_type,
      target_key,
      contact_id,
      group_id,
      phone_e164,
      provider_target_id,
      display_name,
      status,
      attempt_count,
      max_attempts,
      available_at,
      metadata
    ) values (
      _message_id,
      _item->>'target_type',
      _item->>'target_key',
      nullif(_item->>'contact_id','')::uuid,
      nullif(_item->>'group_id','')::uuid,
      nullif(_item->>'phone_e164',''),
      nullif(_item->>'provider_target_id',''),
      nullif(_item->>'display_name',''),
      'pending',
      0,
      greatest(1, least(10, coalesce((_item->>'max_attempts')::integer, 3))),
      greatest(_scheduled_for, now()),
      coalesce(_item->'target_metadata', '{}'::jsonb)
    );

    _count := _count + 1;
  end loop;

  update public.atis_automation_runs
     set status = 'succeeded',
         finished_at = now(),
         targets_found = _count,
         messages_created = _count,
         messages_skipped = 0,
         messages_failed = 0
   where id = _run.id;

  update public.atis_automations
     set last_run_at = now(),
         updated_at = now()
   where id = _automation_id;

  return jsonb_build_object(
    'queued', true,
    'idempotent_replay', false,
    'run_id', _run.id,
    'status', 'succeeded',
    'messages_created', _count
  );
end;
$$;

revoke all on function public.atis_enqueue_automation_batch(uuid,timestamptz,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.atis_enqueue_automation_batch(uuid,timestamptz,jsonb,text,text) to service_role;
