import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { sql } from 'drizzle-orm';

async function diagnose() {
    console.log('==================================================');
    console.log('[Kiosk & Biometric Diagnostics] Deep System Audit');
    console.log('==================================================\n');

    try {
        const allTenants = await masterDb.query.tenants.findMany();
        console.log(`📋 Total Tenants in Master DB: ${allTenants.length}\n`);

        for (const t of allTenants) {
            console.log(`🏢 Tenant: "${t.company_name}" (Slug: ${t.slug}, Schema: ${t.tenant_schema}, UUID: ${t.id})`);

            // Check kiosk_devices in tenant schema
            try {
                const devices = await centralDb.execute(sql`
                    SELECT id, device_name, pairing_code, is_active, last_active_at
                    FROM ${sql.raw(t.tenant_schema)}.kiosk_devices;
                `);
                console.log(`   📱 Paired Devices in ${t.tenant_schema}.kiosk_devices: ${devices.length}`);
                for (const d of devices) {
                    console.log(`      • Device: "${d.device_name}" | Pairing Code: "${d.pairing_code}" | Active: ${d.is_active}`);
                }
            } catch (e: any) {
                console.log(`   📱 ${t.tenant_schema}.kiosk_devices: table not present or empty (${e.message})`);
            }

            // Check profiles & face_embedding in tenant schema
            try {
                const profilesData = await centralDb.execute(sql`
                    SELECT id, full_name, email, 
                           face_embedding IS NOT NULL as has_vector,
                           length(face_embedding::text) as vec_len_chars
                    FROM ${sql.raw(t.tenant_schema)}.profiles;
                `);
                let enrolledCount = 0;
                for (const p of profilesData) {
                    if (p.has_vector) enrolledCount++;
                }
                console.log(`   👥 Total Profiles in ${t.tenant_schema}: ${profilesData.length} | Face Enrolled: ${enrolledCount}`);
                for (const p of profilesData) {
                    if (p.has_vector) {
                        console.log(`      ✅ Enrolled: "${p.full_name || p.email}" (id: ${p.id})`);
                    }
                }
            } catch (e: any) {
                console.log(`   👥 ${t.tenant_schema}.profiles: error (${e.message})`);
            }

            console.log('');
        }

        // Check public.profiles
        console.log('--------------------------------------------------');
        console.log('📊 Central public.profiles Table Audit:');
        const pubProf = await centralDb.execute(sql`
            SELECT id, full_name, email, tenant_id,
                   face_embedding IS NOT NULL as has_vector,
                   length(face_embedding::text) as vec_len_chars
            FROM public.profiles;
        `);
        let pubEnrolled = 0;
        for (const p of pubProf) {
            if (p.has_vector) pubEnrolled++;
        }
        console.log(`👉 Total Central Profiles in public.profiles: ${pubProf.length} | Enrolled Vectors: ${pubEnrolled}`);
        for (const p of pubProf) {
            console.log(`   • ${p.full_name || p.email} | Tenant UUID: ${p.tenant_id} | Enrolled: ${p.has_vector ? 'YES ✅' : 'NO ❌'}`);
        }

    } catch (err: any) {
        console.error('Audit Error:', err.message || err);
    }
}

diagnose();
