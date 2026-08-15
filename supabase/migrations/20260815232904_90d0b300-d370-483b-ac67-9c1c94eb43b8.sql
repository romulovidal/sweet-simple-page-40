
-- 2. Criar função de verificação de hierarquia privada (Security Definer)
CREATE OR REPLACE FUNCTION public.check_user_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_actual_role public.app_role;
BEGIN
    SELECT role INTO _user_actual_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    
    IF _user_actual_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Hierarquia: super_admin > admin > user
    IF _user_actual_role = 'super_admin' THEN
        RETURN TRUE; -- Super admin pode tudo
    END IF;

    IF _role = 'super_admin' THEN
        RETURN _user_actual_role = 'super_admin';
    END IF;

    IF _role = 'admin' THEN
        RETURN _user_actual_role IN ('admin', 'super_admin');
    END IF;

    RETURN TRUE; -- Se chegou aqui e tem role, 'user' é garantido
END;
$$;

-- 3. Redefinir has_role pública (Delegando para a check_user_role segura)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_role(_user_id, _role);
$$;

-- Garantir permissões de execução (restringindo anon conforme solicitado)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_user_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, public.app_role) TO authenticated, service_role;

-- 4. Corrigir RLS da tabela user_roles para evitar recursão
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all_admin_policy" ON public.user_roles;

-- Admins veem tudo, usuários veem a si mesmos.
CREATE POLICY "user_roles_select_policy" ON public.user_roles
FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id) OR 
  public.has_role(auth.uid(), 'admin')
);

-- Apenas Admins (ou Super Admins via has_role) podem gerir roles.
CREATE POLICY "user_roles_all_admin_policy" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Atribuir o proprietário como super_admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('5850679f-697b-4ec2-a47c-47b88a96bffa', 'super_admin')
ON CONFLICT (user_id, role) DO UPDATE SET role = 'super_admin';

-- 6. Garantir que tabelas administrativas tenham GRANT para authenticated
GRANT ALL ON public.admin_posts TO authenticated, service_role;
GRANT ALL ON public.admin_plans TO authenticated, service_role;
GRANT ALL ON public.admin_plan_readings TO authenticated, service_role;
GRANT ALL ON public.admin_settings TO authenticated, service_role;
GRANT ALL ON public.push_log TO authenticated, service_role;
GRANT ALL ON public.atis_config TO authenticated, service_role;
GRANT ALL ON public.atis_automation_settings TO authenticated, service_role;
GRANT ALL ON public.atis_automation_logs TO authenticated, service_role;
GRANT ALL ON public.atis_automation_attempts TO authenticated, service_role;
GRANT ALL ON public.atis_groups TO authenticated, service_role;
GRANT ALL ON public.atis_contacts TO authenticated, service_role;
GRANT ALL ON public.atis_birthdays TO authenticated, service_role;
GRANT ALL ON public.atis_broadcasts TO authenticated, service_role;
GRANT ALL ON public.atis_studies TO authenticated, service_role;
GRANT ALL ON public.atis_messages_log TO authenticated, service_role;
GRANT ALL ON public.culto_schedules TO authenticated, service_role;
GRANT ALL ON public.culto_reminders TO authenticated, service_role;
GRANT ALL ON public.daily_verse_queue TO authenticated, service_role;

-- 7. Consolidar policies para respeitar a nova hierarquia (admin e super_admin)
-- admin_posts
DROP POLICY IF EXISTS "Admins can manage posts" ON public.admin_posts;
DROP POLICY IF EXISTS "admin_posts_manage_policy" ON public.admin_posts;
CREATE POLICY "admin_posts_manage_policy" ON public.admin_posts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_settings
DROP POLICY IF EXISTS "Admins manage settings" ON public.admin_settings;
DROP POLICY IF EXISTS "admin_settings_manage_policy" ON public.admin_settings;
CREATE POLICY "admin_settings_manage_policy" ON public.admin_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- push_log
DROP POLICY IF EXISTS "Admins manage push log" ON public.push_log;
DROP POLICY IF EXISTS "push_log_manage_policy" ON public.push_log;
CREATE POLICY "push_log_manage_policy" ON public.push_log
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
