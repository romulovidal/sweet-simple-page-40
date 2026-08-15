-- 1. Redefinir a função pública para aceitar TEXT em vez de app_role
-- Isso evita que o PostgREST precise resolver o tipo enum em um esquema possivelmente restrito.
-- A função continua SECURITY DEFINER e acessa a tabela user_roles (que usa o enum internamente).
-- O cast manual para ::app_role na query garante a compatibilidade com a tabela.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role::public.app_role
  );
$function$;

-- 2. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon;

-- 3. Garantir visibilidade do esquema public
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
