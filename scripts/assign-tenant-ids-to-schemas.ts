import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function syncAllSchemas() {
    console.log('==================================================');
    console.log('[Schema Multi-Tenant Sync] Synchronizing tenant_id across all Tenant Schemas...');
    console.log('==================================================\n');

    try {
        const allTenants = await masterDb.query.tenants.findMany();

        for (const t of allTenants) {
            const schemaName = t.tenant_schema || `tenant_${t.slug.replace(/-/g, '_')}`;

            try {
                // Check if schema exists
                const schemaCheck = await centralDb.execute(sql`
                    SELECT EXISTS (
                        SELECT FROM information_schema.schemata 
                        WHERE schema_name = ${schemaName}
                    );
                `);

                if (!schemaCheck[0]?.exists) continue;

                // Add tenant_id column if not exists in tenant schema profiles
                await centralDb.execute(sql`
                    ALTER TABLE ${sql.raw(schemaName)}.profiles 
                    ADD COLUMN IF NOT EXISTS tenant_id uuid;
                `);

                // Update tenant_id for all profiles inside tenant schema
                await centralDb.execute(sql`
                    UPDATE ${sql.raw(schemaName)}.profiles 
                    SET tenant_id = ${t.id}::uuid 
                    WHERE tenant_id IS NULL OR tenant_id != ${t.id}::uuid;
                `);

                const countRes = await centralDb.execute(sql`
                    SELECT COUNT(*)::int as count FROM ${sql.raw(schemaName)}.profiles;
                `);

                console.log(`✅ [${t.company_name}] (${schemaName}) ➔ Updated tenant_id = ${t.id} for ${countRes[0]?.count || 0} profiles.`);
            } catch (err: any) {
                console.warn(`⚠️ [${t.company_name}] (${schemaName}) ➔ ${err.message}`);
            }
        }

        console.log('\n==================================================');
        console.log('[Schema Multi-Tenant Sync] 100% Completed!');
        console.log('==================================================');
    } catch (err: any) {
        console.error('Sync Error:', err.message || err);
    }
}

syncAllSchemas();
