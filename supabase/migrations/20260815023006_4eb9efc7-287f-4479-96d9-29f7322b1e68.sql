-- 1. Verificar se a tabela user_roles realmente está no public
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'user_roles';

-- 2. Verificar se existe uma tabela duplicada no private
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'user_roles' AND table_schema = 'private';

-- 3. Listar colunas de public.user_roles e seus tipos
SELECT column_name, udt_schema, udt_name 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'user_roles';

-- 4. Verificar se a função has_role tem dependências em objetos do esquema private
SELECT 
    d.objid::regclass as dependent_object,
    d.refobjid::regclass as referenced_object,
    n.nspname as referenced_schema
FROM pg_depend d
JOIN pg_proc p ON p.oid = d.objid
JOIN pg_class c ON c.oid = d.refobjid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.proname = 'has_role' AND n.nspname = 'private';
