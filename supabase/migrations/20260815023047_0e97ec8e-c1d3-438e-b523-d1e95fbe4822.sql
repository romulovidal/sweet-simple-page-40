-- 1. Listar esquemas e seus donos
SELECT nspname, rolname as owner
FROM pg_namespace n
JOIN pg_roles r ON n.nspowner = r.oid;

-- 2. Verificar o search_path da role que o PostgREST usa internamente
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticator', 'authenticated', 'anon', 'postgres');

-- 3. Ver se existe algum parâmetro de sessão estranho
SHOW search_path;

-- 4. Tentar descobrir onde o termo 'private' aparece em definições de objetos
SELECT 
    nspname as schema,
    relname as name,
    'table/view' as type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE relname LIKE '%private%'
UNION ALL
SELECT 
    nspname as schema,
    proname as name,
    'function' as type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE proname LIKE '%private%';
