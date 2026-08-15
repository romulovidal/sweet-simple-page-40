-- Estabilização Final: Grants e Hierarquia Super Admin
-- Data: 2026-08-15

-- 1. Garantir que o enum app_role tenha 'super_admin'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'super_admin');
    ELSE
        BEGIN
            ALTER TYPE public.app_role ADD VALUE 'super_admin';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- 2. Garantir privilégios básicos no schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 3. Grants em tabelas críticas do ATIS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_config TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_notification_configs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_notification_targets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_automation_settings TO authenticated, service_role;
GRANT SELECT ON public.atis_notification_logs TO authenticated;
GRANT ALL ON public.atis_notification_logs TO service_role;

-- 4. Grants em tabelas Administrativas Gerais
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_posts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_plan_readings TO authenticated, service_role;

-- 5. Grants na tabela de papéis
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 6. Recriar has_role com suporte a hierarquia
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    user_highest_role text;
BEGIN
    SELECT role::text INTO user_highest_role
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY 
        CASE 
            WHEN role::text = 'super_admin' THEN 1
            WHEN role::text = 'admin' THEN 2
            WHEN role::text = 'user' THEN 3
            ELSE 4
        END
    LIMIT 1;

    IF user_highest_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    IF _role = 'admin' AND user_highest_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    IF _role = 'user' AND user_highest_role IN ('admin', 'user') THEN
        RETURN TRUE;
    END IF;

    RETURN user_highest_role = _role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role;

-- 7. Garantir que o proprietário seja super_admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('5850679f-697b-4ec2-a47c-47b88a96bffa', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. RLS Policies Fix for writing
ALTER TABLE public.atis_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage atis_config" ON public.atis_config;
CREATE POLICY "Admins can manage atis_config" ON public.atis_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.atis_notification_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage atis_notification_configs" ON public.atis_notification_configs;
CREATE POLICY "Admins can manage atis_notification_configs" ON public.atis_notification_configs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.admin_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage posts" ON public.admin_posts;
CREATE POLICY "Admins can manage posts" ON public.admin_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
