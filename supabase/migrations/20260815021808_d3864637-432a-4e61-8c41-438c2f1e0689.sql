-- 1. Redefinir a função pública para buscar diretamente na tabela, sem chamar o private
-- Usamos CREATE OR REPLACE FUNCTION e mantemos a assinatura exata para não quebrar dependências.
-- O search_path deve incluir public.
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

-- 2. Conceder permissões de execução
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;

-- 3. Garantir que a tabela user_roles tem as permissões corretas
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
