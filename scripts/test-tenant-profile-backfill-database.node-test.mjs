import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postgres from 'postgres';

const migrationPath = new URL(
  '../supabase/migrations/20260903000000_add_tenant_ownership_backfill_audit.sql',
  import.meta.url,
);

test(
  'persists a redacted failed ownership repair after applying the audit migration',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 1,
      connect_timeout: 15,
    });
    const tenantId = randomUUID();
    const fixtureSuffix = randomUUID().replaceAll('-', '');
    const tenantSlug = `ownership-failure-${fixtureSuffix.slice(0, 20)}`;
    const tenantSchema = `tenant_ownership_failure_${fixtureSuffix.slice(0, 20)}`;
    const migration = await readFile(migrationPath, 'utf8');

    try {
      await db.unsafe(migration);
      await db`
        DELETE FROM payfix_internal.tenant_ownership_backfill_audit
        WHERE tenant_id = ${tenantId}::uuid
      `;
      await db`
        DELETE FROM public.tenants
        WHERE id = ${tenantId}::uuid
      `;
      await db`
        INSERT INTO public.tenants (
          id,
          slug,
          company_name,
          tenant_schema,
          trial_end,
          admin_email,
          license_expires_at
        )
        VALUES (
          ${tenantId}::uuid,
          ${tenantSlug},
          'Ownership Failure Fixture',
          ${tenantSchema},
          NOW() + INTERVAL '1 day',
          'audit-fixture@example.test',
          NOW() + INTERVAL '1 day'
        )
      `;

      const schemaCheck = await db`
        SELECT to_regnamespace(${tenantSchema}) IS NOT NULL AS exists
      `;
      assert.equal(schemaCheck[0].exists, false);

      const { runTenantProfileBackfill } = await import(
        '../scripts/assign-tenant-ids-to-schemas.ts'
      );
      const report = await runTenantProfileBackfill({
        apply: true,
        tenantSlug,
      });

      assert.equal(report.verified, false);
      assert.deepEqual(report.tenants[0], {
        tenantId,
        slug: tenantSlug,
        companyName: 'Ownership Failure Fixture',
        schemaName: tenantSchema,
        databaseTarget: 'central',
        status: 'missing_schema',
        totalProfiles: 0,
        matchingProfiles: 0,
        missingTenantId: 0,
        conflictingProfiles: 0,
        updatedProfiles: 0,
        addedTenantIdColumn: false,
        conflicts: [],
        error: `Registered tenant schema does not exist: ${tenantSchema}`,
      });

      const auditRows = await db`
        SELECT
          to_jsonb(audit) AS payload,
          tenant_id::text,
          tenant_schema,
          mode,
          status,
          total_profiles,
          matching_profiles,
          missing_tenant_id,
          conflicting_profiles,
          updated_profiles,
          unresolved_conflict_count
        FROM payfix_internal.tenant_ownership_backfill_audit AS audit
        WHERE tenant_id = ${tenantId}::uuid
          AND tenant_schema = ${tenantSchema}
      `;

      assert.equal(auditRows.length, 1);
      assert.deepEqual(
        {
          tenant_id: auditRows[0].tenant_id,
          tenant_schema: auditRows[0].tenant_schema,
          mode: auditRows[0].mode,
          status: auditRows[0].status,
          total_profiles: auditRows[0].total_profiles,
          matching_profiles: auditRows[0].matching_profiles,
          missing_tenant_id: auditRows[0].missing_tenant_id,
          conflicting_profiles: auditRows[0].conflicting_profiles,
          updated_profiles: auditRows[0].updated_profiles,
          unresolved_conflict_count: auditRows[0].unresolved_conflict_count,
        },
        {
          tenant_id: tenantId,
          tenant_schema: tenantSchema,
          mode: 'apply',
          status: 'failed',
          total_profiles: 0,
          matching_profiles: 0,
          missing_tenant_id: 0,
          conflicting_profiles: 0,
          updated_profiles: 0,
          unresolved_conflict_count: 0,
        },
      );

      const auditPayload = auditRows[0].payload;
      assert.deepEqual(Object.keys(auditPayload).sort(), [
        'completed_at',
        'conflicting_profiles',
        'created_at',
        'id',
        'matching_profiles',
        'missing_tenant_id',
        'mode',
        'run_id',
        'started_at',
        'status',
        'tenant_id',
        'tenant_schema',
        'total_profiles',
        'unresolved_conflict_count',
        'updated_profiles',
      ]);
      assert.equal(auditPayload.email, undefined);
      assert.equal(auditPayload.database_url, undefined);
      assert.equal(auditPayload.profile_id, undefined);
      assert.equal(auditPayload.public_profile, undefined);
      assert.equal(auditPayload.admin_email, undefined);
      assert.equal(auditPayload.company_name, undefined);
    } finally {
      await db`
        DELETE FROM payfix_internal.tenant_ownership_backfill_audit
        WHERE tenant_id = ${tenantId}::uuid
      `;
      await db`
        DELETE FROM public.tenants
        WHERE id = ${tenantId}::uuid
      `;
      await db.end({ timeout: 5 });
    }
  },
);

