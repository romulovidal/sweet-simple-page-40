-- 1. Garantir que o enum app_role está no esquema public
-- Se ele estiver no private, o PostgREST não consegue fazer o bind do argumento da RPC.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'app_role' AND n.nspname = 'private') THEN
        -- Se o tipo existir apenas no private, precisamos garantir uso do esquema.
        -- Mas idealmente tipos usados em RPC devem estar no public.
        GRANT USAGE ON SCHEMA private TO authenticated;
        GRANT USAGE ON SCHEMA private TO anon;
    END IF;
END $$;

-- 2. Garantir permissões de uso no esquema public para o PostgREST
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 3. Redefinir a função pública garantindo que ela use apenas o esquema public
-- e tenha o search_path explicitamente configurado.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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

-- 4. Conceder permissões de execução explícitas
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;

-- 5. Se o enum estiver em outro esquema, o PostgREST pode falhar no bind.
-- Vamos verificar onde o enum está e garantir USAGE.
GRANT USAGE ON TYPE public.app_role TO authenticated;
GRANT USAGE ON TYPE public.app_role TO anon;
