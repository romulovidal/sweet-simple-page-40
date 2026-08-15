-- 1. Verificar permissões de esquema USAGE
SELECT 
  n.nspname as schema_name,
  has_schema_privilege('authenticated', n.nspname, 'USAGE') as authenticated_has_usage,
  has_schema_privilege('anon', n.nspname, 'USAGE') as anon_has_usage
FROM pg_namespace n
WHERE n.nspname IN ('public', 'private', 'auth');

-- 2. Listar todas as funções has_role registradas
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosecdef as is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'has_role';
