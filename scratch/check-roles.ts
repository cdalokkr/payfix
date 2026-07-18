import '../scripts/env-config';
import { centralDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const email = 'srpadmin@saaskit.in';
    console.log(`Checking profiles for ${email}...`);

    // Check public.profiles
    const publicProfile = await centralDb.execute(sql`
        SELECT 'public' as source, id, email, role, status FROM public.profiles WHERE email = ${email};
    `);
    console.log("Public schema profile:", publicProfile);

    // List all schemas
    const schemasResult = await centralDb.execute(sql`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%';
    `);

    for (const row of schemasResult) {
        const schema = row.schema_name as string;
        try {
            const tenantProfile = await centralDb.execute(sql`
                SELECT ${schema} as source, id, email, role, status FROM ${sql.raw(schema)}.profiles WHERE email = ${email};
            `);
            if (tenantProfile.length > 0) {
                console.log(`Schema ${schema} profile:`, tenantProfile);
            }
        } catch (e) {
            // Table might not exist or other error
        }
    }
}

main().catch(console.error);
