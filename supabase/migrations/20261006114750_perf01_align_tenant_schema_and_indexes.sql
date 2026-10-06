-- PERF-01: Reconcile tenant schemas with schema contract and indexes.
--
-- Contract additions:
--   * CANONICAL_TENANT_COLUMNS.profile_photo_requests includes 'diagnostics' (jsonb).
--   * TENANT_REQUIRED_INDEXES includes attendance_sessions_one_active_per_profile_day.
--
-- This migration ensures the enum and all tenant schemas have the canonical
-- columns and indexes so that runtime DDL (ALTER TABLE / CREATE INDEX) is never
-- needed during daily operations.
--
-- Rollback:
--   DO $$
--   DECLARE r record;
--   BEGIN
--     FOR r IN SELECT schema_name FROM information_schema.schemata WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
--     LOOP
--       EXECUTE format('DROP INDEX IF EXISTS %I.attendance_sessions_one_active_per_profile_day;', r.schema_name);
--     END LOOP;
--   END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
        CREATE TYPE "attendance_source" AS ENUM ('mobile', 'biometric', 'manual', 'bulk', 'kiosk');
    ELSE
        ALTER TYPE "attendance_source" ADD VALUE IF NOT EXISTS 'kiosk';
    END IF;
END $$;

DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
    LOOP
        -- 1. Ensure profile_photo_requests diagnostics column exists
        EXECUTE format(
            'ALTER TABLE IF EXISTS %I.profile_photo_requests ADD COLUMN IF NOT EXISTS "diagnostics" jsonb;',
            tenant_schema.schema_name
        );

        -- 2. Ensure attendance_sessions active-session concurrency guard index exists
        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_one_active_per_profile_day" ' ||
            'ON %I."attendance_sessions" ("profile_id", "date") ' ||
            'WHERE "status" = ''active'';',
            tenant_schema.schema_name
        );
    END LOOP;
END $$;
