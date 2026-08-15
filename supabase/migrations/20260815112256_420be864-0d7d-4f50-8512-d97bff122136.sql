
-- Final attempt at fixing the admin RPC by resolving type conflicts and schema visibility
DO $$
BEGIN
    -- Grant usage on schemas
    GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator;
    
    -- We assume the user_roles table exists and 'role' column is app_role type
    -- Fix the function to use explicit casting to handle both text and enum
    CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $inner$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role::text = _role
      );
    END;
    $inner$;

    -- Overload to accept the enum directly if it exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
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
        
        GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
    END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, service_role;

-- Ensure table grants are solid
GRANT SELECT ON public.user_roles TO authenticated, anon;
GRANT ALL ON public.user_roles TO service_role;

-- Ensure the authenticator can see the public schema and its objects
ALTER ROLE authenticator SET search_path TO public;
