
-- 1. Create a shadow table in public that doesn't use the enum, just text
CREATE TABLE IF NOT EXISTS public.user_roles_new (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    role text not null,
    unique(user_id, role)
);

-- 2. Sync data if the old table exists and has data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
        INSERT INTO public.user_roles_new (user_id, role)
        SELECT user_id, role::text
        FROM public.user_roles
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 3. Grants
GRANT SELECT ON public.user_roles_new TO anon, authenticated, authenticator;
GRANT ALL ON public.user_roles_new TO service_role;

-- 4. Simple function that ONLY touches public.user_roles_new
CREATE OR REPLACE FUNCTION public.check_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles_new
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.check_admin(uuid) TO anon, authenticated, authenticator;

-- 5. Revoke usages on private for authenticator if it's causing issues
-- (sometimes the presence of USAGE triggers introspection that fails if internal objects aren't visible)
-- REVOKE USAGE ON SCHEMA private FROM authenticator; -- Safer to keep for now, but focus on public
