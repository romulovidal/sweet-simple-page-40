SELECT 
  n.nspname as schema_name,
  has_schema_privilege('authenticated', n.nspname, 'USAGE') as authenticated_has_usage,
  has_schema_privilege('anon', n.nspname, 'USAGE') as anon_has_usage
FROM pg_namespace n
WHERE n.nspname IN ('public', 'private', 'auth');
