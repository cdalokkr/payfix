-- Reconcile existing tenant schemas with the versioned tenant contract.
--
-- This migration is intentionally tenant-only. tenant_primary is preferred as
-- the structure source; the public schema is a read-only fallback for
-- business tables that the evolved template does not contain. No rows are
-- copied from either source.

DO $$
DECLARE
    tenant_schema record;
    table_name text;
    source_schema text;
    fk record;
    attendance_date_type text;
    column_name text;
    column_type text;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
    LOOP
        FOREACH table_name IN ARRAY ARRAY[
            'designations', 'profiles', 'activities', 'attendance', 'leaves',
            'notifications', 'user_status_history', 'analytics_metrics',
            'office_settings', 'office_closures', 'employee_settings',
            'biometric_devices', 'office_locations', 'user_mpin',
            'push_subscriptions', 'profile_photo_requests', 'attendance_sessions',
            'biometric_raw_logs', 'kiosk_devices', 'employee_salary_setup',
            'employee_advances', 'monthly_attendance_summary', 'clients',
            'complaints', 'tickets', 'ticket_assignments', 'ticket_resolutions',
            'call_logs', 'salary_payments'
        ]
        LOOP
            source_schema := NULL;
            IF to_regclass(format('%I.%I', 'tenant_primary', table_name)) IS NOT NULL THEN
                source_schema := 'tenant_primary';
            ELSIF to_regclass(format('%I.%I', 'public', table_name)) IS NOT NULL THEN
                source_schema := 'public';
            END IF;

            IF source_schema IS NULL THEN
                RAISE EXCEPTION 'Canonical tenant source table is missing: %', table_name;
            END IF;

            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I.%I (LIKE %I.%I INCLUDING ALL)',
                tenant_schema.schema_name, table_name, source_schema, table_name
            );

            FOR column_name, column_type IN
                SELECT source_attribute.attname,
                       format_type(source_attribute.atttypid, source_attribute.atttypmod)
                FROM pg_attribute source_attribute
                JOIN pg_class source_table ON source_table.oid = source_attribute.attrelid
                JOIN pg_namespace source_namespace ON source_namespace.oid = source_table.relnamespace
                WHERE source_namespace.nspname = source_schema
                  AND source_table.relname = table_name
                  AND source_attribute.attnum > 0
                  AND NOT source_attribute.attisdropped
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = tenant_schema.schema_name
                      AND information_schema.columns.table_name = table_name
                      AND information_schema.columns.column_name = column_name
                ) THEN
                    EXECUTE format(
                        'ALTER TABLE %I.%I ADD COLUMN %I %s',
                        tenant_schema.schema_name, table_name, column_name, column_type
                    );
                END IF;
            END LOOP;
        END LOOP;

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.biometric_verification_attempts (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                profile_id uuid,
                source text NOT NULL,
                outcome text NOT NULL,
                similarity numeric(6,5),
                threshold numeric(6,5),
                reason_code text,
                face_count integer,
                frame_count integer,
                liveness_passed boolean,
                quality_score real,
                quality_diagnostics jsonb,
                capture_pipeline_version text,
                embedding_pipeline_version text,
                backend_engine text,
                processing_ms integer,
                request_id text,
                created_at timestamptz NOT NULL DEFAULT now()
            )
        $sql$, tenant_schema.schema_name);

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I._tenant_schema_metadata (
                key text PRIMARY KEY,
                value text NOT NULL,
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            INSERT INTO %I._tenant_schema_metadata (key, value)
            VALUES ('schema_version', '2026-08-30.1'), ('template', 'tenant_primary')
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = now()
        $sql$, tenant_schema.schema_name, tenant_schema.schema_name);

        EXECUTE format($sql$
            ALTER TABLE %I.profiles
                ADD COLUMN IF NOT EXISTS face_embedding_512 vector(512),
                ADD COLUMN IF NOT EXISTS face_embedding_pipeline_version text,
                ADD COLUMN IF NOT EXISTS face_quality_score real,
                ADD COLUMN IF NOT EXISTS face_enrolled_at timestamptz,
                ADD COLUMN IF NOT EXISTS face_photo_url text;

            ALTER TABLE %I.profile_photo_requests
                ADD COLUMN IF NOT EXISTS pending_photo_url text,
                ADD COLUMN IF NOT EXISTS pending_photo_sha256 text,
                ADD COLUMN IF NOT EXISTS pending_face_embedding_512 vector(512),
                ADD COLUMN IF NOT EXISTS pending_face_embedding_pipeline_version text,
                ADD COLUMN IF NOT EXISTS pending_face_embedding vector(128);

            ALTER TABLE %I.attendance
                ADD COLUMN IF NOT EXISTS first_check_in timestamptz,
                ADD COLUMN IF NOT EXISTS last_check_out timestamptz,
                ADD COLUMN IF NOT EXISTS total_sessions integer DEFAULT 0,
                ADD COLUMN IF NOT EXISTS current_session_status text DEFAULT 'checked_out',
                ADD COLUMN IF NOT EXISTS location_id uuid,
                ADD COLUMN IF NOT EXISTS selfie_url text,
                ADD COLUMN IF NOT EXISTS checkin_latitude numeric(10,7),
                ADD COLUMN IF NOT EXISTS checkin_longitude numeric(10,7),
                ADD COLUMN IF NOT EXISTS checkin_location_name text,
                ADD COLUMN IF NOT EXISTS face_match_score numeric(5,4);

            ALTER TABLE %I.attendance_sessions
                ADD COLUMN IF NOT EXISTS checkout_latitude numeric(10,7),
                ADD COLUMN IF NOT EXISTS checkout_longitude numeric(10,7),
                ADD COLUMN IF NOT EXISTS checkout_location_name text,
                ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
                ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

            ALTER TABLE %I.employee_settings
                ADD COLUMN IF NOT EXISTS biometric_device_user_id text,
                ADD COLUMN IF NOT EXISTS face_vector jsonb;

            ALTER TABLE %I.biometric_verification_attempts
                ADD COLUMN IF NOT EXISTS request_id text
        $sql$,
        tenant_schema.schema_name, tenant_schema.schema_name,
        tenant_schema.schema_name, tenant_schema.schema_name,
        tenant_schema.schema_name, tenant_schema.schema_name);

        EXECUTE format($sql$
            ALTER TABLE %I.kiosk_devices
                ADD COLUMN IF NOT EXISTS name text,
                ADD COLUMN IF NOT EXISTS pairing_code text,
                ADD COLUMN IF NOT EXISTS terminal_id text,
                ADD COLUMN IF NOT EXISTS location_id uuid,
                ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
                ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
                ADD COLUMN IF NOT EXISTS created_by uuid,
                ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
        $sql$, tenant_schema.schema_name);

        -- Preserve data from old names after the compatibility columns exist.
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = tenant_schema.schema_name
              AND table_name = 'profile_photo_requests'
              AND column_name = 'photo_url'
        ) THEN
            EXECUTE format(
                'UPDATE %I.profile_photo_requests
                 SET pending_photo_url = COALESCE(pending_photo_url, photo_url)
                 WHERE pending_photo_url IS NULL',
                tenant_schema.schema_name
            );
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = tenant_schema.schema_name
              AND table_name = 'kiosk_devices'
              AND column_name = 'device_name'
        ) THEN
            EXECUTE format(
                'UPDATE %I.kiosk_devices
                 SET name = COALESCE(name, device_name)
                 WHERE name IS NULL',
                tenant_schema.schema_name
            );
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = tenant_schema.schema_name
              AND table_name = 'kiosk_devices'
              AND column_name = 'last_active_at'
        ) THEN
            EXECUTE format(
                'UPDATE %I.kiosk_devices
                 SET last_seen_at = COALESCE(last_seen_at, last_active_at)
                 WHERE last_seen_at IS NULL',
                tenant_schema.schema_name
            );
        END IF;

        -- Existing schemas created attendance_sessions.date as text. Invalid
        -- values deliberately fail the migration instead of being discarded.
        SELECT data_type INTO attendance_date_type
        FROM information_schema.columns
        WHERE table_schema = tenant_schema.schema_name
          AND table_name = 'attendance_sessions'
          AND column_name = 'date';
        IF attendance_date_type IS NOT NULL AND attendance_date_type <> 'date' THEN
            EXECUTE format(
                'ALTER TABLE %I.attendance_sessions
                 ALTER COLUMN date TYPE date
                 USING NULLIF(trim(date::text), '''')::date',
                tenant_schema.schema_name
            );
        END IF;

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS profiles_face_embedding_hnsw_idx
             ON %I.profiles USING hnsw (face_embedding vector_cosine_ops)
             WITH (m = 16, ef_construction = 64)',
            tenant_schema.schema_name
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS attendance_sessions_attendance_id_idx ON %I.attendance_sessions (attendance_id)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS attendance_sessions_profile_date_checkin_idx ON %I.attendance_sessions (profile_id, date, check_in DESC)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS biometric_raw_logs_profile_id_idx ON %I.biometric_raw_logs (profile_id)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS kiosk_devices_created_by_idx ON %I.kiosk_devices (created_by)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS kiosk_devices_location_id_idx ON %I.kiosk_devices (location_id)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS kiosk_devices_terminal_id_idx ON %I.kiosk_devices (terminal_id) WHERE terminal_id IS NOT NULL', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS office_locations_created_by_idx ON %I.office_locations (created_by)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS profile_photo_requests_profile_status_created_idx ON %I.profile_photo_requests (profile_id, status, created_at DESC)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS profile_photo_requests_reviewed_by_idx ON %I.profile_photo_requests (reviewed_by)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS biometric_verification_attempts_profile_created_idx ON %I.biometric_verification_attempts (profile_id, created_at DESC)', tenant_schema.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS biometric_verification_attempts_created_idx ON %I.biometric_verification_attempts (created_at DESC)', tenant_schema.schema_name);

        FOR fk IN
            SELECT *
            FROM (VALUES
                ('profiles', 'designation_id', 'designations', 'id', 'SET NULL'),
                ('activities', 'user_id', 'profiles', 'id', 'CASCADE'),
                ('attendance', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('attendance', 'verified_by', 'profiles', 'id', 'SET NULL'),
                ('attendance', 'location_id', 'office_locations', 'id', 'SET NULL'),
                ('leaves', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('leaves', 'approved_by', 'profiles', 'id', 'SET NULL'),
                ('employee_settings', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('biometric_devices', 'location_id', 'office_locations', 'id', 'SET NULL'),
                ('office_locations', 'created_by', 'profiles', 'id', 'SET NULL'),
                ('kiosk_devices', 'location_id', 'office_locations', 'id', 'SET NULL'),
                ('kiosk_devices', 'created_by', 'profiles', 'id', 'SET NULL'),
                ('user_mpin', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('push_subscriptions', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('profile_photo_requests', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('profile_photo_requests', 'reviewed_by', 'profiles', 'id', 'SET NULL'),
                ('attendance_sessions', 'attendance_id', 'attendance', 'id', 'CASCADE'),
                ('attendance_sessions', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('attendance_sessions', 'location_id', 'office_locations', 'id', 'SET NULL'),
                ('biometric_raw_logs', 'profile_id', 'profiles', 'id', 'SET NULL'),
                ('biometric_raw_logs', 'location_id', 'office_locations', 'id', 'SET NULL'),
                ('biometric_verification_attempts', 'profile_id', 'profiles', 'id', 'SET NULL'),
                ('employee_salary_setup', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('employee_salary_setup', 'created_by', 'profiles', 'id', 'SET NULL'),
                ('employee_advances', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('employee_advances', 'created_by', 'profiles', 'id', 'SET NULL'),
                ('monthly_attendance_summary', 'profile_id', 'profiles', 'id', 'CASCADE'),
                ('monthly_attendance_summary', 'set_for_salary_by', 'profiles', 'id', 'SET NULL'),
                ('monthly_attendance_summary', 'paid_by', 'profiles', 'id', 'SET NULL'),
                ('clients', 'created_by', 'profiles', 'id', 'SET NULL'),
                ('complaints', 'client_id', 'clients', 'id', 'SET NULL'),
                ('complaints', 'created_by', 'profiles', 'id', 'SET NULL'),
                ('tickets', 'complaint_id', 'complaints', 'id', 'CASCADE'),
                ('tickets', 'created_by', 'profiles', 'id', 'SET NULL'),
                ('ticket_assignments', 'ticket_id', 'tickets', 'id', 'CASCADE'),
                ('ticket_assignments', 'assigned_to', 'profiles', 'id', 'CASCADE'),
                ('ticket_assignments', 'assigned_by', 'profiles', 'id', 'SET NULL'),
                ('ticket_resolutions', 'ticket_id', 'tickets', 'id', 'CASCADE'),
                ('ticket_resolutions', 'resolved_by', 'profiles', 'id', 'CASCADE'),
                ('call_logs', 'ticket_id', 'tickets', 'id', 'CASCADE'),
                ('call_logs', 'complaint_id', 'complaints', 'id', 'CASCADE'),
                ('call_logs', 'client_id', 'clients', 'id', 'SET NULL'),
                ('call_logs', 'called_by', 'profiles', 'id', 'CASCADE'),
                ('salary_payments', 'summary_id', 'monthly_attendance_summary', 'id', 'CASCADE'),
                ('salary_payments', 'paid_by', 'profiles', 'id', 'SET NULL')
            ) AS requirements(child_table, child_column, parent_table, parent_column, delete_action)
        LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint c
                JOIN pg_class child ON child.oid = c.conrelid
                JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
                JOIN pg_class parent ON parent.oid = c.confrelid
                JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
                JOIN pg_attribute child_attr ON child_attr.attrelid = child.oid AND child_attr.attnum = c.conkey[1]
                JOIN pg_attribute parent_attr ON parent_attr.attrelid = parent.oid AND parent_attr.attnum = c.confkey[1]
                WHERE c.contype = 'f'
                  AND child_ns.nspname = tenant_schema.schema_name
                  AND parent_ns.nspname = tenant_schema.schema_name
                  AND child.relname = fk.child_table
                  AND child_attr.attname = fk.child_column
                  AND parent.relname = fk.parent_table
                  AND parent_attr.attname = fk.parent_column
                  AND array_length(c.conkey, 1) = 1
                  AND array_length(c.confkey, 1) = 1
            ) THEN
                EXECUTE format(
                    'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE %s',
                    tenant_schema.schema_name,
                    fk.child_table,
                    fk.child_table || '_' || fk.child_column || '_fk',
                    fk.child_column,
                    tenant_schema.schema_name,
                    fk.parent_table,
                    fk.parent_column,
                    fk.delete_action
                );
            END IF;
        END LOOP;
    END LOOP;
END
$$;
