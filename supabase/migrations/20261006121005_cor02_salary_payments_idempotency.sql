-- COR-02: Add idempotency_key to salary_payments and enforce unique partial index.
--
-- Prevents duplicate payment recordings and financial race conditions.
--
-- Rollback:
--   DO $$
--   DECLARE r record;
--   BEGIN
--     FOR r IN SELECT schema_name FROM information_schema.schemata WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
--     LOOP
--       EXECUTE format('DROP INDEX IF EXISTS %I.salary_payments_idempotency_key_idx;', r.schema_name);
--       EXECUTE format('ALTER TABLE %I.salary_payments DROP COLUMN IF EXISTS idempotency_key;', r.schema_name);
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
        -- 1. Add idempotency_key column
        EXECUTE format(
            'ALTER TABLE IF EXISTS %I.salary_payments ADD COLUMN IF NOT EXISTS "idempotency_key" text;',
            tenant_schema.schema_name
        );

        -- 2. Create unique partial index on non-null idempotency_key
        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS "salary_payments_idempotency_key_idx" ' ||
            'ON %I."salary_payments" ("idempotency_key") ' ||
            'WHERE "idempotency_key" IS NOT NULL;',
            tenant_schema.schema_name
        );
    END LOOP;
END $$;
