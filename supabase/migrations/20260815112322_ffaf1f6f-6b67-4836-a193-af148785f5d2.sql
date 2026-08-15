
-- The auditor check showed authenticator lacks USAGE on auth schema
-- and sometimes 42501 on 'private' happens when objects are in there but USAGE is missing or revoked.

GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT USAGE ON SCHEMA private TO authenticator;

-- Explicitly ensure public.has_role is SECURITY DEFINER and doesn't rely on session user's schema permissions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, authenticator;

-- Make sure user_roles is indeed in public
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'user_roles') THEN
        -- If it's not in public, maybe it's in private? Move it to public if so.
        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'private' AND c.relname = 'user_roles') THEN
            ALTER TABLE private.user_roles SET SCHEMA public;
        END IF;
    END IF;
END $$;

GRANT SELECT ON public.user_roles TO anon, authenticated, authenticator;
GRANT ALL ON public.user_roles TO service_role;

-- Ensure RLS doesn't block the SECURITY DEFINER function
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view roles" ON public.user_roles;
CREATE POLICY "Public can view roles" ON public.user_roles FOR SELECT TO public USING (true);
