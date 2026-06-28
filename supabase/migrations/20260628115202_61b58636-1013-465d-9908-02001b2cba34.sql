REVOKE ALL ON FUNCTION public.handle_admin_activity_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_admin_activity_log() FROM anon;
REVOKE ALL ON FUNCTION public.handle_admin_activity_log() FROM authenticated;