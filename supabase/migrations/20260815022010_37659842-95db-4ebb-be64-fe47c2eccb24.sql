-- 1. Verificar a definição atualizada da função (deve estar limpa)
SELECT 
    n.nspname as schema,
    p.proname as name,
    pg_get_functiondef(p.oid) as definition,
    p.proconfig -- Ver se há SET search_path persistente
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'has_role' AND n.nspname = 'public';

-- 2. Verificar se o tipo app_role tem dependência com o private
SELECT 
    t.typname, 
    n.nspname as schema,
    t.typnamespace,
    pg_catalog.format_type(t.oid, NULL) as full_name
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'app_role';

-- 3. Verificar o que PostgREST vê no esquema public (rpc visíveis)
-- (Não podemos ver as tabelas do postgrest diretamente, mas podemos ver o que é exposto)
SELECT 
    proname, 
    pronamespace::regnamespace, 
    proargtypes::regtype[] 
FROM pg_proc 
WHERE proname = 'has_role';
