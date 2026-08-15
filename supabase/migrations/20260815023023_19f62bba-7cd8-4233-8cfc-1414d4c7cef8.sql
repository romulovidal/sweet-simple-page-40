-- 1. Tentar forçar a função a ser agnóstica ao tipo do enum internamente
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

-- 2. Conceder permissões explícitas para a role authenticator em TUDO no public
GRANT USAGE ON SCHEMA public TO authenticator, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticator, anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticator, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticator, anon, authenticated;

-- 3. Garantir que o authenticator pode ver o tipo app_role (reforçado)
GRANT USAGE ON TYPE public.app_role TO authenticator, anon, authenticated;

-- 4. Criar uma sobrecarga que aceita texto, caso o client Supabase envie como string
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

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, service_role;
