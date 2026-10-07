-- DATA-01: Support decimal leave days (e.g. 0.5, 1.5) in monthly_attendance_summary.
--
-- Prior to this migration, total_leaves was an INTEGER, which caused half-day
-- leaves (0.5 days) to be rounded via Math.round() during salary compilation,
-- causing loss of leave precision.
--
-- This migration converts total_leaves to NUMERIC(5, 1) across all tenant schemas.

DO $$
DECLARE
    v_schema text;
BEGIN
    FOR v_schema IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspname LIKE 'tenant_%'
        ORDER BY nspname
    LOOP
        EXECUTE format('
            ALTER TABLE %I.monthly_attendance_summary
            ALTER COLUMN total_leaves TYPE numeric(5, 1) USING total_leaves::numeric(5, 1);

            ALTER TABLE %I.monthly_attendance_summary
            ALTER COLUMN total_leaves SET DEFAULT 0;
        ', v_schema, v_schema);
    END LOOP;
END;
$$;
