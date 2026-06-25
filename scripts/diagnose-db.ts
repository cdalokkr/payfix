import './env-config';
import { masterDb } from '../lib/db/master-connection';
import { tenants } from '../lib/db/master-schema';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function run() {
    console.log('=== DATABASE DIAGNOSIS ===');

    try {
        // 1. List all tenants in public.tenants
        const allTenants = await masterDb.select().from(tenants);
        console.log('\n--- Tenants registered in central registry:');
        console.table(allTenants.map(t => ({
            id: t.id,
            slug: t.slug,
            company_name: t.company_name,
            tenant_schema: t.tenant_schema,
            status: t.status,
            admin_email: t.admin_email
        })));

        // 2. Inspect tenant_alpha profiles
        try {
            const alphaProfiles = await db.execute(sql`
                SELECT id, email, full_name, role, status FROM tenant_alpha.profiles;
            `);
            console.log('\n--- Profiles in tenant_alpha schema:');
            console.table(alphaProfiles);
        } catch (e: any) {
            console.error('Error querying tenant_alpha.profiles:', e.message);
        }

        // 3. Inspect public.profiles (old schema/central)
        try {
            const publicProfiles = await db.execute(sql`
                SELECT id, email, full_name, role, status FROM public.profiles;
            `);
            console.log('\n--- Profiles in public (central) schema:');
            console.table(publicProfiles.slice(0, 10)); // Show top 10
            console.log(`(Total profiles in public: ${publicProfiles.length})`);
        } catch (e: any) {
            console.error('Error querying public.profiles:', e.message);
        }

    } catch (err: any) {
        console.error('Diagnosis failed:', err.message || err);
    }

    process.exit(0);
}

run();
