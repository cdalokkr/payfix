import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function syncFaceEmbeddingsToPublic() {
    console.log('==================================================');
    console.log('[Sync] Synchronizing face_embedding from tenant schemas to public.profiles...');
    console.log('==================================================\n');

    try {
        const allTenants = await masterDb.query.tenants.findMany();

        for (const t of allTenants) {
            console.log(`🔄 Syncing profiles for tenant: "${t.company_name}" (${t.tenant_schema})...`);

            try {
                // Perform direct Postgres SQL UPDATE joining public.profiles and tenant schema profiles
                const result = await centralDb.execute(sql`
                    UPDATE public.profiles p
                    SET face_embedding = tp.face_embedding,
                        face_quality_score = tp.face_quality_score,
                        face_enrolled_at = tp.face_enrolled_at,
                        face_photo_url = tp.face_photo_url,
                        tenant_id = ${t.id}::uuid
                    FROM ${sql.raw(t.tenant_schema)}.profiles tp
                    WHERE p.id = tp.id AND tp.face_embedding IS NOT NULL;
                `);

                console.log(`   ✅ Synced vectors for ${t.tenant_schema}.profiles.`);
            } catch (err: any) {
                console.warn(`   ⚠️ Warning for ${t.tenant_schema}:`, err.message || err);
            }
        }

        console.log('\n==================================================');
        console.log('[Sync] Verification Audit in public.profiles:');
        const pubProfiles = await centralDb.execute(sql`
            SELECT id, full_name, email, tenant_id,
                   face_embedding IS NOT NULL as has_vector,
                   length(face_embedding::text) as vec_len_chars
            FROM public.profiles;
        `);

        let enrolledTotal = 0;
        for (const p of pubProfiles) {
            if (p.has_vector) {
                enrolledTotal++;
                console.log(`   ✅ Enrolled in public.profiles: "${p.full_name || p.email}" | Tenant UUID: ${p.tenant_id}`);
            }
        }
        console.log(`\n👉 Total Central Profiles in public.profiles: ${pubProfiles.length} | Enrolled Vectors: ${enrolledTotal}`);
        console.log('==================================================');
    } catch (err: any) {
        console.error('Sync Error:', err.message || err);
    }
}

syncFaceEmbeddingsToPublic();
