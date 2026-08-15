-- 1. Ver assinaturas exatas
SELECT 
    n.nspname as schema,
    p.proname as name,
    oidvectortypes(p.proargtypes) as args,
    p.proowner::regrole as owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'has_role';

-- 2. Verificar se o tipo app_role existe no private
SELECT n.nspname, t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'app_role';

-- 3. Verificar se PostgREST está configurado para o esquema private
-- (Não podemos ver as configs do servidor, mas podemos testar a visibilidade)
SELECT current_schemas(true);
