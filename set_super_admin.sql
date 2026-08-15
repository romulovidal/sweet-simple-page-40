
-- 1. Ensure user is super_admin in the database
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'contato@vidalweb.com.br'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Remove super_admin from the old UUID if it exists
DELETE FROM public.user_roles
WHERE user_id = '5850679f-697b-4ec2-a47c-47b88a96bffa'
AND role = 'super_admin';

-- 3. Grant admin role as well just in case hierarchy logic in functions isn't fully set
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'contato@vidalweb.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
