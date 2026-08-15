-- Auditar e corrigir permissões para has_role
-- A função existe em public e chama a versão em private.
-- Precisamos garantir que 'authenticated' possa executar public.has_role 
-- e que a função em public (que é SECURITY DEFINER) tenha acesso ao esquema private.

-- 1. Garantir uso do esquema private para o proprietário da função
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- 2. Garantir execução da função pública
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 3. Garantir execução da função privada (usada internamente)
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;

-- 4. Garantir acesso à tabela user_roles no esquema public
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
