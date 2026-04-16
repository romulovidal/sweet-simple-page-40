-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule culto reminder check every 15 minutes
SELECT cron.schedule(
  'culto-reminder-check',
  '*/15 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/culto-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZG1vYnlwc3Frc2drZnJ6aHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5Mzc1NzksImV4cCI6MjA5MTUxMzU3OX0.INbOP1g7TrhExgU6EMfGsoWo4oMzE57skEarnblPkO0'
    ),
    body := '{}'
  ) AS request_id;
  $$
);