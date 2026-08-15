-- 1. Verificar o dono do esquema private
SELECT nspname, rolname as owner_name
FROM pg_namespace n
JOIN pg_roles r ON n.nspowner = r.oid
WHERE nspname = 'private';

-- 2. Verificar o dono da função has_role
SELECT proname, rolname as owner_name
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
WHERE proname = 'has_role';

-- 3. Tentar alterar o dono para postgres (se permitido)
ALTER SCHEMA private OWNER TO postgres;
ALTER FUNCTION public.has_role(uuid, public.app_role) OWNER TO postgres;

-- 4. Verificar se o PostgREST está configurado para ver o esquema private
-- (Isso é uma configuração de nível de banco, vamos ver se conseguimos ler)
SELECT name, setting FROM pg_settings WHERE name = 'pgrst.db_schemas';
