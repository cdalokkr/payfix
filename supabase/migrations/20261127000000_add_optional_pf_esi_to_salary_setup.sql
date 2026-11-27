-- Add optional PF (EPF) and ESI (ESIC) configuration columns to employee_salary_setup across all tenant schemas.

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
            ALTER TABLE IF EXISTS %I.employee_salary_setup
                ADD COLUMN IF NOT EXISTS pf_enabled boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS pf_uan text,
                ADD COLUMN IF NOT EXISTS pf_mode text NOT NULL DEFAULT ''statutory'',
                ADD COLUMN IF NOT EXISTS pf_employee_rate numeric(5, 2) NOT NULL DEFAULT 12.00,
                ADD COLUMN IF NOT EXISTS pf_employer_rate numeric(5, 2) NOT NULL DEFAULT 12.00,
                ADD COLUMN IF NOT EXISTS pf_ceiling_enabled boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS pf_fixed_amount numeric(12, 2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS esi_enabled boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS esi_number text,
                ADD COLUMN IF NOT EXISTS esi_mode text NOT NULL DEFAULT ''statutory'',
                ADD COLUMN IF NOT EXISTS esi_employee_rate numeric(5, 2) NOT NULL DEFAULT 0.75,
                ADD COLUMN IF NOT EXISTS esi_employer_rate numeric(5, 2) NOT NULL DEFAULT 3.25,
                ADD COLUMN IF NOT EXISTS esi_limit_enabled boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS esi_fixed_amount numeric(12, 2) NOT NULL DEFAULT 0;
        ', v_schema);
    END LOOP;
END;
$$;
