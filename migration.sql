-- 1. Ensure enum exists and has super_admin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'user');
    END IF;
END
$$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Create helper functions in public schema with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
  );
$$;

-- Drop existing functions to avoid conflicts with parameter types
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;

-- New hierarchical has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_roles_list public.app_role[];
BEGIN
    -- Get all roles for the user
    SELECT array_agg(role) INTO user_roles_list
    FROM public.user_roles
    WHERE user_id = _user_id;

    IF user_roles_list IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Hierarchy: super_admin has everything
    IF 'super_admin'::public.app_role = ANY(user_roles_list) THEN
        RETURN TRUE;
    END IF;

    -- Exact match
    IF _role = ANY(user_roles_list) THEN
        RETURN TRUE;
    END IF;

    -- If checking for 'user', and they have 'admin', return true? 
    -- Usually 'admin' implies 'user' privileges in many apps.
    -- But let's stick to the user's explicit hierarchy: super_admin -> admin -> user
    IF _role = 'admin'::public.app_role AND 'admin'::public.app_role = ANY(user_roles_list) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- Text-based wrapper for PostgREST / RPC calls
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.has_role(_user_id, _role::public.app_role);
EXCEPTION WHEN OTHERS THEN
    -- Fallback for invalid enum values
    RETURN FALSE;
END;
$$;

-- 3. Update the Super Admin
-- First ensure they have a record
INSERT INTO public.user_roles (user_id, role)
VALUES ('5850679f-697b-4ec2-a47c-47b88a96bffa', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- If they were 'admin', we can keep it or remove it. The hierarchy handles it.
-- Let's just make sure they have 'super_admin'.

-- 4. Permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, anon;

-- Ensure RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Clean up old private functions if they cause confusion (optional but recommended)
-- We won't delete them yet to avoid breaking other things if they are used elsewhere, 
-- but we've disconnected public.has_role from them.
