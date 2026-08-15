-- 1. Dropar a função has_role do esquema private
-- Se ela existir e o PostgREST estiver tentando ser esperto demais, isso remove a ambiguidade.
DO $$
BEGIN
    DROP FUNCTION IF EXISTS private.has_role(uuid, public.app_role);
    DROP FUNCTION IF EXISTS private.has_role(uuid, text);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível dropar no private: %', SQLERRM;
END $$;

-- 2. Garantir que a função pública NÃO referencia nada no private
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  );
END;
$function$;

-- 3. Ver se existem outros objetos no public chamados has_role
SELECT 
    proname, 
    pronamespace::regnamespace, 
    proargtypes::regtype[] 
FROM pg_proc 
WHERE proname = 'has_role';
