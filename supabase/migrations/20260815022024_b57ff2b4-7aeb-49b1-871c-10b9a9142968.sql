-- 1. Ver em qual esquema o tipo app_role reside
SELECT typname, typnamespace::regnamespace 
FROM pg_type 
WHERE typname = 'app_role';

-- 2. Ver permissões dos esquemas public e private
SELECT 
    nspname as schema,
    has_schema_privilege('authenticated', nspname, 'USAGE') as auth_usage,
    has_schema_privilege('anon', nspname, 'USAGE') as anon_usage
FROM pg_namespace 
WHERE nspname IN ('public', 'private');
