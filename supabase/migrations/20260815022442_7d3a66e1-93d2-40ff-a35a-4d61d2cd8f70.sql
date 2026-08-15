-- 1. Redefinir a função has_role(uuid, app_role) para ser 100% autossuficiente
-- e usar explicitamente o esquema public para tudo, garantindo que o search_path
-- ignore o private.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

-- 2. Conceder permissão de uso ao tipo app_role
GRANT USAGE ON TYPE public.app_role TO authenticated, anon;

-- 3. Revogar qualquer acesso residual ao private
REVOKE USAGE ON SCHEMA private FROM authenticated, anon, public;

-- 4. Garantir que a função pública seja a única acessível
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
