-- ========================================================================================
-- SISTEMA ATIS V2 — MIGRATION DE INFRAESTRUTURA (CORRIGIDA)
-- ========================================================================================
-- Este script define a infraestrutura centralizada de automação e notificações do ATIS.
-- FOCO: Idempotência, Claim Atômico, Multimeios, Timezone dinâmico e Backfill seguro.
-- ========================================================================================

BEGIN;

-- 1. IDENTIFICAÇÃO DO SCHEMA DE ADMINISTRAÇÃO (user_roles / has_role)
-- O projeto utiliza a tabela public.user_roles e a função public.has_role (SECURITY DEFINER).
-- Nenhuma alteração será feita nessas estruturas, apenas seu uso para policies.

-- 2. CONFIGURAÇÕES GLOBAIS (SINGLETON)
CREATE TABLE IF NOT EXISTS public.atis_automation_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton Garantido
    timezone text NOT NULL DEFAULT 'America/Fortaleza',
    quiet_hours_enabled boolean NOT NULL DEFAULT true,
    quiet_hours_start time NOT NULL DEFAULT '21:00',
    quiet_hours_end time NOT NULL DEFAULT '07:00',
    global_enabled boolean NOT NULL DEFAULT true,
    default_delay_between_messages_ms integer NOT NULL DEFAULT 5000 CHECK (default_delay_between_messages_ms >= 0),
    max_messages_per_minute integer NOT NULL DEFAULT 20 CHECK (max_messages_per_minute > 0),
    default_retry_max integer NOT NULL DEFAULT 3 CHECK (default_retry_max >= 0),
    retry_interval_minutes integer NOT NULL DEFAULT 15 CHECK (retry_interval_minutes > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. CONFIGURAÇÕES DE AUTOMAÇÃO (V2)
CREATE TABLE IF NOT EXISTS public.atis_notification_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key text UNIQUE, -- Chave determinística para idempotência de sistema/legado
    name text NOT NULL,
    notification_type text NOT NULL, -- 'devotional', 'birthday', 'plan-reading', 'series', 'broadcast', 'welcome', 'smart-notif'
    enabled boolean NOT NULL DEFAULT true,
    automation_mode text NOT NULL DEFAULT 'automatic' CHECK (automation_mode IN ('automatic', 'manual')),
    send_times time[] NOT NULL DEFAULT '{ "07:00" }',
    timezone text, -- Override (NULL = usa global)
    days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=domingo, 6=sábado
    message_template text,
    use_ai boolean NOT NULL DEFAULT false,
    ai_prompt text,
    retry_enabled boolean NOT NULL DEFAULT true,
    retry_max integer NOT NULL DEFAULT 3,
    delay_between_messages_ms integer, -- NULL = usa global
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint para dias da semana
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_days_of_week_v2') THEN
        ALTER TABLE public.atis_notification_configs 
        ADD CONSTRAINT check_days_of_week_v2 
        CHECK (days_of_week <@ ARRAY[0,1,2,3,4,5,6]);
    END IF;
END $$;

-- 4. DESTINATÁRIOS (TARGETS)
CREATE TABLE IF NOT EXISTS public.atis_notification_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id uuid NOT NULL REFERENCES public.atis_notification_configs(id) ON DELETE CASCADE,
    target_id text NOT NULL, -- UUID, telefone, JID, tag
    target_type text NOT NULL CHECK (target_type IN ('profile', 'contact', 'group', 'tag', 'jid_individual', 'all_authenticated')),
    active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(config_id, target_type, target_id)
);

