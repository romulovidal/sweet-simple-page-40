-- 1. Listar objetos no private com detalhes
SELECT n.nspname, c.relname, c.relkind, r.rolname as owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_roles r ON c.relowner = r.oid
WHERE n.nspname = 'private';

-- 2. Verificar se o PostgREST está configurado para o esquema private
-- (Via inspeção de variáveis de sessão do banco se possível)
SELECT current_setting('pgrst.db_schemas', true);

-- 3. Tentar conceder permissão de introspecção global para o authenticator
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO authenticator;
GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO authenticator;

-- 4. Confirmar search path do banco
SHOW search_path;
