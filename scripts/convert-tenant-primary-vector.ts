import './env-config';
import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function convertPrimary() {
    console.log('==================================================');
    console.log('[Migration] Converting tenant_primary.profiles.face_embedding to vector(128)...');
    console.log('==================================================\n');

    try {
        await centralDb.execute(sql`
            ALTER TABLE tenant_primary.profiles 
            ALTER COLUMN face_embedding TYPE vector(128) 
            USING (
                CASE 
                    WHEN face_embedding IS NULL THEN NULL 
                    ELSE ('[' || array_to_string(face_embedding, ',') || ']')::vector(128) 
                END
            );
        `);

        await centralDb.execute(sql`
            DROP INDEX IF EXISTS tenant_primary.idx_tenant_primary_face_embedding_hnsw;

            CREATE INDEX idx_tenant_primary_face_embedding_hnsw
            ON tenant_primary.profiles
            USING hnsw (face_embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        `);

        console.log('✅ tenant_primary.profiles.face_embedding successfully converted to vector(128) with HNSW Index!');

        const cols = await centralDb.execute(sql`
            SELECT table_schema, table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'tenant_primary' 
              AND table_name = 'profiles' 
              AND column_name = 'face_embedding';
        `);

        for (const col of cols) {
            console.log(`📊 Updated Datatype: Schema=${col.table_schema} | Column=${col.column_name} | Data Type=${col.data_type} | UDT Name=${col.udt_name}`);
        }

    } catch (err: any) {
        console.error('Migration error:', err.message || err);
    }
}

convertPrimary();
