-- ATIS SURGICAL REMOVAL MIGRATION

-- 1. Remove residual columns in profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS atis_welcomed_at;

-- 2. Remove ATIS specific settings in admin_settings
DELETE FROM public.admin_settings 
WHERE key IN (
  'atis_antiban', 
  'atis_daily_devotional', 
  'atis_birthday_greeting', 
  'atis_access_control',
  'atis_crisis_alert',
  'atis_daily_verse_dm',
  'atis_daily_devotional_enabled',
  'atis_global_enabled'
);

-- 3. Unschedule all ATIS related cron jobs
DO $$
DECLARE
    job_record RECORD;
BEGIN
    FOR job_record IN SELECT jobname FROM cron.job WHERE jobname LIKE 'atis-%' LOOP
        PERFORM cron.unschedule(job_record.jobname);
        RAISE NOTICE 'Unscheduled ATIS job: %', job_record.jobname;
    END LOOP;
END $$;

-- 4. Remove any residual ATIS specific RPCs (security definer)
DROP FUNCTION IF EXISTS public.atis_guard_check(uuid);
DROP FUNCTION IF EXISTS public.atis_can_send(uuid);

-- 5. Final check for atis_* tables (safe drop)
DROP TABLE IF EXISTS public.atis_groups CASCADE;
DROP TABLE IF EXISTS public.atis_config CASCADE;
DROP TABLE IF EXISTS public.atis_notification_configs CASCADE;
DROP TABLE IF EXISTS public.atis_notification_targets CASCADE;
DROP TABLE IF EXISTS public.atis_automation_settings CASCADE;
DROP TABLE IF EXISTS public.atis_crisis_mutes CASCADE;
DROP TABLE IF EXISTS public.atis_series CASCADE;
DROP TABLE IF EXISTS public.atis_series_subscribers CASCADE;
DROP TABLE IF EXISTS public.atis_logs CASCADE;
DROP TABLE IF EXISTS public.atis_instance_logs CASCADE;
