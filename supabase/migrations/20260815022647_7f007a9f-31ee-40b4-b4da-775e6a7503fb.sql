-- Como o erro persiste, vamos adotar a postura de liberar USAGE 
-- para garantir que a introspecção de metadados do PostgREST não quebre.

GRANT USAGE ON SCHEMA private TO authenticated, anon, authenticator;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, authenticator;
GRANT SELECT ON ALL TABLES IN SCHEMA private TO authenticated, anon, authenticator;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated, anon, authenticator;

-- Garantir que o app_role tenha USAGE para todos
GRANT USAGE ON TYPE public.app_role TO authenticated, anon, authenticator;
