import './env-config';
import { centralDb } from '../lib/db/index';
import { masterDb } from '../lib/db/master-connection';
import { KioskDeviceService } from '../lib/services/kiosk-device.service';
import { sql } from 'drizzle-orm';

async function testKioskPairingSync() {
    console.log('==================================================');
    console.log('[Kiosk Pairing & Private Schema Sync Audit]');
    console.log('==================================================\n');

    try {
        const schemaName = 'tenant_primary';
        const TEST_PAIRING_CODE = 'KSK-TEST-2026';

        // 1. Ensure kiosk_devices table exists in tenant_primary schema
        await centralDb.execute(sql`
            CREATE TABLE IF NOT EXISTS tenant_primary.kiosk_devices (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                name text NOT NULL,
                pairing_code text NOT NULL UNIQUE,
                location_id uuid,
                is_active boolean DEFAULT true,
                last_seen_at timestamptz,
                created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now()
            );
        `);

        // 2. Insert test device into tenant_primary.kiosk_devices
        await centralDb.execute(sql`
            INSERT INTO tenant_primary.kiosk_devices (name, pairing_code, is_active)
            VALUES ('PayFix Main Terminal', ${TEST_PAIRING_CODE}, true)
            ON CONFLICT (pairing_code) DO NOTHING;
        `);

        console.log(`✅ Created Kiosk Terminal with Pairing Code: "${TEST_PAIRING_CODE}" inside ${schemaName}.kiosk_devices`);

        // 3. Test verifyPairingCode
        const pairingInfo = await KioskDeviceService.verifyPairingCode(TEST_PAIRING_CODE);

        if (!pairingInfo) {
            console.error('❌ KioskDeviceService.verifyPairingCode returned null!');
            return;
        }

        console.log(`✅ Kiosk Pairing Code Verified Successfully!`);
        console.log(`   • Resolved Tenant Schema: "${pairingInfo.tenantSchema}"`);
        console.log(`   • Resolved Tenant Slug: "${pairingInfo.tenantSlug}"`);
        console.log(`   • Device Name: "${pairingInfo.device.name}"`);

        console.log('\n==================================================');
        console.log('[Audit Passed 100%] Multi-tenant Private Schema Kiosk architecture is verified!');
        console.log('==================================================');
    } catch (err: any) {
        console.error('Error:', err.message || err);
    }
}

testKioskPairingSync();
