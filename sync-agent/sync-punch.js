const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkbbybkeatrtdbqfurtc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYmJ5YmtlYXRydGRicWZ1cnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzNDgyNCwiZXhwIjoyMDgzNzEwODI0fQ.lAA8KBHLLTVNdFFGFxS3ycJdcrkCE5LC-S9bDDOfcH4';
const CLOUD_API_URL = process.env.CLOUD_API_URL || process.env.PAYFIX_CLOUD_URL || process.env.LOCAL_API_URL || 'http://localhost:3000/api/biometric/sync';
const API_KEY = process.env.BIOMETRIC_API_KEY || 'bfx_live_timewatch_primary_2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getArg(flag) {
    const idx = process.argv.indexOf(flag);
    return idx !== -1 && idx < process.argv.length - 1 ? process.argv[idx + 1] : null;
}

const userId = getArg('--userId') || '80';
const timestamp = getArg('--timestamp') || new Date().toISOString();
const punchType = parseInt(getArg('--punchType') || '0', 10);
const deviceSerial = getArg('--deviceSerial') || 'TIPL596270523057';

async function main() {
    console.log(`[sync-punch] Processing punch: User ${userId}, Device ${deviceSerial}, Time ${timestamp}, Type ${punchType}`);

    // 1. Try PayFix Cloud / Local REST API (updates attendance_sessions, daily attendance + biometric_raw_logs)
    try {
        const res = await axios.post(CLOUD_API_URL, {
            deviceId: deviceSerial,
            logs: [{ userId: String(userId), timestamp: new Date(timestamp).toISOString(), punchType }]
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        if (res.data?.success) {
            console.log(`[sync-punch] Successfully synced via PayFix API:`, res.data.message);
            return;
        }
    } catch (apiErr) {
        console.warn(`[sync-punch] Primary Cloud API call failed (${apiErr.message}). Falling back to Supabase direct sync.`);
    }

    // 2. Direct Supabase Fallback
    try {
        const { data: settings } = await supabase
            .from('employee_settings')
            .select('profile_id')
            .eq('biometric_device_user_id', String(userId))
            .maybeSingle();

        const profileId = settings?.profile_id || null;

        await supabase.from('biometric_raw_logs').insert({
            profile_id: profileId,
            biometric_user_id: String(userId),
            device_id: deviceSerial,
            punch_time: new Date(timestamp).toISOString(),
            punch_type: punchType,
            raw_payload: { source: 'timewatch-direct-service', userId, timestamp, deviceSerial }
        });

        console.log(`[sync-punch] Punch saved to Supabase biometric_raw_logs for User ${userId} (Profile: ${profileId || 'Unmapped'}).`);
    } catch (dbErr) {
        console.error(`[sync-punch] Error during direct Supabase write:`, dbErr.message);
    }
}

main().catch(console.error);
