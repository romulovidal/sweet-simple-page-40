-- Se o PostgREST está configurado para o esquema private, o erro 401 
-- ocorre se ele não conseguir ler nada lá.

-- 1. Dar USAGE no private e auth para o authenticator
GRANT USAGE ON SCHEMA private TO authenticator, authenticated, anon;
GRANT USAGE ON SCHEMA auth TO authenticator, authenticated, anon;

-- 2. Conceder SELECT no private e auth para o authenticator
GRANT SELECT ON ALL TABLES IN SCHEMA private TO authenticator, authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticator, authenticated, anon;

-- 3. Garantir que o authenticator possa ler metadados do sistema
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO authenticator, authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO authenticator, authenticated, anon;

-- 4. Garantir que o search_path do authenticator inclua o public
ALTER ROLE authenticator SET search_path = public, extensions;
