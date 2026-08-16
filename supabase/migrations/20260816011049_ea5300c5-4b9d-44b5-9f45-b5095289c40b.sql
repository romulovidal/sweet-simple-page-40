
-- 1. Verificar privilégios de execução na RPC para todos os papéis
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, text) TO authenticated, service_role, anon;

-- 2. Garantir que user_roles tenha uma política RLS que permita ao service_role ler tudo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_roles' AND policyname = 'Service Role can read all user roles'
    ) THEN
        CREATE POLICY "Service Role can read all user roles" ON public.user_roles 
        FOR SELECT TO service_role USING (true);
    END IF;
END $$;

-- 3. Garantir que push_log e push_subscriptions tenham GRANT ALL para service_role
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.push_log TO service_role;

-- 4. Criar política RLS para push_log se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_log' AND policyname = 'Service Role can manage push logs'
    ) THEN
        CREATE POLICY "Service Role can manage push logs" ON public.push_log 
        FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. Criar política RLS para push_subscriptions se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_subscriptions' AND policyname = 'Service Role can manage subscriptions'
    ) THEN
        CREATE POLICY "Service Role can manage subscriptions" ON public.push_subscriptions 
        FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
