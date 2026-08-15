import '../scripts/env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function checkUserPhotos() {
    console.log('==================================================');
    console.log('Searching for aktestuser@testnet.in in all tenant schemas...');
    console.log('==================================================\n');

    try {
        const allTenants = await masterDb.query.tenants.findMany();

        for (const t of allTenants) {
            if (!t.tenant_schema) continue;

            try {
                const user = await centralDb.execute(sql`
                    SELECT id, email, full_name, avatar_url, face_photo_url, avatar_status,
                           face_embedding IS NOT NULL as has_128_vec,
                           face_embedding_512 IS NOT NULL as has_512_vec,
                           updated_at
                    FROM ${sql.raw(t.tenant_schema)}.profiles
                    WHERE email = 'aktestuser@testnet.in';
                `);

                if (user.length > 0) {
                    console.log(`📍 Found in Schema: ${t.tenant_schema} (Tenant: ${t.company_name} / ${t.slug})`);
                    console.log('Profile Data:');
                    console.log(JSON.stringify(user[0], null, 2));

                    // Check profile photo requests
                    const requests = await centralDb.execute(sql`
                        SELECT id, profile_id, pending_photo_url, status, created_at, reviewed_at
                        FROM ${sql.raw(t.tenant_schema)}.profile_photo_requests
                        WHERE profile_id = ${user[0].id}
                        ORDER BY created_at DESC;
                    `);

                    console.log(`\n📸 Profile Photo Requests (${requests.length} total):`);
                    console.log(JSON.stringify(requests, null, 2));
                }
            } catch (err: any) {
                // schema might not have tables
            }
        }
    } catch (err: any) {
        console.error('Error:', err);
    }
}

checkUserPhotos();
