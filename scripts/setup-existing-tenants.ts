import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { tenants } from '../lib/db/master-schema';
import { sql, eq } from 'drizzle-orm';

async function main() {
    console.log('--------------------------------------------------');
    console.log('[Tenant Setup] Starting automatic tenant ID assignment for existing profiles...');
    console.log('--------------------------------------------------');

    try {
        // 1. Fetch or create primary default tenant
        let primaryTenant = await masterDb.query.tenants.findFirst({
            where: eq(tenants.slug, 'primary')
        });

        if (!primaryTenant) {
            console.log('[Tenant Setup] Primary tenant record not found. Creating primary tenant...');
            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setFullYear(trialStart.getFullYear() + 10);

            const [created] = await masterDb.insert(tenants).values({
                slug: 'primary',
                company_name: 'PayFix Corporate',
                tenant_schema: 'tenant_primary',
                status: 'active',
                trial_start: trialStart,
                trial_end: trialEnd,
                trial_duration_days: 3650,
                admin_email: 'admin@payfix.com',
                license_expires_at: trialEnd,
            }).returning();
            primaryTenant = created;
            console.log(`[Tenant Setup] Primary tenant created with ID: ${primaryTenant.id}`);
        } else {
            console.log(`[Tenant Setup] Found existing primary tenant ID: ${primaryTenant.id}`);
        }

        const tenantId = primaryTenant.id;

        // 2. Count profiles missing tenant_id
        const missingCountRes = await centralDb.execute(sql`
            SELECT COUNT(*)::int as count 
            FROM public.profiles 
            WHERE tenant_id IS NULL;
        `);
        const missingCount = missingCountRes[0]?.count || 0;

        console.log(`[Tenant Setup] Found ${missingCount} profiles without tenant_id.`);

        if (missingCount > 0) {
            // 3. Update profiles missing tenant_id
            await centralDb.execute(sql`
                UPDATE public.profiles 
                SET tenant_id = ${tenantId}::uuid 
                WHERE tenant_id IS NULL;
            `);
            console.log(`[Tenant Setup] ✅ Successfully updated ${missingCount} employee profiles with tenant_id: ${tenantId}`);
        } else {
            console.log('[Tenant Setup] ✅ All employee profiles already have valid tenant_id assigned!');
        }

        // 4. Verify updated state
        const totalProfilesRes = await centralDb.execute(sql`
            SELECT COUNT(*)::int as total,
                   COUNT(tenant_id)::int as assigned 
            FROM public.profiles;
        `);
        const stats = totalProfilesRes[0] || { total: 0, assigned: 0 };
        console.log(`[Tenant Setup] Verification Summary: Total Profiles: ${stats.total} | Assigned tenant_id: ${stats.assigned}`);
        console.log('--------------------------------------------------');

    } catch (err: any) {
        console.error('[Tenant Setup] Error during tenant setup script:', err.message || err);
    }
}

main();
