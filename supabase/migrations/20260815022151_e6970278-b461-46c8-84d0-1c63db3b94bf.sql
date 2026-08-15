-- 1. Precisamos remover a versão antiga que usa enum se quisermos usar a versão text sem ambiguidade.
-- Como existem dependências (políticas RLS), vamos tentar apenas revogar a execução da versão antiga
-- para ver se o PostgREST para de tentar usá-la.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, public;

-- 2. Garantir que a versão TEXT seja a única acessível para authenticated/anon
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon;

-- 3. Garantir search_path e SECURITY DEFINER na versão TEXT
ALTER FUNCTION public.has_role(uuid, text) SECURITY DEFINER;
ALTER FUNCTION public.has_role(uuid, text) SET search_path = public;

-- 4. Vamos ver se o PostgREST está configurado para expor o private (isso seria incomum)
-- mas se estiver, precisamos revogar lá também.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'has_role' AND n.nspname = 'private') THEN
        REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM authenticated, anon, public;
    END IF;
END $$;
