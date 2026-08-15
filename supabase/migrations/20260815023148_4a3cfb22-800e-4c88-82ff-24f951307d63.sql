-- 1. Verificar se o PostgREST está configurado para expor o esquema private
-- Em muitos setups Supabase, o PostgREST tenta ler configurações de esquemas permitidos.
-- Se ele vir 'private' na lista de esquemas expostos, ele tentará introspectá-lo.
-- Como não podemos mudar as configurações do servidor diretamente, garantimos que o authenticator
-- tenha o mínimo de USAGE para não falhar na introspecção.

GRANT USAGE ON SCHEMA private TO authenticator, authenticated, anon;
GRANT USAGE ON SCHEMA public TO authenticator, authenticated, anon;

-- 2. Refatorar a função has_role para usar apenas tipos primitivos e busca direta.
-- O erro 401 no PostgREST muitas vezes é um erro de "introspecção" (falha ao ler metadados da função).
-- Se a função usa tipos de um esquema protegido (como app_role se estivesse no private), ela falha.
-- Já confirmamos que app_role está no public, mas vamos forçar a função a ser o mais simples possível.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role::text = _role
  );
$$;

-- 3. Garantir que o search_path da função é absoluto.
ALTER FUNCTION public.has_role(uuid, text) SET search_path = public;

-- 4. Conceder execução explicitamente.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, authenticator;

-- 5. Se o usuário usa o hook useIsAdmin, ele provavelmente passa 'admin' como string.
-- Vamos garantir que a tabela user_roles seja legível pelo papel que executa a função (embora seja SECURITY DEFINER).
GRANT SELECT ON public.user_roles TO authenticated, service_role, authenticator;
