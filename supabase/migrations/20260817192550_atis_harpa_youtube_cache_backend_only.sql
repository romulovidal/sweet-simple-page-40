revoke all on table public.atis_harpa_youtube_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.atis_harpa_youtube_cache to service_role;

comment on table public.atis_harpa_youtube_cache is
  'Internal ATIS/YouTube persistent cache. Access is backend-only through service_role; clients must use the Edge Function.';

comment on table public.atis_destination_feature_settings is
  'Internal per-destination ATIS feature configuration. Managed through authenticated Edge Functions; direct client table access is intentionally denied by RLS/grants.';
