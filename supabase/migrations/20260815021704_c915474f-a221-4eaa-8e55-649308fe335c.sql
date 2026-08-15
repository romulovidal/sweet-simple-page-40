-- 1. Ver a definição das funções has_role
SELECT 
    n.nspname as schema,
    p.proname as name,
    pg_get_functiondef(p.oid) as definition,
    proargtypes,
    proargnames
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'has_role';

-- 2. Ver permissões atuais no esquema private
SELECT 
    n.nspname as schema_name,
    has_schema_privilege('authenticated', n.nspname, 'USAGE') as authenticated_usage,
    has_schema_privilege('anon', n.nspname, 'USAGE') as anon_usage
FROM pg_namespace n
WHERE n.nspname = 'private';
