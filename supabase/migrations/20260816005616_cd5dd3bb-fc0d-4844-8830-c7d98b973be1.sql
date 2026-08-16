
GRANT ALL ON public.push_log TO authenticated, service_role;
GRANT ALL ON public.push_subscriptions TO authenticated, service_role;
GRANT SELECT ON public.user_roles TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, app_role) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role, anon;

-- Policy creation using individual statements to avoid DO block syntax issues
DROP POLICY IF EXISTS "Service Role ALL" ON public.push_subscriptions;
CREATE POLICY "Service Role ALL" ON public.push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role ALL" ON public.push_log;
CREATE POLICY "Service Role ALL" ON public.push_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role ALL" ON public.user_roles;
CREATE POLICY "Service Role ALL" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
