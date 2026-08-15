GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, public.app_role) TO service_role;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Garantir que a tabela user_roles seja legível pelo Security Definer e pela API se necessário
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO service_role;

-- Adicionar política RLS para que o próprio usuário possa ver seu role (evita erro 406/401 no PostgREST se a RPC falhar por RLS)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_roles' AND policyname = 'Users can view own role'
    ) THEN
        CREATE POLICY "Users can view own role" ON public.user_roles
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;
