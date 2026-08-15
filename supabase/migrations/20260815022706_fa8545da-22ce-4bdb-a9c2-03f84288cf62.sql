SELECT 
    rolname, 
    has_function_privilege(rolname, 'public.has_role(uuid, public.app_role)', 'EXECUTE') as can_execute
FROM pg_roles 
WHERE rolname IN ('authenticator', 'authenticated', 'anon', 'postgres');
