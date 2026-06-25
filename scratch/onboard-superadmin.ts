import { centralDb } from '../lib/db';
import { masterDb } from '../lib/db/master-connection';
import { tenants } from '../lib/db/master-schema';
import { sql } from 'drizzle-orm';

async function main() {
    console.log("--- TENANTS REGISTRY ---");
    const registeredTenants = await masterDb.select().from(tenants);
    console.table(registeredTenants.map(t => ({
        id: t.id,
        slug: t.slug,
        company: t.company_name,
        status: t.status,
        expires: t.license_expires_at?.toISOString()
    })));

    console.log("\n--- PUBLIC PROFILES (Central DB) ---");
    try {
        const publicProfiles = await centralDb.execute(sql`
            SELECT id, email, full_name, role, status 
            FROM public.profiles;
        `);
        console.table(publicProfiles);
    } catch (e: any) {
        console.log("No profiles in public schema or failed to query:", e.message);
    }

    console.log("\n--- TENANT ALPHA PROFILES ---");
    try {
        const alphaProfiles = await centralDb.execute(sql`
            SELECT id, email, full_name, role, status 
            FROM tenant_alpha.profiles;
        `);
        console.table(alphaProfiles);
    } catch (e: any) {
        console.log("No profiles in tenant_alpha schema or failed to query:", e.message);
    }
}

main().catch(console.error);
