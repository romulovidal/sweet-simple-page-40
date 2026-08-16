do $$
begin
  if not exists (select 1 from vault.secrets where name = 'atis_webhook_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'atis_webhook_secret',
      'ATIS V3 Evolution webhook authentication secret',
      null
    );
  end if;
end;
$$;

create or replace function public.atis_get_webhook_secret()
returns text
language sql
stable
security definer
set search_path = vault, public
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'atis_webhook_secret'
  limit 1;
$$;

revoke all on function public.atis_get_webhook_secret() from public, anon, authenticated;
grant execute on function public.atis_get_webhook_secret() to service_role;
