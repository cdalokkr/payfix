import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function inspectVectorDataTypes() {
    console.log('==================================================');
    console.log('[Supabase Vector Datatype Inspection] Checking all schemas...');
    console.log('==================================================\n');

    try {
        const allTenants = await masterDb.query.tenants.findMany();

        // 1. Inspect public.profiles
        console.log('📊 Central Table: public.profiles');
        const pubCols = await centralDb.execute(sql`
            SELECT table_schema, table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = 'profiles' 
              AND column_name IN ('face_embedding', 'face_vector');
        `);

        for (const col of pubCols) {
            console.log(`   • Schema: ${col.table_schema} | Column: ${col.column_name} | Data Type: ${col.data_type} | UDT Name: ${col.udt_name}`);
        }
        console.log('\n--------------------------------------------------');

        // 2. Inspect tenant schemas
        for (const t of allTenants) {
            console.log(`🏢 Tenant: "${t.company_name}" (Schema: ${t.tenant_schema})`);

            try {
                const tenantCols = await centralDb.execute(sql`
                    SELECT table_schema, table_name, column_name, data_type, udt_name
                    FROM information_schema.columns
                    WHERE table_schema = ${t.tenant_schema}
                      AND table_name = 'profiles'
                      AND column_name IN ('face_embedding', 'face_vector');
                `);

                if (tenantCols.length === 0) {
                    console.log(`   ⚠️ No face_embedding / face_vector column found in ${t.tenant_schema}.profiles`);
                } else {
                    for (const col of tenantCols) {
                        console.log(`   ✅ Schema: ${col.table_schema} | Column: ${col.column_name} | Data Type: ${col.data_type} | UDT Name: ${col.udt_name}`);
                    }
                }
            } catch (err: any) {
                console.warn(`   ⚠️ Error querying ${t.tenant_schema}:`, err.message || err);
            }
            console.log('');
        }

        console.log('==================================================');
        console.log('[Supabase Vector Datatype Inspection Completed]');
        console.log('==================================================');
    } catch (err: any) {
        console.error('Inspection Error:', err.message || err);
    }
}

inspectVectorDataTypes();
