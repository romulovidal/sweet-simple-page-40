-- Fase 1: Segurança Base e Acesso à API PostgREST
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Grants para a tabela de roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Grants para funções de segurança
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated, service_role;

-- Fase 2: Restauração Global de Grants em tabelas públicas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('GRANT ALL ON public.%I TO authenticated, service_role', r.tablename);
    END LOOP;
END $$;

-- Fase 3: Acesso Público (Anon) para tabelas de conteúdo
GRANT SELECT ON public.admin_posts TO anon;
GRANT SELECT ON public.admin_plans TO anon;
GRANT SELECT ON public.admin_plan_readings TO anon;
GRANT SELECT ON public.culto_schedules TO anon;
GRANT SELECT ON public.badges TO anon;
GRANT SELECT ON public.admin_settings TO anon;
