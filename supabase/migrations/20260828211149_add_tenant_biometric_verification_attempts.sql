-- Store verification diagnostics only inside tenant schemas.
-- No image, embedding, liveness challenge, or raw request payload is stored.

DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_'
    LOOP
        IF to_regclass(format('%I.profiles', tenant_schema.schema_name)) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format($sql$
            CREATE TABLE IF NOT EXISTS %I.biometric_verification_attempts (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                profile_id uuid REFERENCES %I.profiles(id) ON DELETE SET NULL,
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
        $sql$, tenant_schema.schema_name, tenant_schema.schema_name);

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.biometric_verification_attempts (profile_id, created_at DESC)',
            'biometric_verification_attempts_profile_created_idx',
            tenant_schema.schema_name
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.biometric_verification_attempts (created_at DESC)',
            'biometric_verification_attempts_created_idx',
            tenant_schema.schema_name
        );
    END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';