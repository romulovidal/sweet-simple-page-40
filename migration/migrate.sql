-- ============================================================================
-- migrate.sql — Infraestrutura pós-schema para o projeto karyuuhxeismshhxuokg
-- ============================================================================
-- ESTE SCRIPT NÃO INSERE NEM ALTERA DADOS DE public, auth.users OU auth.identities.
-- Ele apenas: habilita extensões, cria o helper de chamada de Edge Function,
-- (re)cria o trigger on_auth_user_created, e (re)cria os 11 cron jobs.
--
-- Pré-requisito único (passo manual, 1x):
--   select vault.create_secret('<SERVICE_ROLE_KEY_DO_NOVO_PROJETO>', 'service_role_key');
-- (o script aborta com mensagem clara se esse segredo não existir)
--
-- Execute com psql conectado ao NOVO projeto:
--   psql "$env:TARGET_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f migrate.sql
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Extensões
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;
create extension if not exists pg_trgm with schema public;   -- usado pelas buscas
create extension if not exists pgcrypto with schema extensions;

grant usage on schema cron to postgres;
grant usage on schema net  to postgres;

-- ----------------------------------------------------------------------------
-- 2. Configuração central do projeto (sem segredos em texto puro)
-- ----------------------------------------------------------------------------
create schema if not exists private;

create table if not exists private.app_config (
  key   text primary key,
  value text not null
);
revoke all on private.app_config from anon, authenticated;

insert into private.app_config (key, value)
values ('functions_base_url', 'https://karyuuhxeismshhxuokg.supabase.co/functions/v1')
on conflict (key) do update set value = excluded.value;

-- Aborta cedo se a service_role key ainda não foi guardada no Vault
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'service_role_key') then
    raise exception
      'Vault secret "service_role_key" ausente. Rode antes: select vault.create_secret(''<SERVICE_ROLE_KEY>'', ''service_role_key'');';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Helper seguro de chamada de Edge Function
--    Lê a service_role key do Vault -> nenhuma chave fica no corpo do cron job.
--    Isso permite manter verify_jwt = true nas functions chamadas por cron.
-- ----------------------------------------------------------------------------
create or replace function private.edge_call(_fn text, _body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = private, extensions, vault, public
as $$
declare
  _key  text;
  _base text;
  _req  bigint;
begin
  select decrypted_secret into _key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if _key is null then
    raise exception 'Vault secret "service_role_key" não encontrado';
  end if;

  select value into _base from private.app_config where key = 'functions_base_url';

  select net.http_post(
    url     := _base || '/' || _fn,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'apikey', _key,
                 'Authorization', 'Bearer ' || _key
               ),
    body    := coalesce(_body, '{}'::jsonb),
    timeout_milliseconds := 30000
  ) into _req;

  return _req;
end;
$$;

revoke all on function private.edge_call(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Trigger auth.users -> public.handle_new_user()
--    Idempotente e sem tocar nos dados de auth.users.
--    handle_new_user já foi migrada junto com o schema public.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'handle_new_user') then
    raise exception 'public.handle_new_user() não existe — migre o schema public antes.';
  end if;
end $$;

-- Evita perfis duplicados quando o usuário já foi migrado com perfil.
-- (índice único idempotente; a função usa INSERT simples)
create unique index if not exists profiles_user_id_key on public.profiles (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _wa text;
  _opt boolean;
begin
  _wa := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'whatsapp',''), '\D', '', 'g'), '');
  _opt := coalesce((new.raw_user_meta_data->>'whatsapp_opt_in')::boolean, false);

  insert into public.profiles (user_id, display_name, avatar_url, whatsapp, whatsapp_opt_in)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    _wa,
    case when _wa is not null then _opt else false end
  )
  on conflict (user_id) do nothing;   -- <== não duplica perfis já migrados
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Cron jobs — recriação idempotente, todos apontando para o NOVO projeto
-- ----------------------------------------------------------------------------
do $$
declare
  j record;
begin
  for j in select jobname from cron.job where jobname in (
    'daily-verse-push-final','culto-reminder-every-minute','atis-daily-devotional-every-minute',
    'atis-birthday-greeting-every-minute','atis-broadcast-runner-every-minute',
    'atis-daily-verse-dm-every-minute','atis-series-runner-every-minute',
    'atis-plans-runner-every-minute','atis-welcome-runner-every-5min',
    'smart-notifications-daily','cleanup-old-data-daily')
  loop
    perform cron.unschedule(j.jobname);
  end loop;
end $$;

select cron.schedule('daily-verse-push-final', '* * * * *',
  $$ select private.edge_call('daily-verse-push'); $$);

select cron.schedule('culto-reminder-every-minute', '* * * * *',
  $$ select private.edge_call('culto-reminder', jsonb_build_object('cron', now())); $$);

select cron.schedule('atis-daily-devotional-every-minute', '* * * * *',
  $$ select private.edge_call('atis-daily-devotional', jsonb_build_object('cron', true)); $$);

select cron.schedule('atis-birthday-greeting-every-minute', '* * * * *',
  $$ select private.edge_call('atis-birthday-greeting'); $$);

select cron.schedule('atis-broadcast-runner-every-minute', '* * * * *',
  $$ select private.edge_call('atis-broadcast-runner'); $$);

select cron.schedule('atis-daily-verse-dm-every-minute', '* * * * *',
  $$ select private.edge_call('atis-daily-verse-dm'); $$);

select cron.schedule('atis-series-runner-every-minute', '* * * * *',
  $$ select private.edge_call('atis-series-runner'); $$);

select cron.schedule('atis-plans-runner-every-minute', '* * * * *',
  $$ select private.edge_call('atis-plans-runner'); $$);

select cron.schedule('atis-welcome-runner-every-5min', '*/5 * * * *',
  $$ select private.edge_call('atis-welcome-runner'); $$);

select cron.schedule('smart-notifications-daily', '0 12 * * *',
  $$ select private.edge_call('smart-notifications', jsonb_build_object('cron', now())); $$);

-- Job puramente SQL (não chama Edge Function)
select cron.schedule('cleanup-old-data-daily', '0 6 * * *',
  $$ select public.cleanup_old_data(); $$);

-- ----------------------------------------------------------------------------
-- 6. Storage — origem só possui o bucket privado do próprio dump da migração.
--    Recriado apenas por paridade; nenhum arquivo de usuário precisa migrar.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('database_export_13_08_26', 'database_export_13_08_26', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Sanidade final
-- ----------------------------------------------------------------------------
do $$
declare _bad int;
begin
  select count(*) into _bad from cron.job where command like '%hvdmobypsqksgkfrzhzf%';
  if _bad > 0 then
    raise exception 'Ainda existem % cron jobs apontando para o projeto antigo', _bad;
  end if;
end $$;

commit;

-- Resumo
select jobname, schedule, active from cron.job order by jobname;