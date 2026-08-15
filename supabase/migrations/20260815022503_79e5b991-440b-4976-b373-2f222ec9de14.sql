-- Se o PostgREST está configurado para expor o private ou se ele tenta ler 
-- seus metadados para qualquer introspecção, o bloqueio do esquema causa 401.

-- 1. Restaurar USAGE no private para authenticated e anon
GRANT USAGE ON SCHEMA private TO authenticated, anon;

-- 2. Conceder SELECT em tabelas de configuração do ATIS que podem estar no private
-- (isso é apenas uma precaução para garantir que o motor de automação funcione)
GRANT SELECT ON ALL TABLES IN SCHEMA private TO authenticated;

-- 3. Confirmar que a função has_role continua no public e é SECURITY DEFINER
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY DEFINER;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
