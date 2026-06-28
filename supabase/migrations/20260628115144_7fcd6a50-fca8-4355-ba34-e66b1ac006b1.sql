CREATE OR REPLACE FUNCTION public.handle_admin_activity_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'push_log' THEN
    log_user_id := NULLIF(row_to_json(NEW)->>'sent_by', '')::uuid;
  ELSE
    log_user_id := auth.uid();
  END IF;

  INSERT INTO public.admin_activity_log (user_id, action, details)
  VALUES (
    log_user_id,
    TG_ARGV[0],
    row_to_json(NEW)::jsonb
  );

  RETURN NEW;
END;
$$;