import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function addColumns() {
    console.log('==================================================');
    console.log('[Migration] Adding face enrollment columns to profiles across all schemas...');
    console.log('==================================================\n');

    try {
        // 1. Add columns to public.profiles
        console.log('📦 Updating public.profiles table...');
        await centralDb.execute(sql`
            ALTER TABLE public.profiles 
            ADD COLUMN IF NOT EXISTS face_quality_score real,
            ADD COLUMN IF NOT EXISTS face_enrolled_at timestamptz,
            ADD COLUMN IF NOT EXISTS face_photo_url text;
        `);
        console.log('✅ public.profiles updated successfully.');

        // 2. Fetch all tenants from master database and update their schemas
        const allTenants = await masterDb.query.tenants.findMany();

        for (const t of allTenants) {
            const schemaName = t.tenant_schema || `tenant_${t.slug.replace(/-/g, '_')}`;

            try {
                const schemaCheck = await centralDb.execute(sql`
                    SELECT EXISTS (
                        SELECT FROM information_schema.schemata 
                        WHERE schema_name = ${schemaName}
                    );
                `);

                if (!schemaCheck[0]?.exists) continue;

                await centralDb.execute(sql`
                    ALTER TABLE ${sql.raw(schemaName)}.profiles 
                    ADD COLUMN IF NOT EXISTS face_quality_score real,
                    ADD COLUMN IF NOT EXISTS face_enrolled_at timestamptz,
                    ADD COLUMN IF NOT EXISTS face_photo_url text;
                `);

                console.log(`✅ ${schemaName}.profiles updated successfully.`);
            } catch (err: any) {
                console.warn(`⚠️ ${schemaName}.profiles warning:`, err.message || err);
            }
        }

        console.log('\n==================================================');
        console.log('[Migration] 100% Completed! All face enrollment columns added.');
        console.log('==================================================');
    } catch (err: any) {
        console.error('[Migration] Migration error:', err.message || err);
    }
}

addColumns();
