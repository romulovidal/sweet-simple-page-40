-- Snapshot de Rollback para Schedulers Legados ATIS
-- Execute este script para restaurar os 11 jobs individuais caso o unificado falhe.

-- SELECT cron.unschedule('atis-send-every-minute');

-- Exemplo de restauração (ajustar URLs conforme ambiente real)
-- SELECT cron.schedule('atis-daily-devotional-every-minute', '* * * * *', $$ 
--   SELECT net.http_post(url:='https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/atis-daily-devotional', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ..."}') 
-- $$);
