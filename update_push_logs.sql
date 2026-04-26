-- Check if the trigger already exists to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_push_log_activity'
    ) THEN
        CREATE TRIGGER on_push_log_activity
        AFTER INSERT ON public.push_log
        FOR EACH ROW
        EXECUTE FUNCTION public.log_admin_activity('push_sent');
    END IF;
END $$;
