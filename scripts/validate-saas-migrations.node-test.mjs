import assert from 'node:assert/strict';
import test from 'node:test';

import { validateMigrationSql } from './validate-saas-migrations.mjs';

function failures(sql) {
  return validateMigrationSql(sql, 'fixture.sql');
}

test('allows a read-only tenant registry fallback', () => {
  assert.deepEqual(
    failures(`
      SELECT id, tenant_schema
      FROM public.tenants
      WHERE status = 'active';
    `),
    [],
  );
});

test('allows joining the tenant registry from a read-only query', () => {
  assert.deepEqual(
    failures(`
      SELECT t.id
      FROM tenant_primary.profiles p
      JOIN public.tenants t ON t.tenant_schema = 'tenant_primary';
    `),
    [],
  );
});

test('allows tenant privilege grants that mention DML keywords', () => {
  assert.deepEqual(
    failures(`
      SELECT id, tenant_schema
      FROM public.tenants;
      GRANT SELECT, INSERT, UPDATE, DELETE
      ON ALL TABLES IN SCHEMA tenant_primary TO payfix_tenant_role;
    `),
    [],
  );
});

test('rejects writes that use the tenant registry fallback', () => {
  assert.equal(
    failures(`
      INSERT INTO tenant_primary.profiles (id)
      SELECT id FROM public.tenants;
    `).length,
    1,
  );
  assert.equal(
    failures(`
      UPDATE tenant_primary.profiles
      SET status = 'active'
      FROM public.tenants t
      WHERE tenant_primary.profiles.id = t.id;
    `).length,
    1,
  );
  assert.equal(
    failures(`
      DELETE FROM tenant_primary.profiles
      USING public.tenants
      WHERE tenant_primary.profiles.id = public.tenants.id;
    `).length,
    1,
  );
});

test('rejects public schema writes, references, and search paths', () => {
  assert.equal(
    failures('CREATE TABLE public.bad_table (id uuid);').length,
    1,
  );
  assert.equal(
    failures('SELECT id FROM public.profiles;').length,
    1,
  );
  assert.equal(
    failures('SET search_path = public, pg_temp;').length,
    1,
  );
});

test('ignores public references in SQL comments', () => {
  assert.deepEqual(
    failures(`
      -- SELECT id FROM public.profiles;
      /* UPDATE public.tenants SET status = 'cancelled'; */
      SELECT id FROM tenant_primary.profiles;
    `),
    [],
  );
});