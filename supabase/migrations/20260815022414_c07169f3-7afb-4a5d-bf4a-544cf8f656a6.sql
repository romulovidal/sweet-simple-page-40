GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT USAGE ON SCHEMA private TO authenticated, anon;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA private TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA private TO authenticated;
