-- O PostgREST está bloqueado porque tenta resolver a função has_role(uuid, app_role) 
-- que possivelmente tem dependência de tipos no esquema 'private'.
-- Vamos limpar todas as funções has_role e recriar apenas UMA assinatura limpa.

-- 1. Dropar funções que podem causar conflito (se possível)
-- Tentar dropar a versão TEXT que criamos e que não resolveu o problema do REST.
DROP FUNCTION IF EXISTS public.has_role(uuid, text);

-- 2. Redefinir a função pública original (app_role) para ser 100% autossuficiente
-- e não tocar em nada fora do public.
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

-- 3. Garantir GRANTS
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;

-- 4. Dropar qualquer versão no private que possa estar sendo chamada por engano
-- (O PostgREST não deve ver o private por padrão, mas se houver visibilidade, causa erro)
DO $$
BEGIN
    DROP FUNCTION IF EXISTS private.has_role(uuid, app_role);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível dropar private.has_role: %', SQLERRM;
END $$;
