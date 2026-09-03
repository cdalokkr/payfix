-- Kiosk pairing keys are admin setup secrets only. Active terminals use a
-- random, expiring session token whose SHA-256 hash is retained server-side.
DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        EXECUTE format(
            'ALTER TABLE IF EXISTS %I.kiosk_devices
                ADD COLUMN IF NOT EXISTS credential_hash text,
                ADD COLUMN IF NOT EXISTS credential_expires_at timestamp with time zone',
            tenant_schema.schema_name
        );
    END LOOP;
END
$$;