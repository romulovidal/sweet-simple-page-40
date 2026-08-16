/**
 * ATIS Removal Plan
 * 
 * 1. Database Cleanup: 
 *    - Remove profiles.atis_welcomed_at column.
 *    - Delete ATIS keys from admin_settings.
 *    - Unschedule all 'atis-%' cron jobs.
 *    - Drop all atis_* tables.
 * 
 * 2. Edge Functions:
 *    - Remove local supabase/functions/atis-* directories.
 *    - Remove exclusive shared helpers (atis-antiban, atis-auth, etc).
 *    - Refactor daily-verse-push and smart-notifications to remove ATIS engine dependencies.
 *    - Remove SafeSend from send-push.
 * 
 * 3. Frontend:
 *    - Clean up useIsAdmin logs.
 *    - Keep whatsapp/whatsapp_opt_in in profiles (Shared feature for future contact/profile).
 *    - Ensure route guards and admin panels are ATIS-free.
 */
