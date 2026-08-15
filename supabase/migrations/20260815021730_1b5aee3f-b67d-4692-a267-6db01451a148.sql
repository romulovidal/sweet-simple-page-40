-- 1. Garantir que a função pública existente seja SECURITY DEFINER e tenha search_path seguro
-- (Se já for, apenas reafirmamos; se não for, o ALTER muda as propriedades sem dropar)
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY DEFINER;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;

-- 2. Conceder permissões de execução explícitas (necessário no PostgREST)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;

-- 3. Conceder permissões no esquema e no tipo para o papel authenticated
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 4. Garantir que o enum app_role seja visível (já deve estar no public, mas garantimos usage)
-- Nota: se app_role não estiver no public, precisaremos ajustar. 
-- Mas o erro 'permission denied for schema private' sugere que a função estava tentando acessar algo no private.

-- 5. Se houver um wrapper no private que está sendo chamado, damos grant nele também
-- (Assumindo que ele ainda existe e é usado por dependências internas)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'has_role' AND n.nspname = 'private') THEN
        GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
    END IF;
END $$;