test(
  'persists a redacted failed ownership repair when a custom database is unreachable',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 1,
      connect_timeout: 15,
    });
    const tenantId = randomUUID();
    const fixtureSuffix = randomUUID().replaceAll('-', '');
    const tenantSlug = `ownership-unreachable-${fixtureSuffix.slice(0, 20)}`;
    const tenantSchema = `tenant_ownership_unreachable_${fixtureSuffix.slice(0, 20)}`;
    const unreachableDatabaseUrl = 'postgresql://127.0.0.1:1/unreachable';
    const migration = await readFile(migrationPath, 'utf8');

    try {
      await db.unsafe(migration);
      await db`
        DELETE FROM payfix_internal.tenant_ownership_backfill_audit
        WHERE tenant_id = ${tenantId}::uuid
      `;
      await db`
        DELETE FROM public.tenants
        WHERE id = ${tenantId}::uuid
      `;
      await db`
        INSERT INTO public.tenants (
          id,
          slug,
          company_name,
          tenant_schema,
          database_url,
          trial_end,
          admin_email,
          license_expires_at
        )
        VALUES (
          ${tenantId}::uuid,
          ${tenantSlug},
          'Ownership Unreachable Fixture',
          ${tenantSchema},
          ${unreachableDatabaseUrl},
          NOW() + INTERVAL '1 day',
          'unreachable-fixture@example.test',
          NOW() + INTERVAL '1 day'
        )
      `;

      const { runTenantProfileBackfill } = await import(
        '../scripts/assign-tenant-ids-to-schemas.ts'
      );
      const report = await runTenantProfileBackfill({
        apply: true,
        tenantSlug,
      });
      const tenantReport = report.tenants[0];

      assert.equal(report.verified, false);
      assert.deepEqual({ ...tenantReport, error: undefined }, {
        tenantId,
        slug: tenantSlug,
        companyName: 'Ownership Unreachable Fixture',
        schemaName: tenantSchema,
        databaseTarget: 'custom',
        status: 'error',
        totalProfiles: 0,
        matchingProfiles: 0,
        missingTenantId: 0,
        conflictingProfiles: 0,
        updatedProfiles: 0,
        addedTenantIdColumn: false,
        conflicts: [],
        error: undefined,
      });
      assert.equal(typeof tenantReport.error, 'string');
      assert.notEqual(tenantReport.error, '');
      assert.doesNotMatch(tenantReport.error, new RegExp(unreachableDatabaseUrl));
      assert.doesNotMatch(tenantReport.error, /unreachable-fixture@example\.test/);

      const auditRows = await db`
        SELECT
          to_jsonb(audit) AS payload,
          tenant_id::text,
          tenant_schema,
          mode,
          status,
          total_profiles,
          matching_profiles,
          missing_tenant_id,
          conflicting_profiles,
          updated_profiles,
          unresolved_conflict_count
        FROM payfix_internal.tenant_ownership_backfill_audit AS audit
        WHERE tenant_id = ${tenantId}::uuid
          AND tenant_schema = ${tenantSchema}
      `;

      assert.equal(auditRows.length, 1);
      assert.deepEqual(
        {
          tenant_id: auditRows[0].tenant_id,
          tenant_schema: auditRows[0].tenant_schema,
          mode: auditRows[0].mode,
          status: auditRows[0].status,
          total_profiles: auditRows[0].total_profiles,
          matching_profiles: auditRows[0].matching_profiles,
          missing_tenant_id: auditRows[0].missing_tenant_id,
          conflicting_profiles: auditRows[0].conflicting_profiles,
          updated_profiles: auditRows[0].updated_profiles,
          unresolved_conflict_count: auditRows[0].unresolved_conflict_count,
        },
        {
          tenant_id: tenantId,
          tenant_schema: tenantSchema,
          mode: 'apply',
          status: 'failed',
          total_profiles: 0,
          matching_profiles: 0,
          missing_tenant_id: 0,
          conflicting_profiles: 0,
          updated_profiles: 0,
          unresolved_conflict_count: 0,
        },
      );

      const auditPayload = auditRows[0].payload;
      assert.deepEqual(Object.keys(auditPayload).sort(), [
        'completed_at',
        'conflicting_profiles',
        'created_at',
        'id',
        'matching_profiles',
        'missing_tenant_id',
        'mode',
        'run_id',
        'started_at',
        'status',
        'tenant_id',
        'tenant_schema',
        'total_profiles',
        'unresolved_conflict_count',
        'updated_profiles',
      ]);
      assert.equal(auditPayload.email, undefined);
      assert.equal(auditPayload.database_url, undefined);
      assert.equal(auditPayload.profile_id, undefined);
      assert.equal(auditPayload.public_profile, undefined);
      assert.equal(auditPayload.admin_email, undefined);
      assert.equal(auditPayload.company_name, undefined);
      assert.equal(JSON.stringify(auditPayload).includes(unreachableDatabaseUrl), false);
      assert.equal(JSON.stringify(auditPayload).includes('unreachable-fixture@example.test'), false);
    } finally {
      await db`
        DELETE FROM payfix_internal.tenant_ownership_backfill_audit
        WHERE tenant_id = ${tenantId}::uuid
      `;
      await db`
        DELETE FROM public.tenants
        WHERE id = ${tenantId}::uuid
      `;
      await db.end({ timeout: 5 });
    }
  },
);