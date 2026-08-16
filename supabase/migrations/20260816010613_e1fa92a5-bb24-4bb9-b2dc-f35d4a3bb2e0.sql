
-- Create the missing check_user_role function with hierarchy
CREATE OR REPLACE FUNCTION public.check_user_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role app_role;
BEGIN
    -- Get the user's role
    SELECT role INTO user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    
    IF user_role IS NULL THEN
        RETURN false;
    END IF;

    -- Hierarchy logic
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

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, text) TO authenticated, service_role, anon;

-- Ensure necessary grants on administrative tables
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.push_log TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.atis_messages_log TO service_role;
GRANT ALL ON public.atis_groups TO service_role;
GRANT SELECT ON public.user_roles TO authenticated, service_role;

-- Ensure RLS allows service_role to bypass for management
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_subscriptions' AND policyname = 'Service Role ALL'
    ) THEN
        CREATE POLICY "Service Role ALL" ON public.push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_log' AND policyname = 'Service Role ALL'
    ) THEN
        CREATE POLICY "Service Role ALL" ON public.push_log FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
