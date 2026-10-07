-- COR-03: Ensure uniqueness of monthly attendance summary per profile, month, year.
--
-- Prevents duplicate payslips / salary summaries when compilation is run
-- concurrently or repeatedly.
--
-- Rollback:
--   DO $$
--   DECLARE r record;
--   BEGIN
--     FOR r IN SELECT schema_name FROM information_schema.schemata WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
--     LOOP
--       EXECUTE format('DROP INDEX IF EXISTS %I.monthly_attendance_summary_profile_month_year_idx;', r.schema_name);
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
            'CREATE UNIQUE INDEX IF NOT EXISTS "monthly_attendance_summary_profile_month_year_idx" ' ||
            'ON %I."monthly_attendance_summary" ("profile_id", "month", "year");',
            tenant_schema.schema_name
        );
    END LOOP;
END $$;
