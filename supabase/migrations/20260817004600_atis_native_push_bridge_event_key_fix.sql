create or replace function public.atis_enqueue_native_push_event(
  _push_type text,
  _title text,
  _body text,
  _url text default null,
  _event_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_instance_id uuid;
  v_message_id uuid;
  v_scheduled_for timestamptz;
  v_local_now timestamp without time zone;
  v_candidate timestamptz;
  v_content text;
  v_event_key text;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  if _push_type not in ('general','daily-verse','motivational','culto-reminder') then
    raise exception 'Unsupported native push type: %', _push_type;
  end if;
  if nullif(btrim(coalesce(_title,'')), '') is null or nullif(btrim(coalesce(_body,'')), '') is null then
    raise exception 'title and body are required';
  end if;

  v_event_key := coalesce(nullif(btrim(_event_key), ''), md5(coalesce(_push_type,'') || '|' || coalesce(_title,'') || '|' || coalesce(_body,'') || '|' || clock_timestamp()::text));
  v_content := '*' || btrim(_title) || '*' || E'\n' || btrim(_body) || case when nullif(btrim(coalesce(_url,'')), '') is not null then E'\n\n' || btrim(_url) else '' end;

  for r in
    select s.*, c.phone_e164, c.name as destination_name, null::text as provider_group_id, null::uuid as destination_instance_id
      from public.atis_destination_feature_settings s
      join public.atis_contacts c on s.destination_type='contact' and c.id=s.contact_id
     where s.feature_kind='push' and s.feature_key=_push_type and s.enabled=true
       and c.is_active=true and c.whatsapp_opt_in=true and coalesce(c.blocked,false)=false
    union all
    select s.*, i.phone_e164, i.name as destination_name, null::text as provider_group_id, null::uuid as destination_instance_id
      from public.atis_destination_feature_settings s
      join public.atis_individuals i on s.destination_type='individual' and i.id=s.individual_id
     where s.feature_kind='push' and s.feature_key=_push_type and s.enabled=true
       and i.is_active=true and i.allow_messages=true and coalesce(i.blocked,false)=false
    union all
    select s.*, null::text as phone_e164, g.name as destination_name, g.provider_group_id, g.instance_id as destination_instance_id
      from public.atis_destination_feature_settings s
      join public.atis_groups g on s.destination_type='group' and g.id=s.group_id
     where s.feature_kind='push' and s.feature_key=_push_type and s.enabled=true
       and g.is_active=true and g.allow_automations=true and coalesce(g.provider_exists,true)=true
  loop
    if r.destination_type = 'group' then
      v_instance_id := r.destination_instance_id;
    else
      select id into v_instance_id
        from public.atis_instances
       order by (status='connected') desc, created_at asc
       limit 1;
    end if;

    if v_instance_id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if r.schedule_mode = 'custom_time' and r.custom_time is not null then
      v_local_now := timezone(coalesce(nullif(r.timezone,''), 'America/Fortaleza'), now());
      v_candidate := ((v_local_now::date + r.custom_time) at time zone coalesce(nullif(r.timezone,''), 'America/Fortaleza'));
      v_scheduled_for := case when v_candidate > now() then v_candidate else now() end;
    else
      v_scheduled_for := now();
    end if;

    insert into public.atis_messages(
      instance_id, source_type, message_type, content, status, priority,
      scheduled_for, available_at, dedupe_key, metadata
    ) values (
      v_instance_id, 'event', 'text', v_content, 'queued', 0,
      v_scheduled_for, v_scheduled_for,
      'native-push:' || v_event_key || ':' || r.destination_type || ':' || coalesce(r.contact_id,r.individual_id,r.group_id)::text || ':' || _push_type,
      jsonb_build_object(
        'native_push_type', _push_type,
        'native_push_title', _title,
        'native_push_url', _url,
        'native_push_event_key', v_event_key,
        'destination_feature_setting_id', r.id,
        'schedule_mode', r.schedule_mode,
        'timezone', r.timezone
      )
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning id into v_message_id;

    if v_message_id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if r.destination_type = 'contact' then
      insert into public.atis_message_targets(
        message_id,target_type,target_key,contact_id,phone_e164,display_name,status,available_at,metadata
      ) values (
        v_message_id,'contact','contact:'||r.contact_id::text,r.contact_id,r.phone_e164,r.destination_name,'pending',v_scheduled_for,
        jsonb_build_object('native_push_type',_push_type)
      );
    elsif r.destination_type = 'individual' then
      insert into public.atis_message_targets(
        message_id,target_type,target_key,individual_id,phone_e164,display_name,status,available_at,metadata
      ) values (
        v_message_id,'individual','individual:'||r.individual_id::text,r.individual_id,r.phone_e164,r.destination_name,'pending',v_scheduled_for,
        jsonb_build_object('native_push_type',_push_type)
      );
    else
      insert into public.atis_message_targets(
        message_id,target_type,target_key,group_id,provider_target_id,display_name,status,available_at,metadata
      ) values (
        v_message_id,'group','group:'||r.group_id::text,r.group_id,r.provider_group_id,r.destination_name,'pending',v_scheduled_for,
        jsonb_build_object('native_push_type',_push_type)
      );
    end if;

    v_created := v_created + 1;
    v_message_id := null;
  end loop;

  return jsonb_build_object('created',v_created,'skipped',v_skipped,'push_type',_push_type,'event_key',v_event_key);
end;
$$;

revoke all on function public.atis_enqueue_native_push_event(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.atis_enqueue_native_push_event(text,text,text,text,text) to service_role;
