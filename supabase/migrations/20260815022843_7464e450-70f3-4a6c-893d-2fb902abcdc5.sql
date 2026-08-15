-- 1. Verificar se existe algum tipo no private sendo usado como parâmetro em QUALQUER função do public
SELECT 
    p.proname as public_function,
    pg_get_function_arguments(p.oid) as args,
    n.nspname as type_schema
FROM pg_proc p
JOIN pg_namespace pn ON pn.oid = p.pronamespace
JOIN pg_type t ON t.oid = ANY(p.proargtypes)
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE pn.nspname = 'public' AND n.nspname = 'private';

-- 2. Verificar se o PostgREST está configurado para o esquema private
-- (Via inspeção de variáveis de configuração do banco se possível)
SELECT name, setting FROM pg_settings WHERE name = 'pgrst.db_schemas';

-- 3. Tentar descobrir se existe algum privilégio faltando para o authenticator no private
SELECT 
    table_name, 
    has_table_privilege('authenticator', 'private.' || table_name, 'SELECT') as can_select
FROM information_schema.tables 
WHERE table_schema = 'private';

-- 4. Ver se existe algum domínio ou tipo composto no public que referencia o private
SELECT 
    t.typname, 
    n.nspname, 
    bt.typname as base_type, 
    bn.nspname as base_schema
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_type bt ON bt.oid = t.typbasetype
JOIN pg_namespace bn ON bn.oid = bt.typnamespace
WHERE n.nspname = 'public' AND bn.nspname = 'private';
