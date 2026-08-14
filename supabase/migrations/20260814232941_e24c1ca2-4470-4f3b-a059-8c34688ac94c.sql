-- Grants corrigidos com assinaturas exatas
GRANT EXECUTE ON FUNCTION public.get_prayer_author_names(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_retention_metrics(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_data() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(integer) TO authenticated, service_role;

-- Re-garantir grants para funções auxiliares
GRANT EXECUTE ON FUNCTION public.next_cantico_numero() TO authenticated, service_role;
