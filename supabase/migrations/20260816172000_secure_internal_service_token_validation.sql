-- Securely validate server-to-server service_role JWTs received by Edge Functions.
-- PostgREST verifies the JWT signature before auth.jwt() is exposed to this RPC.
-- This keeps pg_net cron calls working even when Vault holds a still-valid
-- rotated service_role JWT that differs from the current Edge runtime secret.

create or replace function public.is_internal_service_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() ->> 'role') = 'service_role'
    and (auth.jwt() ->> 'ref') = 'karyuuhxeismshhxuokg',
    false
  );
$$;

revoke all on function public.is_internal_service_request() from public, anon, authenticated;
grant execute on function public.is_internal_service_request() to service_role;

comment on function public.is_internal_service_request() is
'Server-only helper for Edge Functions to verify a signed Supabase service_role JWT through PostgREST. Not an application role check.';
