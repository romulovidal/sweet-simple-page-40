-- ATIS V2 Stability Migration

-- 1. Habilita o motor global no banco de dados
UPDATE public.atis_automation_settings 
SET global_enabled = true 
WHERE id = 1;

-- 2. Concede privilégios administrativos para o sistema (Service Role)
GRANT ALL ON public.atis_automation_logs TO service_role;
GRANT ALL ON public.atis_automation_attempts TO service_role;
GRANT ALL ON public.atis_automation_settings TO service_role;
GRANT ALL ON public.atis_notification_configs TO service_role;
GRANT ALL ON public.atis_notification_targets TO service_role;

-- 3. Unifica o agendamento no Tick Global
-- Removemos agendamentos antigos para evitar disparos duplicados
DO $$ 
BEGIN
    PERFORM cron.unschedule('atis-send');
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

DO $$ 
BEGIN
    PERFORM cron.unschedule('atis-global-tick');
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- Cria o novo agendamento unificado (a cada minuto)
SELECT cron.schedule(
  'atis-global-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/atis-send',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- 4. Garante permissão de execução na função de proteção contra duplicidade
GRANT EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) TO authenticated, service_role;

-- 5. Configura regras de acesso (RLS) para visualização de logs pelos administradores
ALTER TABLE public.atis_automation_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can view all logs" ON public.atis_automation_logs;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Admins can view all logs" ON public.atis_automation_logs 
FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.atis_automation_attempts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can view all attempts" ON public.atis_automation_attempts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Admins can view all attempts" ON public.atis_automation_attempts 
FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
