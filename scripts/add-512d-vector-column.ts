import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function add512dVectorColumn() {
    console.log('==================================================');
    console.log('[Schema Migration] Adding face_embedding_512 column & HNSW index...');
    console.log('==================================================\n');

    try {
        const allTenants = await masterDb.query.tenants.findMany();

        // 1. Migrate public schema
        try {
            await centralDb.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
            await centralDb.execute(sql`
                ALTER TABLE IF EXISTS public.profiles 
                ADD COLUMN IF NOT EXISTS face_embedding_512 vector(512);

                ALTER TABLE IF EXISTS public.profile_photo_requests 
                ADD COLUMN IF NOT EXISTS pending_face_embedding_512 vector(512),
                ADD COLUMN IF NOT EXISTS pending_face_embedding vector(128);
            `);
            console.log('   ✅ public.profiles & public.profile_photo_requests columns added.');
        } catch (err: any) {
            console.warn('   ⚠️ Warning for public schema:', err.message || err);
        }

        // 2. Migrate each tenant schema
        for (const t of allTenants) {
            if (!t.tenant_schema) continue;
            console.log(`🔧 Migrating schema: ${t.tenant_schema}...`);

            try {
                // Add column if not exists
                await centralDb.execute(sql`
                    ALTER TABLE IF EXISTS ${sql.raw(t.tenant_schema)}.profiles 
                    ADD COLUMN IF NOT EXISTS face_embedding_512 vector(512);

                    ALTER TABLE IF EXISTS ${sql.raw(t.tenant_schema)}.profile_photo_requests
                    ADD COLUMN IF NOT EXISTS pending_face_embedding_512 vector(512),
                    ADD COLUMN IF NOT EXISTS pending_face_embedding vector(128);
                `);

                // Create HNSW Cosine Index for 512-d embeddings
                await centralDb.execute(sql`
                    DROP INDEX IF EXISTS ${sql.raw(t.tenant_schema)}.idx_${sql.raw(t.tenant_schema)}_face_embedding_512_hnsw;
                    
                    CREATE INDEX IF NOT EXISTS idx_face_embedding_512_hnsw_${sql.raw(t.slug.replace(/-/g, '_'))}
                    ON ${sql.raw(t.tenant_schema)}.profiles
                    USING hnsw (face_embedding_512 vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
                `);

                console.log(`   ✅ ${t.tenant_schema}.profiles & profile_photo_requests updated with 512-d vectors.`);
            } catch (err: any) {
                console.warn(`   ⚠️ Warning for ${t.tenant_schema}:`, err.message || err);
            }
        }

        console.log('\n==================================================');
        console.log('[Schema Migration Completed] All tenant schemas updated with face_embedding_512!');
        console.log('==================================================');
    } catch (err: any) {
        console.error('Migration Error:', err.message || err);
    }
}

add512dVectorColumn();
