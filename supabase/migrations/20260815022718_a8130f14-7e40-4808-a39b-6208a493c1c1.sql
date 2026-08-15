-- Conceder USAGE no esquema private diretamente para o papel authenticator.
-- O PostgREST usa este papel para conectar ao banco antes de trocar 
-- para authenticated ou anon.
GRANT USAGE ON SCHEMA private TO authenticator;
GRANT ALL ON SCHEMA private TO authenticator;

-- Garantir que ele possa ler metadados
GRANT SELECT ON ALL TABLES IN SCHEMA private TO authenticator;

-- Também garantir para os papéis de runtime
GRANT USAGE ON SCHEMA private TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA private TO authenticated, anon;
