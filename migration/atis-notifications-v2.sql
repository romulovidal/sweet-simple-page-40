-- ========================================================================================
-- INVENTÁRIO DO SISTEMA ATIS ATUAL
-- ========================================================================================
-- TABELAS ATUAIS RELEVANTES:
-- 1. admin_settings: Armazena configurações JSON dispersas (atis_daily_devotional, atis_birthday_greeting, atis_antiban, etc).
-- 2. atis_config: Configurações do bot (nome, persona, triggers, timezone). Singleton ID=1.
-- 3. atis_groups: Cadastro de grupos de WhatsApp (@g.us) com preferências de notificação.
-- 4. atis_contacts: Cadastro de contatos individuais com tags e opt-in.
-- 5. atis_birthdays: Cadastro manual de aniversariantes vinculados a grupos ou telefones.
-- 6. atis_broadcasts: Agendamento de disparos manuais (status: scheduled, sent, error).
-- 7. atis_plan_subscribers: Inscrições em planos de leitura bíblica (current_day, last_sent_date).
-- 8. atis_series: Séries temáticas (itens JSON, group_ids, send_time).
-- 9. atis_series_group_progress / atis_series_subscribers: Controle de progresso em séries.
-- 10. atis_messages_log: Log simples de mensagens enviadas/recebidas.
-- 11. atis_send_ledger: Ledger para controle de antiban (body_hash, recipient, day).
--
-- MAPEAMENTO DE BACKFILL:
-- - Configurações de admin_settings ('atis_daily_devotional', 'atis_birthday_greeting') serão migradas para atis_notification_configs.
-- - Grupos existentes em atis_groups serão vinculados como targets.
-- - Configurações de atis_config (timezone) serão migradas para atis_automation_settings.
-- ========================================================================================

-- EXECUTE ESTE SQL NO SUPABASE

-- 1. Configurações Globais (Singleton)
CREATE TABLE IF NOT EXISTS public.atis_automation_settings (
    id integer PRIMARY KEY CHECK (id = 1), -- Singleton pattern
    timezone text NOT NULL DEFAULT 'America/Fortaleza',
    quiet_hours_start integer CHECK (quiet_hours_start BETWEEN 0 AND 23),
    quiet_hours_end integer CHECK (quiet_hours_end BETWEEN 0 AND 23),
    global_enabled boolean NOT NULL DEFAULT true,
    max_retries_default integer NOT NULL DEFAULT 3,
    retry_interval_minutes integer NOT NULL DEFAULT 15,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Configurações de Automação/Notificação
CREATE TABLE IF NOT EXISTS public.atis_notification_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    notification_type text NOT NULL, -- ex: 'devotional', 'birthday', 'plan-reading', 'series', 'broadcast'
    enabled boolean NOT NULL DEFAULT true,
    automation_mode text NOT NULL DEFAULT 'automatic' CHECK (automation_mode IN ('automatic', 'manual')),
    send_times text[] NOT NULL DEFAULT '{ "07:00" }', -- Permite múltiplos horários
    timezone text, -- Override da global se necessário
    days_of_week integer[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=domingo, 6=sábado
    message_template text,
    use_ai boolean NOT NULL DEFAULT false,
    ai_prompt text,
    retry_enabled boolean NOT NULL DEFAULT true,
    retry_max integer NOT NULL DEFAULT 3,
    delay_between_messages_ms integer NOT NULL DEFAULT 5000,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint para dias da semana (0-6)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_days_of_week') THEN
        ALTER TABLE public.atis_notification_configs 
        ADD CONSTRAINT check_days_of_week 
        CHECK (days_of_week <@ ARRAY[0,1,2,3,4,5,6]);
    END IF;
END $$;

-- 3. Destinatários da Automação (Targets)
CREATE TABLE IF NOT EXISTS public.atis_notification_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id uuid NOT NULL REFERENCES public.atis_notification_configs(id) ON DELETE CASCADE,
    target_id text NOT NULL, -- UUID de profile, telefone, JID @g.us, ou tag
    target_type text NOT NULL CHECK (target_type IN ('profile', 'contact', 'group', 'tag', 'jid_individual')),
    active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(config_id, target_id)
);

-- 4. Logs de Automação e Idempotência
CREATE TABLE IF NOT EXISTS public.atis_automation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id uuid NOT NULL REFERENCES public.atis_notification_configs(id) ON DELETE CASCADE,
    target_id text NOT NULL,
    idempotency_key text UNIQUE NOT NULL, -- Gerada como: config_id:target_id:occurrence_iso
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'processing', 'retrying', 'sent', 'failed', 'skipped', 'postponed')),
    occurrence_key text NOT NULL, -- A chave da ocorrência (ex: 2026-08-14T07:00:00-03:00)
    scheduled_for timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    next_retry_at timestamptz,
    last_error text,
    processed_at timestamptz,
    message_sent_id text, -- ID da mensagem na Evolution API
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Tentativas de Envio (Opcional para auditoria detalhada)
CREATE TABLE IF NOT EXISTS public.atis_automation_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id uuid NOT NULL REFERENCES public.atis_automation_logs(id) ON DELETE CASCADE,
    attempt_number integer NOT NULL,
    status text NOT NULL,
    error_message text,
    response_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ========================================================================================
