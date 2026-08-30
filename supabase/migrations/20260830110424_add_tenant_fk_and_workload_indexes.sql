-- Add tenant-only indexes justified by foreign-key maintenance and observed
-- attendance/photo-approval query patterns.
-- This migration intentionally does not read or alter the public schema.

DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_'
    LOOP
        IF to_regclass(format('%I.attendance_sessions', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.attendance_sessions (attendance_id)',
                'attendance_sessions_attendance_id_idx',
                tenant_schema.schema_name
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.attendance_sessions (profile_id, date, check_in DESC)',
                'attendance_sessions_profile_date_checkin_idx',
                tenant_schema.schema_name
            );
        END IF;

        IF to_regclass(format('%I.biometric_raw_logs', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.biometric_raw_logs (profile_id)',
                'biometric_raw_logs_profile_id_idx',
                tenant_schema.schema_name
            );
        END IF;

        IF to_regclass(format('%I.kiosk_devices', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.kiosk_devices (created_by)',
                'kiosk_devices_created_by_idx',
                tenant_schema.schema_name
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.kiosk_devices (location_id)',
                'kiosk_devices_location_id_idx',
                tenant_schema.schema_name
            );
        END IF;

        IF to_regclass(format('%I.office_locations', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.office_locations (created_by)',
                'office_locations_created_by_idx',
                tenant_schema.schema_name
            );
        END IF;

        IF to_regclass(format('%I.profile_photo_requests', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.profile_photo_requests (profile_id, status, created_at DESC)',
                'profile_photo_requests_profile_status_created_idx',
                tenant_schema.schema_name
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I.profile_photo_requests (reviewed_by)',
                'profile_photo_requests_reviewed_by_idx',
                tenant_schema.schema_name
            );
        END IF;
    END LOOP;
END
$$;