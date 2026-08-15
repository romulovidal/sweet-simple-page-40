-- 1. Ver se existe algum tipo no public que depende do private
SELECT 
    t.typname as type_name,
    n.nspname as schema_name,
    d.objid,
    d.refobjid,
    ref_n.nspname as ref_schema
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_depend d ON d.objid = t.oid
JOIN pg_type ref_t ON ref_t.oid = d.refobjid
JOIN pg_namespace ref_n ON ref_n.oid = ref_t.typnamespace
WHERE n.nspname = 'public' AND ref_n.nspname = 'private';

-- 2. Verificar se o app_role está realmente no public
SELECT n.nspname, t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'app_role';

-- 3. Verificar o Search Path configurado para o banco/role se possível
SHOW search_path;

-- 4. Tentar mover o app_role para o public se ele estiver no private
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'app_role' AND n.nspname = 'private') THEN
        ALTER TYPE private.app_role SET SCHEMA public;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao mover tipo: %', SQLERRM;
END $$;
