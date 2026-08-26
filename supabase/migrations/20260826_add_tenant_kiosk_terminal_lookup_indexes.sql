-- Existing tenant schemas need terminal binding and a lookup index. The
-- terminal ID deliberately remains non-unique so a device can be unpaired and
-- reassigned without a destructive migration.

DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant\_%' ESCAPE '\'
    LOOP
        IF to_regclass(format('%I.kiosk_devices', tenant_schema.schema_name)) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE %I.kiosk_devices ADD COLUMN IF NOT EXISTS terminal_id text',
                tenant_schema.schema_name
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS kiosk_devices_terminal_id_idx ON %I.kiosk_devices (terminal_id) WHERE terminal_id IS NOT NULL',
                tenant_schema.schema_name
            );
        END IF;
    END LOOP;
END;
$$;