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

    // Cross-schema scan function: finds a user profile across ALL active tenant schemas
    // in a single database call. Used by proxy middleware when profile isn't found in
    // the current tenant context (e.g., new tenant signup logging in from localhost/Vercel).
    const createScanFunctionSql = `
        CREATE OR REPLACE FUNCTION public.find_profile_across_schemas(target_user_id UUID)
        RETURNS JSONB AS $$
        DECLARE
            tenant_rec RECORD;
            result JSONB;
        BEGIN
            FOR tenant_rec IN 
                SELECT tenant_schema, slug FROM public.tenants 
                WHERE tenant_schema IS NOT NULL AND status IN ('active', 'trial')
            LOOP
                BEGIN
                    EXECUTE format('
                        SELECT json_build_object(
                            ''id'', p.id,
                            ''email'', p.email,
                            ''full_name'', p.full_name,
                            ''role'', p.role,
                            ''status'', p.status,
                            ''designation_id'', p.designation_id,
                            ''avatar_url'', p.avatar_url,
                            ''first_name'', p.first_name,
                            ''last_name'', p.last_name,
                            ''mobile_no'', p.mobile_no,
                            ''allowed_modules'', p.allowed_modules,
                            ''tenant_schema'', %L,
                            ''tenant_slug'', %L,
                            ''designation'', (
                                SELECT json_build_object(
                                    ''id'', d.id,
                                    ''name'', d.name,
                                    ''description'', d.description,
                                    ''role'', d.role
                                ) FROM %I.designations d WHERE d.id = p.designation_id LIMIT 1
                            )
                        ) FROM %I.profiles p WHERE p.id = $1 LIMIT 1
                    ', tenant_rec.tenant_schema, tenant_rec.slug, tenant_rec.tenant_schema, tenant_rec.tenant_schema)
                    USING target_user_id INTO result;

                    IF result IS NOT NULL THEN
                        RETURN result;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    -- Skip schemas with errors (e.g., missing tables)
                    CONTINUE;
                END;
            END LOOP;

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    try {
        await centralDb.execute(sql.raw(createFunctionSql));
        console.log('🎉 [RPC Setup] get_profile_from_schema function created successfully!');

        await centralDb.execute(sql.raw(createScanFunctionSql));
        console.log('🎉 [RPC Setup] find_profile_across_schemas function created successfully!');

        process.exit(0);
    } catch (err: any) {
        console.error('[RPC Setup] Error creating function:', err.message || err);
        process.exit(1);
    }
}

run();

