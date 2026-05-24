-- Explicitly revoke EXECUTE from anon and authenticated roles
REVOKE EXECUTE ON FUNCTION public.handle_admin_activity_log() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
