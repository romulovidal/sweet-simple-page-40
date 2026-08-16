
-- Definir políticas para as tabelas de push para garantir que admins possam gerenciar tudo
-- e as Edge Functions com service_role também tenham acesso total.

-- 1. admin_settings
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_settings_manage_policy" ON public.admin_settings;
CREATE POLICY "admin_settings_manage_policy" ON public.admin_settings
    FOR ALL TO authenticated
    USING (public.check_user_role(auth.uid(), 'admin'))
    WITH CHECK (public.check_user_role(auth.uid(), 'admin'));

-- 2. push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_admin_manage" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_admin_manage" ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (public.check_user_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. push_log
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view and create logs" ON public.push_log;
CREATE POLICY "Admins can view and create logs" ON public.push_log
    FOR ALL TO authenticated
    USING (public.check_user_role(auth.uid(), 'admin'));

-- 4. daily_verse_queue
ALTER TABLE public.daily_verse_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage daily verse queue" ON public.daily_verse_queue;
CREATE POLICY "Admins can manage daily verse queue" ON public.daily_verse_queue
    FOR ALL TO authenticated
    USING (public.check_user_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can read the queue" ON public.daily_verse_queue;
CREATE POLICY "Anyone can read the queue" ON public.daily_verse_queue
    FOR SELECT TO authenticated, anon
    USING (true);

-- 5. culto_schedules
ALTER TABLE public.culto_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage culto schedules" ON public.culto_schedules;
CREATE POLICY "Admins can manage culto schedules" ON public.culto_schedules
    FOR ALL TO authenticated
    USING (public.check_user_role(auth.uid(), 'admin'));

-- 6. culto_reminders
ALTER TABLE public.culto_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage culto reminders" ON public.culto_reminders;
CREATE POLICY "Admins can manage culto reminders" ON public.culto_reminders
    FOR ALL TO authenticated
    USING (public.check_user_role(auth.uid(), 'admin'));

-- Re-garantir privilégios (GRANTs)
GRANT ALL ON TABLE public.user_roles TO authenticated, service_role;
GRANT ALL ON TABLE public.admin_settings TO authenticated, service_role;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated, service_role;
GRANT ALL ON TABLE public.push_log TO authenticated, service_role;
GRANT ALL ON TABLE public.daily_verse_queue TO authenticated, service_role;
GRANT ALL ON TABLE public.culto_schedules TO authenticated, service_role;
GRANT ALL ON TABLE public.culto_reminders TO authenticated, service_role;

GRANT SELECT ON TABLE public.daily_verse_queue TO anon;
GRANT SELECT ON TABLE public.culto_schedules TO anon;
GRANT SELECT ON TABLE public.culto_reminders TO anon;
GRANT SELECT ON TABLE public.admin_settings TO anon;

-- Corrigindo GRANTs para service_role (permissão total em tudo)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
