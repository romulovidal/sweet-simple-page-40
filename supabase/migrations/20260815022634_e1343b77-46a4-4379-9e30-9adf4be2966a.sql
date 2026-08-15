-- 1. Ver se existe algum parâmetro de configuração do banco que força o private no PostgREST
SELECT * FROM pg_settings WHERE name LIKE 'pgrst%';

-- 2. Tentar dar USAGE no private explicitamente para o papel authenticator (novamente, mas com foco no authenticator)
GRANT USAGE ON SCHEMA private TO authenticator;
GRANT ALL ON SCHEMA private TO authenticator;

-- 3. Ver se existe alguma função no private sendo referenciada por tipos no public
SELECT 
    t.typname,
    n.nspname,
    p.proname as function_name,
    pn.nspname as function_schema
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_proc p ON p.oid = t.typreceive OR p.oid = t.typsend
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE n.nspname = 'public' AND pn.nspname = 'private';
