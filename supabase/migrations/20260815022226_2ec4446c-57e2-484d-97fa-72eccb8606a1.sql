-- Repetir auditoria e garantir saída visível
WITH trigger_audit AS (
    SELECT trigger_name, event_object_table, action_statement
    FROM information_schema.triggers 
    WHERE action_statement LIKE '%private%'
),
view_audit AS (
    SELECT table_name, view_definition
    FROM information_schema.views 
    WHERE view_definition LIKE '%private%'
),
policy_audit AS (
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies 
    WHERE qual LIKE '%private%' OR with_check LIKE '%private%'
)
SELECT 'TRIGGER' as type, trigger_name as name, event_object_table as target FROM trigger_audit
UNION ALL
SELECT 'VIEW', table_name, '' FROM view_audit
UNION ALL
SELECT 'POLICY', policyname, tablename FROM policy_audit;
