-- 1. Identificar onde o tipo está e garantir USAGE
DO $$
DECLARE
    schema_name text;
BEGIN
    SELECT n.nspname INTO schema_name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role'
    LIMIT 1;

    IF schema_name IS NOT NULL THEN
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated, anon', schema_name);
        EXECUTE format('GRANT USAGE ON TYPE %I.app_role TO authenticated, anon', schema_name);
    END IF;
END $$;

-- 2. Garantir que authenticated pode ver as definições de rpc do public
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- 3. Garantir que o proprietário da função has_role (que é SECURITY DEFINER) 
-- tenha acesso total ao que for necessário.
-- Como ela é SECURITY DEFINER, ela roda como o criador (postgres), mas o binding do argumento
-- via PostgREST exige que o usuário chamador tenha USAGE no tipo do argumento.

-- 4. O erro 42501 'permission denied for schema private' via REST sugere que 
-- o PostgREST está tentando resolver o esquema 'private' para o argumento ou para a função.
-- Vamos dar GRANT USAGE no private globalmente para authenticated/anon, 
-- já que o linter mostrou que USAGE está true, mas talvez falte permissão no TIPO específico que está lá.
GRANT USAGE ON SCHEMA private TO authenticated, anon;

-- Se o tipo app_role estiver no private, o PostgREST PRECISA de USAGE nele.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'app_role' AND n.nspname = 'private') THEN
        GRANT USAGE ON TYPE private.app_role TO authenticated, anon;
    END IF;
END $$;
