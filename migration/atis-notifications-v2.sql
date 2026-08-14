-- ========================================================================================
-- SISTEMA ATIS V2 — MIGRATION DE INFRAESTRUTURA (CORRIGIDA V2)
-- ========================================================================================
-- Este script define a infraestrutura centralizada de automação e notificações do ATIS.
-- FOCO: Segurança (RPC), Idempotência (DB Constraints), Claim Atômico (Lease) e Backfill Robusto.
-- ========================================================================================

BEGIN;

-- 0. PREFLIGHT: VALIDAR DEPENDÊNCIAS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'has_role'
    ) THEN
        RAISE EXCEPTION 'ERRO: Função public.has_role(uuid, app_role) não encontrada. Execute a migração de roles primeiro.';
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
    quiet_hours_enabled boolean NOT NULL DEFAULT true,
    quiet_hours_start time NOT NULL DEFAULT '21:00',
    quiet_hours_end time NOT NULL DEFAULT '07:00',
    global_enabled boolean NOT NULL DEFAULT true,
    delay_between_messages_ms integer NOT NULL DEFAULT 5000 CHECK (delay_between_messages_ms >= 0),
    max_messages_per_minute integer NOT NULL DEFAULT 20 CHECK (max_messages_per_minute > 0),
    retry_max integer NOT NULL DEFAULT 3 CHECK (retry_max >= 0),
    retry_interval_minutes integer NOT NULL DEFAULT 15 CHECK (retry_interval_minutes > 0),
    
    -- Campos Adicionais do Antiban Legado
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
    source_key text UNIQUE, -- Chave determinística (ex: 'system:devotional')
    name text NOT NULL,
    notification_type text NOT NULL, -- 'devotional', 'birthday', 'plan-reading', 'series', 'broadcast', 'welcome', 'smart-notif', 'daily-verse'
    enabled boolean NOT NULL DEFAULT true,
    automation_mode text NOT NULL DEFAULT 'automatic' CHECK (automation_mode IN ('automatic', 'manual')),
    send_times time[] NOT NULL DEFAULT '{ "07:00" }',
    timezone text, -- Override (NULL = usa global)
    days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=domingo, 6=sábado
    message_template text,
    use_ai boolean NOT NULL DEFAULT false,
    ai_prompt text,
    retry_enabled boolean NOT NULL DEFAULT true,
    retry_max integer NOT NULL DEFAULT 3 CHECK (retry_max >= 0),
    delay_between_messages_ms integer CHECK (delay_between_messages_ms >= 0), -- NULL = usa global
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
    source_target_id uuid REFERENCES public.atis_notification_targets(id) ON DELETE SET NULL,
    recipient_type text NOT NULL CHECK (recipient_type IN ('individual', 'group')), 
    recipient_key text NOT NULL, -- JID FINAL (@s.whatsapp.net ou @g.us)
    occurrence_key text NOT NULL, -- Identidade da ocorrência (ex: 2026-08-14:07:00)
    idempotency_key text UNIQUE NOT NULL, -- config_id:recipient_key:occurrence_key
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'processing', 'retrying', 'sent', 'failed', 'skipped', 'postponed')),
    scheduled_for timestamptz NOT NULL,
    
    -- Controle de Claim/Worker
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

    -- Proteção de Idempotência Canônica no DB
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

-- 8. FUNÇÃO DE CLAIM ATÔMICO (RPC) - SEGURA
CREATE OR REPLACE FUNCTION public.atis_claim_automation_occurrence(
    _log_id uuid,
    _worker_id text,
    _lease_minutes integer DEFAULT 5
)
RETURNS public.atis_automation_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _result public.atis_automation_logs;
BEGIN
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
          -- Nunca processado ou pronto para retry
          (status IN ('scheduled', 'pending', 'retrying') AND (next_retry_at IS NULL OR next_retry_at <= now()))
          OR
          -- Recuperar processamento abandonado (timeout do lease)
          (status = 'processing' AND claim_expires_at < now())
      )
    RETURNING * INTO _result;

    RETURN _result;
END;
$$;

-- Restringir execução da RPC
REVOKE EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.atis_claim_automation_occurrence(uuid, text, integer) TO service_role;

-- 9. RLS E POLICIES
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['atis_automation_settings', 'atis_notification_configs', 'atis_notification_targets', 'atis_automation_logs', 'atis_automation_attempts']) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Admins can do everything on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admins can do everything on %I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);
    END LOOP;
END $$;

-- Grants explícitos para authenticated (painel admin) e service_role (edge functions)
GRANT ALL ON public.atis_automation_settings TO authenticated, service_role;
GRANT ALL ON public.atis_notification_configs TO authenticated, service_role;
GRANT ALL ON public.atis_notification_targets TO authenticated, service_role;
GRANT ALL ON public.atis_automation_logs TO authenticated, service_role;
GRANT ALL ON public.atis_automation_attempts TO authenticated, service_role;

-- 10. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_atis_logs_processing_queue ON public.atis_automation_logs(status, scheduled_for) WHERE status IN ('scheduled', 'pending', 'retrying', 'processing');
CREATE INDEX IF NOT EXISTS idx_atis_logs_idempotency ON public.atis_automation_logs(idempotency_key);

-- 11. HELPER: PARSE TIME SEGURO
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

-- 12. SEEDS E BACKFILL (IDEMPOTENTE E SEGURO)

-- Seed Global Settings (Antiban)
DO $$
DECLARE
    v_antiban jsonb;
    v_tz text;
BEGIN
    SELECT value INTO v_antiban FROM public.admin_settings WHERE key = 'atis_antiban';
    SELECT timezone INTO v_tz FROM public.atis_config WHERE id = 1;
    
    INSERT INTO public.atis_automation_settings (
        id, timezone, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
        daily_global_cap, daily_recipient_cap, daily_group_cap, hourly_cap,
        min_gap_ms, max_gap_ms, jitter_max_ms
    )
    VALUES (
        1, 
        COALESCE(v_tz, 'America/Fortaleza'),
        COALESCE((v_antiban->>'enabled')::boolean, true),
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
    ON CONFLICT (id) DO NOTHING; -- Preserva configurações V2 se já existirem
END $$;

-- Backfill: Devocional
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
        ON CONFLICT (source_key) DO NOTHING; -- Preserva V2
        
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

-- Seeds de Sistema
INSERT INTO public.atis_notification_configs (source_key, name, notification_type, automation_mode)
VALUES ('system:welcome', 'Mensagem de Boas-vindas', 'welcome', 'automatic')
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO public.atis_notification_configs (source_key, name, notification_type, automation_mode, send_times)
VALUES ('system:smart_notifications', 'Lembretes de Inatividade/Metas', 'smart-notif', 'automatic', '{ "09:00" }')
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO public.atis_notification_configs (source_key, name, notification_type, automation_mode, send_times)
VALUES ('system:daily_verse', 'Versículo do Dia (WhatsApp)', 'daily-verse', 'automatic', '{ "07:00" }')
ON CONFLICT (source_key) DO NOTHING;

-- Nota: Planos (plans), Séries (series) e Broadcasts (broadcasts) possuem tabelas especializadas.
-- O motor V2 será agnóstico e poderá operar sobre essas tabelas ou via configs.
-- Cultos e outros fluxos serão integrados via Smart Notifications ou novas configs na FASE 2.

COMMIT;