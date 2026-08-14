-- ========================================================================================
-- SISTEMA ATIS V2 — MIGRATION DE INFRAESTRUTURA (CORRIGIDA V4 - FINAL)
-- ========================================================================================
-- FOCO: Segurança, Idempotência, Claim Atômico e Preservação de Histórico (RESTRICT).
-- ========================================================================================

BEGIN;

-- 0. PREFLIGHT: VALIDAR ASSINATURA EXATA DE HAS_ROLE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
          AND p.proname = 'has_role'
          AND oidvectortypes(p.proargtypes) = 'uuid, app_role'
    ) THEN
        RAISE EXCEPTION 'ERRO: Função public.has_role(uuid, public.app_role) não encontrada.';
    END IF;
END $$;

-- 1. FUNÇÃO DE UPDATED_AT ESPECÍFICA
CREATE OR REPLACE FUNCTION public.atis_v2_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CONFIGURAÇÕES GLOBAIS (SINGLETON)
CREATE TABLE IF NOT EXISTS public.atis_automation_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    timezone text NOT NULL DEFAULT 'America/Fortaleza',
    global_enabled boolean NOT NULL DEFAULT true,
    quiet_hours_enabled boolean NOT NULL DEFAULT true,
    quiet_hours_start time NOT NULL DEFAULT '21:00',
    quiet_hours_end time NOT NULL DEFAULT '07:00',
    delay_between_messages_ms integer NOT NULL DEFAULT 5000 CHECK (delay_between_messages_ms >= 0),
    max_messages_per_minute integer NOT NULL DEFAULT 20 CHECK (max_messages_per_minute > 0),
    retry_max integer NOT NULL DEFAULT 3 CHECK (retry_max >= 0),
    retry_interval_minutes integer NOT NULL DEFAULT 15 CHECK (retry_interval_minutes > 0),
    
    daily_global_cap integer DEFAULT 120 CHECK (daily_global_cap >= 0),
    daily_recipient_cap integer DEFAULT 2 CHECK (daily_recipient_cap >= 0),
    daily_group_cap integer DEFAULT 3 CHECK (daily_group_cap >= 0),
    hourly_cap integer DEFAULT 20 CHECK (hourly_cap >= 0),
    min_gap_ms integer DEFAULT 25000 CHECK (min_gap_ms >= 0),
    max_gap_ms integer DEFAULT 95000 CHECK (max_gap_ms >= 0),
    jitter_max_ms integer DEFAULT 9000 CHECK (jitter_max_ms >= 0),
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. CONFIGURAÇÕES DE AUTOMAÇÃO (V2)
CREATE TABLE IF NOT EXISTS public.atis_notification_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key text UNIQUE, 
    name text NOT NULL,
    notification_type text NOT NULL, 
    enabled boolean NOT NULL DEFAULT true,
    automation_mode text NOT NULL DEFAULT 'automatic' CHECK (automation_mode IN ('automatic', 'manual')),
    send_times time[] NOT NULL DEFAULT '{ "07:00" }',
    timezone text, 
    days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
    message_template text,
    use_ai boolean NOT NULL DEFAULT false,
    ai_prompt text,
    retry_enabled boolean NOT NULL DEFAULT true,
    retry_max integer NOT NULL DEFAULT 3 CHECK (retry_max >= 0),
    delay_between_messages_ms integer CHECK (delay_between_messages_ms >= 0),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint para dias da semana (Restaura 0=domingo...6=sábado)
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
    target_id text NOT NULL, 
    target_type text NOT NULL CHECK (target_type IN ('profile', 'contact', 'group', 'tag', 'jid_individual', 'all_authenticated')),
    active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(config_id, target_type, target_id)
);

-- 5. MOTOR DE IDEMPOTÊNCIA E LOGS (ON DELETE RESTRICT para preservar histórico)
CREATE TABLE IF NOT EXISTS public.atis_automation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id uuid NOT NULL REFERENCES public.atis_notification_configs(id) ON DELETE RESTRICT,
    source_target_id uuid REFERENCES public.atis_notification_targets(id) ON DELETE SET NULL,
    recipient_type text NOT NULL CHECK (recipient_type IN ('individual', 'group')), 
    recipient_key text NOT NULL, 
    occurrence_key text NOT NULL, 
    idempotency_key text UNIQUE NOT NULL, 
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'processing', 'retrying', 'sent', 'failed', 'skipped', 'postponed')),
    scheduled_for timestamptz NOT NULL,
    
    worker_id text,
    claimed_at timestamptz,
    claim_expires_at timestamptz,

    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_attempt_at timestamptz,
    next_retry_at timestamptz,
    last_error text,
    processed_at timestamptz,
    message_sent_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_atis_logs_canonical UNIQUE(config_id, recipient_key, occurrence_key)
);

