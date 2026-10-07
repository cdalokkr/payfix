-- SEC-01: Restrict public.biometric_raw_logs to server-side access only.
--
-- Before this migration:
--   * RLS enabled but not forced.
--   * Policy "Enable read access for authenticated users on biometric_raw_log"
--     allowed any authenticated client to SELECT every row (USING (true)).
--   * anon and authenticated held full table grants, including TRUNCATE,
--     which row-level security does not restrict.
--
-- The application never reads or writes this table from a client. Device
-- ingestion (app/api/biometric/iclock, app/api/biometric/sync) inserts raw
-- punches through the server-side tenant database connection into the
-- tenant schema, so client roles need no access here.
--
-- Rollback (only if a documented server path breaks; do not restore broad
-- client reads without a written reason):
--   GRANT SELECT ON public.biometric_raw_logs TO authenticated;
--   ALTER TABLE public.biometric_raw_logs NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users on biometric_raw_log"
    ON public.biometric_raw_logs;

REVOKE ALL ON TABLE public.biometric_raw_logs FROM anon, authenticated;

ALTER TABLE public.biometric_raw_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_raw_logs FORCE ROW LEVEL SECURITY;

-- The existing service_role policy is kept unchanged so that trusted server
-- tooling keeps working.
