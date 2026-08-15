
-- Ensure has_role is robust and accessible in public schema
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  );
END;
$$;

-- Grant execution to all users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO service_role;

-- Overload for app_role type
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, auth
        AS $inner$
        BEGIN
          RETURN EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = _user_id
              AND role = _role
          );
        END;
        $inner$;
        
        GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
        GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
    END IF;
END $$;

-- Ensure grants on user_roles table
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Grant usage on public schema to all roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Ensure RLS is active and allows the function to read it (SECURITY DEFINER handles this)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- If there was a recursive policy, let's fix it by allowing users to see their own role
-- and service_role to see all
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access" ON public.user_roles;
CREATE POLICY "Service role full access" ON public.user_roles
TO service_role USING (true);
