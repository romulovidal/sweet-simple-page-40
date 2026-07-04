
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, text, integer, integer) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, text, integer, integer) TO service_role;
