-- Tenant-only isolation for server-side PostgreSQL connections.
-- This migration intentionally does not alter any object in the public schema.

CREATE SCHEMA IF NOT EXISTS payfix_internal;
REVOKE ALL ON SCHEMA payfix_internal FROM PUBLIC;

CREATE OR REPLACE FUNCTION payfix_internal.configure_tenant_security(
  p_tenant_id uuid,
  p_tenant_schema name,
  p_runtime_role name DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_role name := COALESCE(
    p_runtime_role,
    ('payfix_tenant_' || replace(p_tenant_id::text, '-', ''))::name
  );
  v_table record;
  v_predicate text;
BEGIN
  IF p_tenant_schema::text !~ '^tenant_[a-z0-9_]{3,40}$' THEN
    RAISE EXCEPTION 'Invalid tenant schema: %', p_tenant_schema;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = p_tenant_schema::text
  ) THEN
    RAISE EXCEPTION 'Tenant schema does not exist: %', p_tenant_schema;
  END IF;

  -- Legacy tenant schemas may predate the ownership column. Add it before
  -- installing the policy so NULL or conflicting profiles fail closed until
  -- the controlled backfill has verified their ownership.
  IF to_regclass(format('%I.profiles', p_tenant_schema)) IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE %I.profiles ADD COLUMN IF NOT EXISTS tenant_id uuid',
      p_tenant_schema
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role::text) THEN
    EXECUTE format(
      'CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      v_role
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      v_role
    );
  END IF;

  -- The application retains the existing database credential but must enter
  -- this non-owner role before it can access tenant data.
  EXECUTE format('GRANT %I TO postgres', v_role);
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', p_tenant_schema, v_role);

  v_predicate := format(
    'current_setting(''app.tenant_id'', true) = %L AND current_setting(''app.tenant_schema'', true) = %L',
    p_tenant_id::text,
    p_tenant_schema::text
  );

  FOR v_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = p_tenant_schema::text
      AND c.relkind IN ('r', 'p')
  LOOP
    IF v_table.relname = 'profiles' THEN
      v_predicate := format(
        'current_setting(''app.tenant_id'', true) = %L AND current_setting(''app.tenant_schema'', true) = %L AND tenant_id = %L::uuid',
        p_tenant_id::text,
        p_tenant_schema::text,
        p_tenant_id::text
      );
    ELSE
      v_predicate := format(
        'current_setting(''app.tenant_id'', true) = %L AND current_setting(''app.tenant_schema'', true) = %L',
        p_tenant_id::text,
        p_tenant_schema::text
      );
    END IF;
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_tenant_schema, v_table.relname);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_tenant_schema, v_table.relname);
    EXECUTE format('DROP POLICY IF EXISTS payfix_tenant_isolation ON %I.%I', p_tenant_schema, v_table.relname);
    EXECUTE format(
      'CREATE POLICY payfix_tenant_isolation ON %I.%I FOR ALL TO %I USING (%s) WITH CHECK (%s)',
      p_tenant_schema,
      v_table.relname,
      v_role,
      v_predicate,
      v_predicate
    );
  END LOOP;

  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I',
    p_tenant_schema,
    v_role
  );
  EXECUTE format(
    'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO %I',
    p_tenant_schema,
    v_role
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    p_tenant_schema,
    v_role
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I',
    p_tenant_schema,
    v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION payfix_internal.configure_tenant_security(uuid, name, name) FROM PUBLIC;
GRANT USAGE ON SCHEMA payfix_internal TO postgres;
GRANT EXECUTE ON FUNCTION payfix_internal.configure_tenant_security(uuid, name, name) TO postgres;

DO $$
DECLARE
  v_tenant record;
BEGIN
  FOR v_tenant IN
    SELECT id, tenant_schema
    FROM public.tenants
    WHERE tenant_schema ~ '^tenant_[a-z0-9_]{3,40}$'
  LOOP
    PERFORM payfix_internal.configure_tenant_security(
      v_tenant.id,
      v_tenant.tenant_schema::name,
      NULL
    );
  END LOOP;
END;
$$;