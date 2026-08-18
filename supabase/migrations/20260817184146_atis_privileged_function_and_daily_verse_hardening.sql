-- Harden internal ATIS database functions and make the daily-verse view obey
-- the RLS policies of its underlying queue.
--
-- Supabase projects may grant EXECUTE directly to anon/authenticated through
-- default privileges. Revoking only PUBLIC is therefore insufficient.

revoke execute on function public.atis_get_culto_candidates(integer,text)
  from public, anon, authenticated;
grant execute on function public.atis_get_culto_candidates(integer,text)
  to service_role;

revoke execute on function public.atis_sync_profile_consent()
  from public, anon, authenticated;
grant execute on function public.atis_sync_profile_consent()
  to service_role;

revoke execute on function public.atis_birthdays_sync_day_month()
  from public, anon, authenticated;
grant execute on function public.atis_birthdays_sync_day_month()
  to service_role;

alter view public.current_daily_verse
  set (security_invoker = true);
