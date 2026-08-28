-- Version biometric templates so incompatible embedding pipelines are never
-- compared. Keep the central/public schema and every existing tenant schema
-- aligned; all additions are nullable to preserve existing enrollment data.

ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS face_embedding_pipeline_version text;

ALTER TABLE IF EXISTS public.profile_photo_requests
    ADD COLUMN IF NOT EXISTS pending_face_embedding_pipeline_version text;

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