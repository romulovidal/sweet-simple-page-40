-- 1. Localizar definitivamente o tipo app_role
SELECT n.nspname as schema_name, t.typname as type_name
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'app_role';

-- 2. Verificar quem tem permissão no esquema private
SELECT 
  n.nspname,
  has_schema_privilege('authenticated', n.nspname, 'USAGE') as auth_usage,
  has_schema_privilege('anon', n.nspname, 'USAGE') as anon_usage
FROM pg_namespace n
WHERE n.nspname IN ('public', 'private', 'auth');

-- 3. Listar colunas da tabela user_roles e seus tipos
SELECT column_name, udt_name, udt_schema
FROM information_schema.columns
WHERE table_name = 'user_roles' AND table_schema = 'public';
