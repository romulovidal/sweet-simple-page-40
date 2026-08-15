-- 1. Verificar configuração do PostgREST (se possível via pg_settings)
SELECT name, setting, short_desc FROM pg_settings WHERE name LIKE 'pgrst%';

-- 2. Verificar se existe algum objeto no private que seja 'dono' de algo no public
SELECT 
    objid::regclass as public_object,
    refobjid::regclass as private_object
FROM pg_depend d
JOIN pg_class c ON c.oid = d.objid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_class rc ON rc.oid = d.refobjid
JOIN pg_namespace rn ON rn.oid = rc.relnamespace
WHERE n.nspname = 'public' AND rn.nspname = 'private';

-- 3. Verificar permissões de execução para TUDO no private para o authenticator
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT proname, nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private') LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION private.%I TO authenticator, authenticated, anon', r.proname);
    END LOOP;
END $$;

-- 4. Tentar descobrir se existe algum parâmetro de sessão atípico
SELECT current_setting('search_path');
