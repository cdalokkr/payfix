import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function inspect() {
    console.log('==================================================');
    console.log('[Tenant Audit] Complete Audit of Registered Tenants & Employees');
    console.log('==================================================\n');

    try {
        // 1. Fetch all tenants from master database
        const allTenants = await masterDb.query.tenants.findMany();
        console.log(`📋 Total Registered Tenants: ${allTenants.length}\n`);

        const tenantMap = new Map<string, any>();
        for (const t of allTenants) {
            tenantMap.set(t.id, t);
            console.log(`🏢 [Tenant ID: ${t.id}]`);
            console.log(`   • Company Name : "${t.company_name}"`);
            console.log(`   • Subdomain Slug: "${t.slug}"`);
            console.log(`   • Schema Name   : "${t.tenant_schema || 'tenant_' + t.slug}"`);
            console.log(`   • Admin Email   : "${t.admin_email}"`);
            console.log(`   • Status        : ${t.status}`);

            // Check employees in tenant-specific schema if exists
            const schemaName = t.tenant_schema || `tenant_${t.slug.replace(/-/g, '_')}`;
            try {
                const schemaCheck = await centralDb.execute(sql`
                    SELECT EXISTS (
                        SELECT FROM information_schema.schemata 
                        WHERE schema_name = ${schemaName}
                    );
                `);

                if (schemaCheck[0]?.exists) {
                    const empCountRes = await centralDb.execute(sql`
                        SELECT COUNT(*)::int as count FROM ${sql.raw(schemaName)}.profiles;
                    `);
                    const count = empCountRes[0]?.count || 0;
                    console.log(`   • Schema Profile Count (${schemaName}.profiles): ${count}`);

                    // Also assign tenant_id to profiles inside that schema if missing
                    if (count > 0) {
                        await centralDb.execute(sql`
                            UPDATE ${sql.raw(schemaName)}.profiles 
                            SET tenant_id = ${t.id}::uuid 
                            WHERE tenant_id IS NULL;
                        `);
                    }
                }
            } catch (err: any) {
                console.log(`   • Schema Check: ${err.message || 'No custom schema'}`);
            }
            console.log('---');
        }

        console.log('\n==================================================');
        console.log('[Tenant Audit] Checking public.profiles table...');
        console.log('==================================================');

        const publicProfiles = await centralDb.execute(sql`
            SELECT id, full_name, email, role, tenant_id
            FROM public.profiles;
        `);

        console.log(`📋 Total Profiles in public.profiles: ${publicProfiles.length}`);
        for (const p of publicProfiles) {
            const tenantInfo = p.tenant_id ? tenantMap.get(p.tenant_id) : null;
            const companyName = tenantInfo ? tenantInfo.company_name : (p.tenant_id ? 'Unknown Tenant' : 'UNASSIGNED');
            console.log(`   • [${p.role}] ${p.full_name || 'No Name'} (${p.email}) ➔ Company: "${companyName}" (Tenant ID: ${p.tenant_id || 'NULL'})`);
        }

        console.log('==================================================');
    } catch (err: any) {
        console.error('[Tenant Audit] Audit Error:', err.message || err);
    }
}

inspect();
