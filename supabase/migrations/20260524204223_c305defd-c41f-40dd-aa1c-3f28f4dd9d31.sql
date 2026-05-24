-- Revoke EXECUTE from PUBLIC for SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_admin_activity_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;

-- Grant EXECUTE only to roles that need it
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- handle_new_user is a trigger on auth.users, so it doesn't need to be callable by users.
-- handle_admin_activity_log is a trigger on public tables, same here.
