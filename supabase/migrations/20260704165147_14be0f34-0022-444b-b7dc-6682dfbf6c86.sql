-- Lock down SECURITY DEFINER functions so anon cannot call them directly
REVOKE ALL ON FUNCTION public.get_analytics_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_retention_metrics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_retention_metrics(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_data() TO service_role;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_prayer_author_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prayer_author_names(uuid[]) TO authenticated, service_role;