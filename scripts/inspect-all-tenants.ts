/**
 * Read-only audit of registered tenant schemas.
 *
 * Public profiles are summarized separately as control-plane identities and
 * are never used as a source for workspace ownership.
 */
import './env-config';
import { centralDb } from '../lib/db/index';
import { desc, sql } from 'drizzle-orm';
import { masterDb } from '../lib/db/master-connection';
import { tenantOwnershipBackfillAudit } from '../lib/db/master-schema';
import { runTenantProfileBackfill } from './assign-tenant-ids-to-schemas';

async function inspect() {
    const tenantReport = await runTenantProfileBackfill({ apply: false });
    const ownershipRepairAudit = await masterDb
        .select({
            runId: tenantOwnershipBackfillAudit.run_id,
            tenantId: tenantOwnershipBackfillAudit.tenant_id,
            tenantSchema: tenantOwnershipBackfillAudit.tenant_schema,
            startedAt: tenantOwnershipBackfillAudit.started_at,
            completedAt: tenantOwnershipBackfillAudit.completed_at,
            mode: tenantOwnershipBackfillAudit.mode,
            status: tenantOwnershipBackfillAudit.status,
            totalProfiles: tenantOwnershipBackfillAudit.total_profiles,
            matchingProfiles: tenantOwnershipBackfillAudit.matching_profiles,
            missingTenantId: tenantOwnershipBackfillAudit.missing_tenant_id,
            conflictingProfiles: tenantOwnershipBackfillAudit.conflicting_profiles,
            updatedProfiles: tenantOwnershipBackfillAudit.updated_profiles,
            unresolvedConflictCount: tenantOwnershipBackfillAudit.unresolved_conflict_count,
        })
        .from(tenantOwnershipBackfillAudit)
        .orderBy(desc(tenantOwnershipBackfillAudit.started_at));
    const publicProfiles = await centralDb.execute(sql`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE role = 'super_admin')::int AS super_admins
        FROM public.profiles
    `);

    console.log(JSON.stringify({
        ...tenantReport,
        ownershipRepairAudit,
        publicControlPlaneProfiles: {
            ...publicProfiles[0],
            excludedFromTenantWorkspaces: true,
        },
    }, null, 2));

    process.exit(tenantReport.verified ? 0 : 1);
}

inspect().catch((error) => {
    console.error('[tenant-audit] Failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
