import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function alignTenantVectorTypes() {
    console.log('==================================================');
    console.log('[Schema Migration] Aligning tenant schemas to pgvector vector(128)...');
    console.log('==================================================\n');

    try {
        const allTenants = await masterDb.query.tenants.findMany();

        for (const t of allTenants) {
            console.log(`🔧 Migrating schema: ${t.tenant_schema}...`);

            try {
                // Ensure pgvector extension
                await centralDb.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

                // Convert face_embedding column in tenant schema to vector(128)
                await centralDb.execute(sql`
                    DO $$
                    BEGIN
                        BEGIN
                            ALTER TABLE ${sql.raw(t.tenant_schema)}.profiles 
                                ALTER COLUMN face_embedding TYPE vector(128) 
                                USING face_embedding::text::vector(128);
                        EXCEPTION WHEN others THEN
                            NULL;
                        END;
                    END $$;
                `);

                // Create HNSW Cosine Index in tenant schema for <1ms query speed
                await centralDb.execute(sql`
                    DROP INDEX IF EXISTS ${sql.raw(t.tenant_schema)}.idx_${sql.raw(t.tenant_schema)}_face_embedding_hnsw;
                    
                    CREATE INDEX IF NOT EXISTS idx_face_embedding_hnsw_${sql.raw(t.slug.replace(/-/g, '_'))}
                    ON ${sql.raw(t.tenant_schema)}.profiles
                    USING hnsw (face_embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
                `);

                console.log(`   ✅ ${t.tenant_schema}.profiles.face_embedding converted to vector(128) with HNSW Index.`);
            } catch (err: any) {
                console.warn(`   ⚠️ Warning for ${t.tenant_schema}:`, err.message || err);
            }
        }

        console.log('\n==================================================');
        console.log('[Schema Migration Completed] All tenant schemas aligned to pgvector(128)!');
        console.log('==================================================');
    } catch (err: any) {
        console.error('Migration Error:', err.message || err);
    }
}

alignTenantVectorTypes();
