-- Historical migration reconciled with the version already applied in Supabase.
-- Tenant schemas only; public schema changes are intentionally kept in the
-- preceding already-applied migration.

DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant\_%' ESCAPE '\'
    LOOP
        IF to_regclass(format('%I.profiles', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE %I.profiles ADD COLUMN IF NOT EXISTS face_embedding_pipeline_version text',
                tenant_schema.schema_name
            );
        END IF;

        IF to_regclass(format('%I.profile_photo_requests', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE %I.profile_photo_requests ADD COLUMN IF NOT EXISTS pending_face_embedding_pipeline_version text',
                tenant_schema.schema_name
            );
        END IF;
    END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';