-- RLS - SEGURANÇA E PRIVILÉGIOS
-- ========================================================================================

-- Habilitar RLS
ALTER TABLE public.atis_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_notification_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_notification_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atis_automation_attempts ENABLE ROW LEVEL SECURITY;

-- Grants para authenticated
GRANT SELECT ON public.atis_automation_settings TO authenticated;
GRANT SELECT ON public.atis_notification_configs TO authenticated;
GRANT SELECT ON public.atis_notification_targets TO authenticated;
GRANT SELECT ON public.atis_automation_logs TO authenticated;
GRANT SELECT ON public.atis_automation_attempts TO authenticated;

-- Grants para service_role (Edge Functions)
GRANT ALL ON public.atis_automation_settings TO service_role;
GRANT ALL ON public.atis_notification_configs TO service_role;
GRANT ALL ON public.atis_notification_targets TO service_role;
GRANT ALL ON public.atis_automation_logs TO service_role;
GRANT ALL ON public.atis_automation_attempts TO service_role;

-- Policies para Admins
CREATE POLICY "Admins can do everything on atis_automation_settings" 
ON public.atis_automation_settings FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can do everything on atis_notification_configs" 
ON public.atis_notification_configs FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can do everything on atis_notification_targets" 
ON public.atis_notification_targets FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can do everything on atis_automation_logs" 
ON public.atis_automation_logs FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can do everything on atis_automation_attempts" 
ON public.atis_automation_attempts FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- ========================================================================================
-- ÍNDICES ADICIONAIS
-- ========================================================================================
CREATE INDEX IF NOT EXISTS idx_atis_logs_status_scheduled ON public.atis_automation_logs(status, scheduled_for) WHERE status IN ('scheduled', 'pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_atis_logs_config_target ON public.atis_automation_logs(config_id, target_id);
CREATE INDEX IF NOT EXISTS idx_atis_targets_config_id ON public.atis_notification_targets(config_id);

-- ========================================================================================
-- SEEDS E BACKFILL INICIAL
-- ========================================================================================

-- Seed Singleton Settings
INSERT INTO public.atis_automation_settings (id, timezone, quiet_hours_start, quiet_hours_end)
SELECT 1, COALESCE((SELECT timezone FROM public.atis_config LIMIT 1), 'America/Fortaleza'), 21, 7
ON CONFLICT (id) DO NOTHING;

-- Backfill: Devocional Diário (atis_daily_devotional)
DO $$
DECLARE
    v_config_id uuid;
    v_val jsonb;
    v_group_id text;
BEGIN
    SELECT value INTO v_val FROM public.admin_settings WHERE key = 'atis_daily_devotional';
    IF v_val IS NOT NULL THEN
        INSERT INTO public.atis_notification_configs (name, notification_type, enabled, send_times, automation_mode)
        VALUES (
            'Devocional Diário (Migrado)', 
            'devotional', 
            COALESCE((v_val->>'enabled')::boolean, true), 
            ARRAY[COALESCE(v_val->>'time', '06:30')],
            'automatic'
        ) RETURNING id INTO v_config_id;

        -- Targets (Grupos)
        IF v_val->'group_ids' IS NOT NULL THEN
            FOR v_group_id IN SELECT jsonb_array_elements_text(v_val->'group_ids') LOOP
                INSERT INTO public.atis_notification_targets (config_id, target_id, target_type)
                VALUES (v_config_id, v_group_id, 'group')
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END IF;
END $$;

-- Backfill: Aniversariantes (atis_birthday_greeting)
DO $$
DECLARE
    v_config_id uuid;
    v_val jsonb;
    v_group_id text;
BEGIN
    SELECT value INTO v_val FROM public.admin_settings WHERE key = 'atis_birthday_greeting';
    IF v_val IS NOT NULL THEN
        INSERT INTO public.atis_notification_configs (name, notification_type, enabled, send_times, message_template, use_ai, automation_mode)
        VALUES (
            'Aniversariantes (Migrado)', 
            'birthday', 
            COALESCE((v_val->>'enabled')::boolean, true), 
            ARRAY[COALESCE(v_val->>'time', '08:00')],
            v_val->>'template',
            COALESCE((v_val->>'use_ai')::boolean, true),
            'automatic'
        ) RETURNING id INTO v_config_id;

        -- Targets (Grupos)
        IF v_val->'group_ids' IS NOT NULL THEN
            FOR v_group_id IN SELECT jsonb_array_elements_text(v_val->'group_ids') LOOP
                INSERT INTO public.atis_notification_targets (config_id, target_id, target_type)
                VALUES (v_config_id, v_group_id, 'group')
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END IF;
END $$;
