-- 1. Procurar por triggers que usem o esquema private
SELECT 
    trigger_name, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE action_statement LIKE '%private%';

-- 2. Procurar por views que usem o esquema private
SELECT 
    table_name, 
    view_definition
FROM information_schema.views 
WHERE view_definition LIKE '%private%';

-- 3. Procurar por políticas RLS que usem o esquema private
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    qual, 
    with_check
FROM pg_policies 
WHERE qual LIKE '%private%' OR with_check LIKE '%private%';

-- 4. Verificar se existe alguma dependência da função has_role(uuid, text)
SELECT 
    dependent_ns.nspname as dependent_schema,
    dependent_obj.relname as dependent_object,
    dependent_obj.relkind as type
FROM pg_depend 
JOIN pg_proc ON pg_proc.oid = pg_depend.objid
JOIN pg_rewrite ON pg_rewrite.oid = pg_depend.objid
JOIN pg_class as dependent_obj ON dependent_obj.oid = pg_rewrite.ev_class
JOIN pg_namespace as dependent_ns ON dependent_ns.oid = dependent_obj.relnamespace
WHERE pg_proc.proname = 'has_role';
