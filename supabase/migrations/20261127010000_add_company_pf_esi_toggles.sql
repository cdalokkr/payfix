-- Add optional company-level PF and ESI enable toggles to office_settings across all tenant schemas.
-- Default is false so companies that do not use PF/ESI do not need any setup or see statutory clutter.

DO $$
DECLARE
    v_schema text;
BEGIN
    FOR v_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
        ORDER BY schema_name
    LOOP
        EXECUTE format('
            ALTER TABLE IF EXISTS %I.office_settings
                ADD COLUMN IF NOT EXISTS pf_enabled boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS esi_enabled boolean NOT NULL DEFAULT false;
        ', v_schema);
    END LOOP;
END;
$$;
