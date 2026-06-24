import './env-config';
import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function run() {
    console.log('[RPC Setup] Creating get_profile_from_schema helper function in public schema...');

    const createFunctionSql = `
        CREATE OR REPLACE FUNCTION public.get_profile_from_schema(schema_name TEXT, user_id UUID)
        RETURNS JSONB AS $$
        DECLARE
            result JSONB;
        BEGIN
            -- Securely execute dynamic query to retrieve profile with nested designation from the specified schema
            EXECUTE format('
                SELECT json_build_object(
                    ''id'', p.id,
                    ''email'', p.email,
                    ''full_name'', p.full_name,
                    ''role'', p.role,
                    ''status'', p.status,
                    ''designation_id'', p.designation_id,
                    ''designation'', (
                        SELECT json_build_object(
                            ''id'', d.id,
                            ''name'', d.name,
                            ''description'', d.description,
                            ''role'', d.role
                        ) FROM %I.designations d WHERE d.id = p.designation_id LIMIT 1
                    )
                ) FROM %I.profiles p WHERE p.id = $1 LIMIT 1
            ', schema_name, schema_name) USING user_id INTO result;
            
            RETURN result;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    try {
        await centralDb.execute(sql.raw(createFunctionSql));
        console.log('🎉 [RPC Setup] get_profile_from_schema function created successfully!');
        process.exit(0);
    } catch (err: any) {
        console.error('[RPC Setup] Error creating function:', err.message || err);
        process.exit(1);
    }
}

run();
