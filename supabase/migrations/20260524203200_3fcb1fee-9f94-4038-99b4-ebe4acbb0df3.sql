-- Secure handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Secure handle_admin_activity_log
ALTER FUNCTION public.handle_admin_activity_log() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_admin_activity_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_admin_activity_log() TO service_role;

-- Secure has_role (using the correct custom type app_role for the second argument)
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Ensure update_updated_at_column also has a search path for consistency
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;