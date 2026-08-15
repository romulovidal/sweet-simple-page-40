-- 1. Forçar search_path na função existente para evitar que o PostgREST tente buscar em outros lugares
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;

-- 2. Garantir que o authenticator tenha USAGE no esquema public
GRANT USAGE ON SCHEMA public TO authenticator, anon, authenticated;

-- 3. Garantir que o authenticator possa ler o tipo app_role
GRANT USAGE ON TYPE public.app_role TO authenticator, anon, authenticated;

-- 4. Garantir SELECT na tabela user_roles para o authenticator
-- (A função é security definer, mas o PostgREST pode precisar disso para introspecção)
GRANT SELECT ON public.user_roles TO authenticator, anon, authenticated;

-- 5. Revogar e reconceder execução para limpar estados de privilégios corrompidos
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
