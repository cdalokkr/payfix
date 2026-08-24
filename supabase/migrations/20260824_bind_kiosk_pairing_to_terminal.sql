-- A pairing key may be claimed by one kiosk installation only.
-- Tenant schemas are created dynamically, so apply the additive column to
-- every existing tenant kiosk_devices table.
DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant\_%' ESCAPE '\'
    LOOP
        EXECUTE format(
            'ALTER TABLE IF EXISTS %I.kiosk_devices ADD COLUMN IF NOT EXISTS terminal_id text',
            tenant_schema.schema_name
        );
    END LOOP;
END $$;