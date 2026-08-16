
GRANT ALL ON public.user_roles TO authenticated, service_role;
GRANT ALL ON public.admin_settings TO authenticated, service_role;
GRANT ALL ON public.push_subscriptions TO authenticated, service_role;
GRANT ALL ON public.push_log TO authenticated, service_role;
GRANT ALL ON public.daily_verse_queue TO authenticated, service_role;

GRANT SELECT ON public.admin_settings TO anon;
GRANT SELECT ON public.daily_verse_queue TO anon;
GRANT SELECT ON public.push_subscriptions TO anon;

CREATE OR REPLACE FUNCTION public.check_user_role(_user_id uuid, _role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    user_role_val text;
BEGIN
    SELECT role::text INTO user_role_val FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    
    IF user_role_val IS NULL THEN
        RETURN false;
    END IF;

    IF _role = 'user' THEN
        RETURN true;
    ELSIF _role = 'admin' THEN
        RETURN user_role_val IN ('admin', 'super_admin');
    ELSIF _role = 'super_admin' THEN
        RETURN user_role_val = 'super_admin';
    ELSE
        RETURN false;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, text) TO authenticated, anon, service_role;
