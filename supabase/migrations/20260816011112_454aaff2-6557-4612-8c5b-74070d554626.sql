
-- Remover a versão duplicada da função check_user_role que usa o tipo enum app_role
-- para garantir que a versão que aceita TEXT seja a única e padrão, evitando ambiguidades.
DROP FUNCTION IF EXISTS public.check_user_role(_user_id uuid, _role app_role);

-- Recriar a função principal garantindo que o search_path esteja travado no public para segurança.
CREATE OR REPLACE FUNCTION public.check_user_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role text;
BEGIN
    -- Obter o papel do usuário (convertendo enum para text se necessário)
    SELECT role::text INTO user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    
    IF user_role IS NULL THEN
        RETURN false;
    END IF;

    -- Lógica de hierarquia ministerial
    IF _role = 'user' THEN
        RETURN true;
    ELSIF _role = 'admin' THEN
        RETURN user_role IN ('admin', 'super_admin');
    ELSIF _role = 'super_admin' THEN
        RETURN user_role = 'super_admin';
    ELSE
        RETURN false;
    END IF;
END;
$$;

-- Garantir privilégios
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, text) TO authenticated, service_role, anon;

-- Política RLS para garantir que o service_role possa ler a tabela de papéis
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service Role can read all user roles" ON public.user_roles;
    CREATE POLICY "Service Role can read all user roles" ON public.user_roles 
    FOR SELECT TO service_role USING (true);
END $$;