-- 6. TENTATIVAS DETALHADAS
CREATE TABLE IF NOT EXISTS public.atis_automation_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id uuid NOT NULL REFERENCES public.atis_automation_logs(id) ON DELETE CASCADE,
    attempt_number integer NOT NULL CHECK (attempt_number > 0),
    status text NOT NULL CHECK (status IN ('success', 'error', 'retrying', 'skipped')),
    error_message text,
    response_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(log_id, attempt_number)
);

-- 7. TRIGGERS DE UPDATED_AT
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_atis_settings_updated_at') THEN
        CREATE TRIGGER tr_atis_settings_updated_at BEFORE UPDATE ON public.atis_automation_settings FOR EACH ROW EXECUTE FUNCTION public.atis_v2_set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_atis_configs_updated_at') THEN
        CREATE TRIGGER tr_atis_configs_updated_at BEFORE UPDATE ON public.atis_notification_configs FOR EACH ROW EXECUTE FUNCTION public.atis_v2_set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_atis_logs_updated_at') THEN
        CREATE TRIGGER tr_atis_logs_updated_at BEFORE UPDATE ON public.atis_automation_logs FOR EACH ROW EXECUTE FUNCTION public.atis_v2_set_updated_at();
    END IF;
END $$;

-- 8. FUNÇÃO DE CLAIM ATÔMICO (RPC)
CREATE OR REPLACE FUNCTION public.atis_claim_automation_occurrence(
    _log_id uuid,
    _worker_id text,
    _lease_minutes integer DEFAULT 5
)
RETURNS public.atis_automation_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _result public.atis_automation_logs;
BEGIN
    IF _worker_id IS NULL OR _worker_id = '' THEN
        RAISE EXCEPTION '_worker_id cannot be null or empty';
    END IF;
    IF _lease_minutes IS NULL OR _lease_minutes <= 0 THEN
        RAISE EXCEPTION '_lease_minutes must be positive';
    END IF;
    IF _lease_minutes > 60 THEN
        RAISE EXCEPTION '_lease_minutes cannot exceed 60 minutes';
    END IF;

    UPDATE public.atis_automation_logs
    SET 
        status = 'processing',
        worker_id = _worker_id,
        claimed_at = now(),
        claim_expires_at = now() + (interval '1 minute' * _lease_minutes),
        last_attempt_at = now(),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id = _log_id
      AND scheduled_for <= now()
      AND (
          (status IN ('scheduled', 'pending', 'retrying') AND (next_retry_at IS NULL OR next_retry_at <= now()))
          OR
          (status = 'processing' AND (claim_expires_at IS NULL OR claim_expires_at < now()))
      )
    RETURNING * INTO _result;

    RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) TO service_role;

-- 9. RLS E POLICIES
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['atis_automation_settings', 'atis_notification_configs', 'atis_notification_targets']) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Admins can do everything on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admins can do everything on %I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);
    END LOOP;

    FOR t IN SELECT unnest(ARRAY['atis_automation_logs', 'atis_automation_attempts']) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Admins can select logs on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admins can select logs on %I" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);
    END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_automation_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_notification_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_notification_targets TO authenticated;
GRANT SELECT ON public.atis_automation_logs TO authenticated;
GRANT SELECT ON public.atis_automation_attempts TO authenticated;
GRANT ALL ON public.atis_automation_settings TO service_role;
GRANT ALL ON public.atis_notification_configs TO service_role;
GRANT ALL ON public.atis_notification_targets TO service_role;
GRANT ALL ON public.atis_automation_logs TO service_role;
GRANT ALL ON public.atis_automation_attempts TO service_role;

-- 10. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_atis_logs_processing_queue ON public.atis_automation_logs(status, scheduled_for) WHERE status IN ('scheduled', 'pending', 'retrying', 'processing');

-- 11. HELPER: PARSE TIME
CREATE OR REPLACE FUNCTION public.atis_v2_parse_time(v text, fallback time) 
RETURNS time AS $$
BEGIN
    RETURN (
        CASE 
            WHEN v IS NULL OR v = '' THEN fallback
            WHEN v ~ '^\d{1,2}$' THEN (v || ':00:00')::time
            WHEN v ~ '^\d{1,2}:\d{2}$' THEN (v || ':00')::time
            WHEN v ~ '^\d{1,2}:\d{2}:\d{2}$' THEN v::time
            ELSE fallback
        END
    );
