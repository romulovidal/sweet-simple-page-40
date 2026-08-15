-- 1. Verificar se existe alguma função no private sendo usada por triggers do public
SELECT 
    trigger_name, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE action_statement LIKE '%private%';

-- 2. Verificar se existe algum tipo de dados no private sendo usado em tabelas public
SELECT 
    table_schema, 
    table_name, 
    column_name, 
    udt_name, 
    udt_schema
FROM information_schema.columns 
WHERE udt_schema = 'private';

-- 3. Verificar permissões de execução em todas as funções do private para o authenticator
SELECT 
    proname, 
    has_function_privilege('authenticator', p.oid, 'EXECUTE') as authenticator_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private';

-- 4. Tentar mover temporariamente TUDO do private para o public se for pouco objeto
-- para ver se o erro some (Teste de isolamento)
-- Apenas listar primeiro:
SELECT n.nspname, c.relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'private';
