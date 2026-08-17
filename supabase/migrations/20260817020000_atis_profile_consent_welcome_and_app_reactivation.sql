alter table public.atis_contacts
  add column if not exists opt_out_source text,
  add column if not exists reactivation_requires_app boolean not null default false,
  add column if not exists welcome_sent_at timestamptz,
  add column if not exists consent_updated_at timestamptz;

insert into public.atis_settings(key, value, description)
values (
  'welcome',
  jsonb_build_object(
    'enabled', true,
    'message', '👋 Olá, {{nome}}! Seja bem-vindo(a) ao *ATIS* — Assistência Tecnológica de Informação aos Servos, do Ministério Atalaias de Betel.\n\n📖 Por aqui você pode fazer perguntas sobre a Bíblia e, conforme os recursos liberados, usar Pergunte à Bíblia, ExegettAI, resumo de capítulos, significado original, conexões bíblicas, contexto histórico/linha do tempo e reflexões devocionais.\n\n🔔 Você também poderá receber conteúdos e avisos do aplicativo no WhatsApp de acordo com a sua autorização.\n\nSe não quiser mais receber mensagens, envie *sair*. Para reativar depois, faça isso somente no app em *Perfil → Notificações no WhatsApp*. 🙏'
  ),
  'Mensagem transacional enviada uma única vez quando um usuário do app autoriza WhatsApp pela primeira vez.'
)
on conflict (key) do nothing;

create or replace function public.atis_sync_profile_consent()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_digits text; v_phone text; v_contact public.atis_contacts%rowtype;
  v_instance_id uuid; v_message_id uuid; v_welcome text; v_name text;
  v_should_welcome boolean := false;
begin
  v_digits := regexp_replace(coalesce(new.whatsapp, ''), '\\D', '', 'g');
  if length(v_digits) in (10, 11) then v_digits := '55' || v_digits; end if;
  if length(v_digits) between 8 and 15 and left(v_digits, 1) <> '0' then v_phone := '+' || v_digits; else v_phone := null; end if;
  select * into v_contact from public.atis_contacts where user_id = new.user_id limit 1;
  if v_phone is null then
    if v_contact.id is not null then
      update public.atis_contacts set whatsapp_opt_in=false,is_active=false,opt_out_at=case when whatsapp_opt_in then now() else opt_out_at end,opt_out_source=coalesce(opt_out_source,'app_profile'),consent_updated_at=now(),updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('app_profile_synced_at',now()) where id=v_contact.id;
      update public.atis_message_targets set status='cancelled',last_error_code='CONTACT_OPTED_OUT',last_error_message='WhatsApp authorization is disabled in the app profile.',updated_at=now() where contact_id=v_contact.id and status='pending';
    end if;
    return new;
  end if;
  v_name := coalesce(nullif(trim(new.display_name), ''), v_phone);
  v_should_welcome := new.whatsapp_opt_in=true and (tg_op='INSERT' or coalesce(old.whatsapp_opt_in,false)=false) and (v_contact.id is null or v_contact.welcome_sent_at is null);
  if v_contact.id is null then
    begin
      insert into public.atis_contacts(user_id,name,phone_e164,source,whatsapp_opt_in,opt_in_source,opt_in_at,opt_out_at,opt_out_source,reactivation_requires_app,consent_updated_at,is_active,metadata)
      values(new.user_id,v_name,v_phone,'app',new.whatsapp_opt_in=true,case when new.whatsapp_opt_in then 'app_profile' else null end,case when new.whatsapp_opt_in then now() else null end,case when new.whatsapp_opt_in then null else now() end,case when new.whatsapp_opt_in then null else 'app_profile' end,false,now(),true,jsonb_build_object('app_profile_synced_at',now())) returning * into v_contact;
    exception when unique_violation then raise warning 'ATIS contact sync skipped for user % because WhatsApp is already linked.', new.user_id; return new; end;
  else
    begin
      update public.atis_contacts set name=v_name,phone_e164=v_phone,source='app',whatsapp_opt_in=new.whatsapp_opt_in=true,opt_in_source=case when new.whatsapp_opt_in then 'app_profile' else opt_in_source end,opt_in_at=case when new.whatsapp_opt_in then coalesce(opt_in_at,now()) else opt_in_at end,opt_out_at=case when new.whatsapp_opt_in then null when whatsapp_opt_in then now() else opt_out_at end,opt_out_source=case when new.whatsapp_opt_in then null when reactivation_requires_app then coalesce(opt_out_source,'whatsapp_keyword') else 'app_profile' end,reactivation_requires_app=case when new.whatsapp_opt_in then false else reactivation_requires_app end,consent_updated_at=now(),is_active=true,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('app_profile_synced_at',now()),updated_at=now() where id=v_contact.id returning * into v_contact;
    exception when unique_violation then raise warning 'ATIS contact sync skipped for user % because WhatsApp is already linked.', new.user_id; return new; end;
  end if;
  if new.whatsapp_opt_in is not true then
    update public.atis_message_targets set status='cancelled',last_error_code='CONTACT_OPTED_OUT',last_error_message='WhatsApp authorization is disabled in the app profile.',updated_at=now() where contact_id=v_contact.id and status='pending'; return new;
  end if;
  if v_should_welcome and v_contact.welcome_sent_at is null then
    select id into v_instance_id from public.atis_instances where status='connected' order by created_at limit 1;
    if v_instance_id is not null then
      select coalesce(value->>'message','') into v_welcome from public.atis_settings where key='welcome';
      if nullif(trim(v_welcome),'') is not null then
        v_welcome := replace(v_welcome,'{{nome}}',v_name);
        begin
          insert into public.atis_messages(instance_id,source_type,message_type,content,status,priority,scheduled_for,available_at,dedupe_key,metadata) values(v_instance_id,'system','text',v_welcome,'queued',20,now(),now(),'welcome:contact:'||v_contact.id::text,jsonb_build_object('event_key','app_signup_welcome','contact_id',v_contact.id)) returning id into v_message_id;
          insert into public.atis_message_targets(message_id,target_type,target_key,contact_id,phone_e164,display_name,status,attempt_count,max_attempts,available_at,metadata) values(v_message_id,'contact','contact:'||v_contact.id::text,v_contact.id,v_contact.phone_e164,v_contact.name,'pending',0,3,now(),jsonb_build_object('event_key','app_signup_welcome'));
          update public.atis_contacts set welcome_sent_at=now(),updated_at=now() where id=v_contact.id;
        exception when unique_violation then update public.atis_contacts set welcome_sent_at=coalesce(welcome_sent_at,now()),updated_at=now() where id=v_contact.id; end;
      end if;
    end if;
  end if;
  return new;
exception when others then raise warning 'ATIS profile consent sync failed for user %: %', new.user_id, sqlerrm; return new;
end;
$function$;

drop trigger if exists atis_sync_profile_consent_trg on public.profiles;
create trigger atis_sync_profile_consent_trg after insert or update of display_name,whatsapp,whatsapp_opt_in on public.profiles for each row execute function public.atis_sync_profile_consent();
