-- Disable active smoke tests
UPDATE public.atis_notification_configs 
SET enabled = false 
WHERE name LIKE 'HML — Smoke Test%';

-- Force global disable for safety while user regains control
UPDATE public.atis_automation_settings
SET global_enabled = false
WHERE id = 1;

-- Ensure table grants for admin roles (sometimes missed in migrations)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_automation_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_notification_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_automation_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_messages_log TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
