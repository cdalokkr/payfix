-- Destructive only to transaction-local fixture objects. The final ROLLBACK
-- leaves no schemas, rows, or roles behind.
BEGIN;

CREATE SCHEMA tenant_rls_fixture_a;
CREATE SCHEMA tenant_rls_fixture_b;
CREATE TABLE tenant_rls_fixture_a.records (id integer PRIMARY KEY, value text NOT NULL);
CREATE TABLE tenant_rls_fixture_b.records (id integer PRIMARY KEY, value text NOT NULL);

SELECT payfix_internal.configure_tenant_security(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'tenant_rls_fixture_a'::name
);
SELECT payfix_internal.configure_tenant_security(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'tenant_rls_fixture_b'::name
);

DO $$
DECLARE
  v_count integer;
BEGIN
  SET LOCAL ROLE payfix_tenant_aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa;
  PERFORM set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  PERFORM set_config('app.tenant_schema', 'tenant_rls_fixture_a', true);

  INSERT INTO tenant_rls_fixture_a.records VALUES (1, 'tenant-a');
  SELECT count(*) INTO v_count FROM tenant_rls_fixture_a.records;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A could not read its own row';
  END IF;

  BEGIN
    PERFORM count(*) FROM tenant_rls_fixture_b.records;
    RAISE EXCEPTION 'Tenant A unexpectedly read tenant B';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  SELECT count(*) INTO v_count FROM tenant_rls_fixture_a.records;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Wrong tenant identity bypassed tenant A RLS';
  END IF;

  RESET ROLE;
END;
$$;

ROLLBACK;