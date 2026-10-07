-- NEW-01: Create biometric_consumed_proofs table across tenant schemas.
--
-- Provides database-backed replay protection for biometric attendance proofs
-- across multiple serverless lambda instances.
--
-- Rollback:
--   DO $$
--   DECLARE r record;
--   BEGIN
--     FOR r IN SELECT schema_name FROM information_schema.schemata WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
--     LOOP
--       EXECUTE format('DROP TABLE IF EXISTS %I.biometric_consumed_proofs CASCADE;', r.schema_name);
--     END LOOP;
--   END $$;

DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
    LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I."biometric_consumed_proofs" (' ||
            '  "jti" text PRIMARY KEY,' ||
            '  "profile_id" uuid REFERENCES %I."profiles"("id") ON DELETE CASCADE,' ||
            '  "action" text NOT NULL,' ||
            '  "expires_at" timestamp with time zone NOT NULL,' ||
            '  "created_at" timestamp with time zone DEFAULT now()' ||
            ');',
            tenant_schema.schema_name, tenant_schema.schema_name
        );
    END LOOP;
END $$;
