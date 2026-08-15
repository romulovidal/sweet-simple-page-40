-- 1. Verificar Search Path global
SHOW search_path;

-- 2. Verificar Search Path para o usuário authenticator (usado pelo PostgREST)
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticator', 'authenticated', 'anon');

-- 3. Verificar o dono do esquema private e se o authenticator tem acesso
SELECT nspname, rolname as owner_name
FROM pg_namespace n
JOIN pg_roles r ON n.nspowner = r.oid
WHERE nspname = 'private';

-- 4. Tentar descobrir se o PostgREST está configurado para expor o private
-- (via configuração de nível de banco se disponível)
SELECT * FROM pg_settings WHERE name LIKE 'pgrst%';
