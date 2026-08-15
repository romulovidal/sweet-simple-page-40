-- Se o PostgREST continua dando 401, vamos tentar revogar explicitamente 
-- o USAGE no private e garantir que a função pública seja 100% isolada.

-- 1. Revogar USAGE e SELECT no private para authenticated/anon
REVOKE USAGE ON SCHEMA private FROM authenticated, anon, public;
REVOKE SELECT ON ALL TABLES IN SCHEMA private FROM authenticated, anon, public;

-- 2. Garantir que a função pública não dependa de nada fora do public
-- e use explicitamente o search_path = public.
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

-- 3. Dar permissão de execução na função
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
