/**
 * Read-only audit of registered tenant schemas.
 *
 * Public profiles are summarized separately as control-plane identities and
 * are never used as a source for workspace ownership.
 */
import './env-config';
import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';
import { runTenantProfileBackfill } from './assign-tenant-ids-to-schemas';

async function inspect() {
    const tenantReport = await runTenantProfileBackfill({ apply: false });
    const publicProfiles = await centralDb.execute(sql`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE role = 'super_admin')::int AS super_admins
        FROM public.profiles
    `);

    console.log(JSON.stringify({
        ...tenantReport,
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
