-- Create the function to log activity from triggers
CREATE OR REPLACE FUNCTION public.handle_admin_activity_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_activity_log (user_id, action, details)
  VALUES (
    CASE 
      WHEN TG_TABLE_NAME = 'push_log' THEN (NEW.sent_by)
      ELSE auth.uid()
    END,
    TG_ARGV[0],
    row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for push_log
DROP TRIGGER IF EXISTS tr_log_push_sent ON public.push_log;
CREATE TRIGGER tr_log_push_sent
AFTER INSERT ON public.push_log
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_activity_log('push_sent');

-- Add triggers for other important actions to ensure everything is logged
DROP TRIGGER IF EXISTS tr_log_post_created ON public.admin_posts;
CREATE TRIGGER tr_log_post_created
AFTER INSERT ON public.admin_posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_activity_log('post_created');

DROP TRIGGER IF EXISTS tr_log_plan_created ON public.admin_plans;
CREATE TRIGGER tr_log_plan_created
AFTER INSERT ON public.admin_plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_activity_log('plan_created');
