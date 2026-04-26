-- Set search_path for the logging function to prevent security issues
ALTER FUNCTION public.handle_admin_activity_log() SET search_path = public;