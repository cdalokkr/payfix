-- Read-only tenant-isolation and performance audit.
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
    pg_get_userbyid(c.relowner) AS owner,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows,
    COALESCE(s.n_dead_tup, 0)::bigint AS estimated_dead_rows,
    COALESCE(s.seq_scan, 0)::bigint AS sequential_scans,
    COALESCE(s.idx_scan, 0)::bigint AS index_scans,
    s.last_analyze,
    s.last_autoanalyze
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables AS s ON s.relid = c.oid
WHERE n.nspname ~ '^tenant_'
  AND c.relkind IN ('r', 'p')
ORDER BY n.nspname, c.relname;

SELECT
    schemaname AS tenant_schema,
    tablename AS table_name,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname ~ '^tenant_'
ORDER BY schemaname, tablename, policyname;

SELECT
    n.nspname AS tenant_schema,
    table_class.relname AS table_name,
    index_class.relname AS index_name,
    pg_size_pretty(pg_relation_size(index_class.oid)) AS index_size,
    COALESCE(stats.idx_scan, 0)::bigint AS index_scans,
    pg_get_indexdef(index_class.oid) AS index_definition
FROM pg_index AS idx
JOIN pg_class AS table_class ON table_class.oid = idx.indrelid
JOIN pg_class AS index_class ON index_class.oid = idx.indexrelid
JOIN pg_namespace AS n ON n.oid = table_class.relnamespace
LEFT JOIN pg_stat_user_indexes AS stats ON stats.indexrelid = index_class.oid
WHERE n.nspname ~ '^tenant_'
ORDER BY n.nspname, table_class.relname, index_class.relname;

SELECT
    n.nspname AS tenant_schema,
    c.relname AS table_name,
    con.conname AS constraint_name,
    string_agg(a.attname, ', ' ORDER BY key.ordinality) AS foreign_key_columns,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinality)
JOIN pg_attribute AS a ON a.attrelid = c.oid AND a.attnum = key.attnum
WHERE n.nspname ~ '^tenant_'
  AND con.contype = 'f'
  AND NOT EXISTS (
      SELECT 1
      FROM pg_index AS idx
      WHERE idx.indrelid = c.oid
        AND idx.indisvalid
        AND idx.indpred IS NULL
        AND (idx.indkey::smallint[])[0:array_length(con.conkey, 1) - 1] = con.conkey
  )
GROUP BY n.nspname, c.relname, con.conname, con.oid
ORDER BY n.nspname, c.relname, con.conname;

SELECT
    n.nspname AS tenant_schema,
    table_class.relname AS table_name,
    index_class.relname AS vector_index_name,
    pg_size_pretty(pg_relation_size(index_class.oid)) AS index_size,
    COALESCE(stats.idx_scan, 0)::bigint AS index_scans,
    pg_get_indexdef(index_class.oid) AS index_definition
FROM pg_index AS idx
JOIN pg_class AS table_class ON table_class.oid = idx.indrelid
JOIN pg_class AS index_class ON index_class.oid = idx.indexrelid
JOIN pg_namespace AS n ON n.oid = table_class.relnamespace
JOIN pg_am AS access_method ON access_method.oid = index_class.relam
LEFT JOIN pg_stat_user_indexes AS stats ON stats.indexrelid = index_class.oid
WHERE n.nspname ~ '^tenant_'
  AND access_method.amname IN ('hnsw', 'ivfflat')
ORDER BY n.nspname, table_class.relname, index_class.relname;