EXCEPTION WHEN OTHERS THEN
    RETURN fallback;
END;
$$ LANGUAGE plpgsql;

-- 12. SEEDS E BACKFILL

-- Global Settings
DO $$
DECLARE
    v_antiban jsonb;
    v_tz text;
BEGIN
    SELECT value INTO v_antiban FROM public.admin_settings WHERE key = 'atis_antiban';
    SELECT timezone INTO v_tz FROM public.atis_config WHERE id = 1;
    
    INSERT INTO public.atis_automation_settings (
        id, timezone, global_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
        daily_global_cap, daily_recipient_cap, daily_group_cap, hourly_cap,
        min_gap_ms, max_gap_ms, jitter_max_ms
    )
    VALUES (
        1, 
        COALESCE(v_tz, 'America/Fortaleza'),
        COALESCE((v_antiban->>'enabled')::boolean, true),
        true,
        public.atis_v2_parse_time(v_antiban->>'quiet_start', '21:00'),
        public.atis_v2_parse_time(v_antiban->>'quiet_end', '07:00'),
        COALESCE((v_antiban->>'daily_global_cap')::int, 120),
        COALESCE((v_antiban->>'daily_recipient_cap')::int, 2),
        COALESCE((v_antiban->>'daily_group_cap')::int, 3),
        COALESCE((v_antiban->>'hourly_cap')::int, 20),
        COALESCE((v_antiban->>'min_gap_ms')::int, 25000),
        COALESCE((v_antiban->>'max_gap_ms')::int, 95000),
        COALESCE((v_antiban->>'jitter_max_ms')::int, 9000)
    )
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Seeds de Sistema com horários preservados/manuais
INSERT INTO public.atis_notification_configs (source_key, name, notification_type, automation_mode, send_times)
VALUES 
    ('system:welcome', 'Mensagem de Boas-vindas', 'welcome', 'automatic', '{ "00:00" }'), -- Ignorado pela lógica reativa
    ('system:smart_notifications', 'Lembretes de Inatividade/Metas', 'smart-notif', 'automatic', '{ "09:00" }'),
    ('system:daily_verse', 'Versículo do Dia (WhatsApp)', 'daily-verse', 'automatic', '{ "07:00" }'),
    ('system:plans', 'Orquestração de Planos de Leitura', 'plan-reading', 'automatic', '{ "05:00" }'), -- Horário base de processamento
    ('system:series', 'Orquestração de Séries Temáticas', 'series', 'automatic', '{ "06:00" }'),
    ('system:broadcasts', 'Envios de Transmissão', 'broadcast', 'manual', '{ "00:00" }'), -- Ignorado (Disparo manual)
    ('system:culto', 'Lembretes de Culto/Eventos', 'culto', 'automatic', '{ "18:00" }')
ON CONFLICT (source_key) DO NOTHING;

-- Backfills preservando horários configurados
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
            ARRAY[public.atis_v2_parse_time(v_val->>'time', '06:30')]
        )
        ON CONFLICT (source_key) DO NOTHING;
        
        SELECT id INTO v_config_id FROM public.atis_notification_configs WHERE source_key = 'legacy:atis_daily_devotional';
        IF v_config_id IS NOT NULL AND v_val->'group_ids' IS NOT NULL THEN
            FOR v_group_id IN SELECT jsonb_array_elements_text(v_val->'group_ids') LOOP
                INSERT INTO public.atis_notification_targets (config_id, target_id, target_type)
                VALUES (v_config_id, v_group_id, 'group')
                ON CONFLICT (config_id, target_type, target_id) DO NOTHING;
            END LOOP;
        END IF;
    END IF;
END $$;

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
            ARRAY[public.atis_v2_parse_time(v_val->>'time', '08:00')],
            v_val->>'template',
            COALESCE((v_val->>'use_ai')::boolean, true)
        )
        ON CONFLICT (source_key) DO NOTHING;
        
        SELECT id INTO v_config_id FROM public.atis_notification_configs WHERE source_key = 'legacy:atis_birthday_greeting';
        IF v_config_id IS NOT NULL AND v_val->'group_ids' IS NOT NULL THEN
            FOR v_group_id IN SELECT jsonb_array_elements_text(v_val->'group_ids') LOOP
                INSERT INTO public.atis_notification_targets (config_id, target_id, target_type)
                VALUES (v_config_id, v_group_id, 'group')
                ON CONFLICT (config_id, target_type, target_id) DO NOTHING;
            END LOOP;
        END IF;
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.atis_v2_parse_time(text, time);

COMMIT;