-- O PostgREST é executado como o papel 'authenticator'.
-- Se ele está tentando ler metadados do esquema private (que pode ter sido exposto
-- em algum momento na configuração do banco), ele falha se o acesso for negado.

-- 1. Tentar dar USAGE no private diretamente para o authenticator
GRANT USAGE ON SCHEMA private TO authenticator;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO anon;

-- 2. Conceder SELECT no private para garantir que a introspecção de metadados não falhe
GRANT SELECT ON ALL TABLES IN SCHEMA private TO authenticator, authenticated;

-- 3. Confirmar search path
ALTER ROLE authenticator SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