-- 5. MOTOR DE IDEMPOTÊNCIA E LOGS
CREATE TABLE IF NOT EXISTS public.atis_automation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id uuid NOT NULL REFERENCES public.atis_notification_configs(id) ON DELETE CASCADE,
    source_target_id uuid, -- Referência opcional ao registro de target original
    recipient_type text NOT NULL, -- 'individual', 'group'
    recipient_key text NOT NULL, -- O JID FINAL ou Telefone FINAL (@s.whatsapp.net ou @g.us)
    occurrence_key text NOT NULL, -- Identidade canônica da ocorrência (ex: 2026-08-14:07:00)
    idempotency_key text UNIQUE NOT NULL, -- config_id:recipient_key:occurrence_key
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'processing', 'retrying', 'sent', 'failed', 'skipped', 'postponed')),
    scheduled_for timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_attempt_at timestamptz,
    next_retry_at timestamptz,
    last_error text,
    processed_at timestamptz,
    message_sent_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. TENTATIVAS DETALHADAS
CREATE TABLE IF NOT EXISTS public.atis_automation_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id uuid NOT NULL REFERENCES public.atis_automation_logs(id) ON DELETE CASCADE,
    attempt_number integer NOT NULL CHECK (attempt_number > 0),
    status text NOT NULL,
    error_message text,
    response_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(log_id, attempt_number)
);

-- 7. FUNÇÃO DE UPDATED_AT (IDEMPOTENTE)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. TRIGGERS DE UPDATED_AT
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_atis_settings_updated_at') THEN
        CREATE TRIGGER tr_atis_settings_updated_at BEFORE UPDATE ON public.atis_automation_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_atis_configs_updated_at') THEN
        CREATE TRIGGER tr_atis_configs_updated_at BEFORE UPDATE ON public.atis_notification_configs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_atis_logs_updated_at') THEN
        CREATE TRIGGER tr_atis_logs_updated_at BEFORE UPDATE ON public.atis_automation_logs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- 9. FUNÇÃO DE CLAIM ATÔMICO (RPC)
-- Esta função permite que o runner obtenha uma ocorrência para processar de forma segura.
CREATE OR REPLACE FUNCTION public.atis_claim_automation_occurrence(
    _log_id uuid,
    _worker_id text
)
RETURNS public.atis_automation_logs AS $$
DECLARE
    _result public.atis_automation_logs;
