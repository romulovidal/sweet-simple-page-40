-- 1. Resetar search_path do authenticator para o padrão do Supabase
ALTER ROLE authenticator RESET search_path;

-- 2. Recriar a função has_role de forma ultra-segura, sem referenciar enums no corpo
-- e garantindo que o plano de consulta não dependa de metadados externos.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  );
END;
$$;

-- 3. Garantir que a versão original (se usada pelo backend/RLS) também esteja segura
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;

-- 4. Garantir que o esquema public está acessível para introspecção do PostgREST
GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator;
GRANT SELECT ON public.user_roles TO anon, authenticated, authenticator;
GRANT USAGE ON TYPE public.app_role TO anon, authenticated, authenticator;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, authenticator;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, authenticator;

-- 5. Remover qualquer privilégio residual no esquema private que possa estar causando ruído
REVOKE ALL ON SCHEMA private FROM authenticated, anon, authenticator;
