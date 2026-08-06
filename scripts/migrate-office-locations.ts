import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { centralDb } from '../lib/db'
import { sql } from 'drizzle-orm'

async function migrateOfficeLocations() {
    console.log('=== 1. Fetching all active tenant schemas ===')
    const schemasRes = await centralDb.execute(sql`
        SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';
    `)

    for (const row of schemasRes) {
        const schemaName = (row as any).schema_name
        console.log(`\nEnsuring office_locations table in schema: [${schemaName}]...`)

        // 1. Create office_locations table in tenant schema if not exists
        await centralDb.execute(sql`
            CREATE TABLE IF NOT EXISTS ${sql.raw(schemaName)}.office_locations (
                "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name"          text NOT NULL,
                "address"       text,
                "latitude"      numeric(10, 7) NOT NULL,
                "longitude"     numeric(10, 7) NOT NULL,
                "radius_meters" integer NOT NULL DEFAULT 200,
                "is_active"     boolean DEFAULT true,
                "created_by"    uuid REFERENCES ${sql.raw(schemaName)}.profiles("id") ON DELETE SET NULL,
                "created_at"    timestamp with time zone DEFAULT now(),
                "updated_at"    timestamp with time zone DEFAULT now()
            );
        `)
        console.log(`  ✅ office_locations table verified in ${schemaName}`)
    }

    // 2. Copy locations from public.office_locations to tenant_primary.office_locations
    console.log('\n=== 2. Copying public.office_locations -> tenant_primary.office_locations ===')
    try {
        const publicLocs = await centralDb.execute(sql`
            SELECT * FROM public.office_locations;
        `)

        for (const loc of publicLocs) {
            const l = loc as any
            await centralDb.execute(sql`
                INSERT INTO tenant_primary.office_locations (
                    id, name, address, latitude, longitude, radius_meters, is_active, created_at, updated_at
                ) VALUES (
                    ${l.id}, ${l.name}, ${l.address || null}, ${l.latitude}, ${l.longitude},
                    ${l.radius_meters || 200}, ${l.is_active ?? true}, ${l.created_at || new Date()}, ${l.updated_at || new Date()}
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    address = EXCLUDED.address,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    radius_meters = EXCLUDED.radius_meters,
                    is_active = EXCLUDED.is_active;
            `)
        }
        console.log(`  ✅ Copied ${publicLocs.length} office location(s) to tenant_primary.office_locations!`)
    } catch (err: any) {
        console.error('Error copying locations:', err.message)
    }

    // 3. Verify tenant_primary.office_locations
    const verifyPrimary = await centralDb.execute(sql`
        SELECT id, name, latitude, longitude, radius_meters FROM tenant_primary.office_locations;
    `)
    console.log('\n=== 3. Verification of tenant_primary.office_locations ===')
    console.log(`Found ${verifyPrimary.length} location(s) in tenant_primary:`, verifyPrimary)

    process.exit(0)
}

migrateOfficeLocations()