BEGIN
    UPDATE public.atis_automation_logs
    SET 
        status = 'processing',
        last_attempt_at = now(),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id = _log_id
      AND status IN ('scheduled', 'pending', 'retrying')
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    RETURNING * INTO _result;

    RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RLS E POLICIES (IDEMPOTENTES)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['atis_automation_settings', 'atis_notification_configs', 'atis_notification_targets', 'atis_automation_logs', 'atis_automation_attempts']) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Policy para Admins (Full)
        EXECUTE format('DROP POLICY IF EXISTS "Admins can do everything on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admins can do everything on %I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);

        -- Policy para Service Role (Full implicito, mas garantindo)
        -- Supabase service_role já ignora RLS por padrão, mas mantemos grants explícitos.
    END LOOP;
END $$;

-- Grants explícitos (PostgREST)
GRANT ALL ON public.atis_automation_settings TO authenticated, service_role;
GRANT ALL ON public.atis_notification_configs TO authenticated, service_role;
GRANT ALL ON public.atis_notification_targets TO authenticated, service_role;
GRANT ALL ON public.atis_automation_logs TO authenticated, service_role;
GRANT ALL ON public.atis_automation_attempts TO authenticated, service_role;

-- 11. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_atis_logs_processing_queue ON public.atis_automation_logs(status, scheduled_for) WHERE status IN ('scheduled', 'pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_atis_logs_idempotency ON public.atis_automation_logs(idempotency_key);

-- 12. SEEDS E BACKFILL (IDEMPOTENTE COM source_key)

-- Seed Global Settings (Preservando Antibando Legado)
DO $$
DECLARE
    v_antiban jsonb;
    v_tz text;
BEGIN
    SELECT value INTO v_antiban FROM public.admin_settings WHERE key = 'atis_antiban';
    SELECT timezone INTO v_tz FROM public.atis_config WHERE id = 1;
    
    INSERT INTO public.atis_automation_settings (
        id, timezone, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    )
    VALUES (
        1, 
        COALESCE(v_tz, 'America/Fortaleza'),
        COALESCE((v_antiban->>'enabled')::boolean, true),
        (COALESCE(v_antiban->>'quiet_start', '21') || ':00')::time,
        (COALESCE(v_antiban->>'quiet_end', '07') || ':00')::time
    )
    ON CONFLICT (id) DO UPDATE SET
        timezone = EXCLUDED.timezone,
        quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end;
END $$;

-- Backfill: Devocional Diário
DO $$
DECLARE
    v_config_id uuid;
    v_val jsonb;
    v_group_id text;
BEGIN
    SELECT value INTO v_val FROM public.admin_settings WHERE key = 'atis_daily_devotional';
    IF v_val IS NOT NULL THEN
        INSERT INTO public.atis_notification_configs (source_key, name, notification_type, enabled, send_times)
        VALUES (
            'legacy:atis_daily_devotional',
            'Devocional Diário (Migrado)', 
            'devotional', 
            COALESCE((v_val->>'enabled')::boolean, true), 
            ARRAY[(COALESCE(v_val->>'time', '06:30') || ':00')::time]
        )
        ON CONFLICT (source_key) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            send_times = EXCLUDED.send_times
        RETURNING id INTO v_config_id;

        -- Targets (Grupos Reais do Projeto)
        IF v_val->'group_ids' IS NOT NULL THEN
            FOR v_group_id IN SELECT jsonb_array_elements_text(v_val->'group_ids') LOOP
                INSERT INTO public.atis_notification_targets (config_id, target_id, target_type)
                VALUES (v_config_id, v_group_id, 'group')
                ON CONFLICT (config_id, target_type, target_id) DO NOTHING;
            END LOOP;
        END IF;
    END IF;
END $$;

-- Backfill: Aniversariantes
DO $$
DECLARE
    v_config_id uuid;
    v_val jsonb;
    v_group_id text;
BEGIN
    SELECT value INTO v_val FROM public.admin_settings WHERE key = 'atis_birthday_greeting';
    IF v_val IS NOT NULL THEN
        INSERT INTO public.atis_notification_configs (source_key, name, notification_type, enabled, send_times, message_template, use_ai)
        VALUES (
            'legacy:atis_birthday_greeting',
            'Aniversariantes (Migrado)', 
            'birthday', 
            COALESCE((v_val->>'enabled')::boolean, true), 
            ARRAY[(COALESCE(v_val->>'time', '08:00') || ':00')::time],
            v_val->>'template',
            COALESCE((v_val->>'use_ai')::boolean, true)
        )
        ON CONFLICT (source_key) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            send_times = EXCLUDED.send_times,
            message_template = EXCLUDED.message_template,
            use_ai = EXCLUDED.use_ai
        RETURNING id INTO v_config_id;

        -- Targets (Grupos)
        IF v_val->'group_ids' IS NOT NULL THEN
            FOR v_group_id IN SELECT jsonb_array_elements_text(v_val->'group_ids') LOOP
                INSERT INTO public.atis_notification_targets (config_id, target_id, target_type)
                VALUES (v_config_id, v_group_id, 'group')
                ON CONFLICT (config_id, target_type, target_id) DO NOTHING;
            END LOOP;
        END IF;
    END IF;
END $$;

-- Seed: Bem-vindo (System Default)
INSERT INTO public.atis_notification_configs (source_key, name, notification_type, automation_mode)
VALUES ('system:welcome', 'Mensagem de Boas-vindas', 'welcome', 'automatic')
ON CONFLICT (source_key) DO NOTHING;

-- Seed: Smart Notifications (System Default)
INSERT INTO public.atis_notification_configs (source_key, name, notification_type, automation_mode, send_times)
VALUES ('system:smart_notifications', 'Lembretes de Inatividade/Metas', 'smart-notif', 'automatic', '{ "09:00" }')
ON CONFLICT (source_key) DO NOTHING;

COMMIT;
