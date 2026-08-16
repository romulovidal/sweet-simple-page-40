-- Migration to remove ATIS system
-- 1. Remove Tables
DROP TABLE IF EXISTS "public"."atis_groups" CASCADE;
DROP TABLE IF EXISTS "public"."atis_contacts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_crisis_alerts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_crisis_mutes" CASCADE;
DROP TABLE IF EXISTS "public"."atis_plan_subscribers" CASCADE;
DROP TABLE IF EXISTS "public"."atis_series_group_progress" CASCADE;
DROP TABLE IF EXISTS "public"."atis_series_subscribers" CASCADE;
DROP TABLE IF EXISTS "public"."atis_birthdays" CASCADE;
DROP TABLE IF EXISTS "public"."atis_series" CASCADE;
DROP TABLE IF EXISTS "public"."atis_send_ledger" CASCADE;
DROP TABLE IF EXISTS "public"."atis_messages_log" CASCADE;
DROP TABLE IF EXISTS "public"."atis_optouts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_studies" CASCADE;
DROP TABLE IF EXISTS "public"."atis_broadcasts" CASCADE;
DROP TABLE IF EXISTS "public"."atis_config" CASCADE;
DROP TABLE IF EXISTS "public"."atis_automation_settings" CASCADE;
DROP TABLE IF EXISTS "public"."atis_notification_configs" CASCADE;
DROP TABLE IF EXISTS "public"."atis_notification_targets" CASCADE;
DROP TABLE IF EXISTS "public"."atis_automation_logs" CASCADE;
DROP TABLE IF EXISTS "public"."atis_automation_attempts" CASCADE;

-- 2. Remove Functions
DROP FUNCTION IF EXISTS "public"."atis_claim_automation_occurrence" CASCADE;
DROP FUNCTION IF EXISTS "public"."atis_guard_check" CASCADE;
DROP FUNCTION IF EXISTS "public"."atis_v2_set_updated_at" CASCADE;

-- 3. Unschedule Cron Jobs (if extension exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('atis-daily-devotional-every-minute');
        PERFORM cron.unschedule('atis-birthday-greeting-every-minute');
        PERFORM cron.unschedule('atis-broadcast-runner-every-minute');
        PERFORM cron.unschedule('atis-daily-verse-dm-every-minute');
        PERFORM cron.unschedule('atis-series-runner-every-minute');
        PERFORM cron.unschedule('atis-plans-runner-every-minute');
        PERFORM cron.unschedule('atis-welcome-runner-every-5min');
        PERFORM cron.unschedule('atis-global-tick');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not unschedule cron jobs: %', SQLERRM;
END $$;
