-- Read-only tenant-isolation audit.
-- This script intentionally does not alter public or tenant schemas.

SELECT
    t.id AS tenant_id,
    t.slug,
    t.tenant_schema,
    t.status,
    CASE
        WHEN t.tenant_schema ~ '^tenant_[a-zA-Z0-9_]+$' THEN 'valid'
        ELSE 'invalid'
    END AS schema_name_status,
    to_regnamespace(t.tenant_schema) IS NOT NULL AS schema_exists
FROM public.tenants AS t
ORDER BY t.slug;

SELECT
    n.nspname AS tenant_schema,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    pg_get_userbyid(c.relowner) AS owner
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname ~ '^tenant_'
  AND c.relkind = 'r'
ORDER BY n.nspname, c.relname;

SELECT
    schemaname AS tenant_schema,
    tablename AS table_name,
    policyname,
    roles,
    cmd
FROM pg_policies
WHERE schemaname ~ '^tenant_'
ORDER BY schemaname, tablename, policyname;

SELECT
    n.nspname AS tenant_schema,
    c.relname AS table_name,
    a.attname AS foreign_key_column
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
JOIN unnest(con.conkey) AS key(attnum) ON true
JOIN pg_attribute AS a ON a.attrelid = c.oid AND a.attnum = key.attnum
WHERE n.nspname ~ '^tenant_'
  AND con.contype = 'f'
  AND NOT EXISTS (
      SELECT 1
      FROM pg_index AS idx
      WHERE idx.indrelid = c.oid
        AND a.attnum = ANY (idx.indkey)
  )
ORDER BY n.nspname, c.relname, a.attname;