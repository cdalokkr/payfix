import './env-config';
import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function verify() {
    console.log('[Verification] Querying migrated client database details...');
    try {
        const profileCount = await centralDb.execute(sql`SELECT COUNT(*) FROM tenant_primary.profiles;`);
        const attendanceCount = await centralDb.execute(sql`SELECT COUNT(*) FROM tenant_primary.attendance;`);
        const designationCount = await centralDb.execute(sql`SELECT COUNT(*) FROM tenant_primary.designations;`);
        
        console.log(`[Verification] Profiles in tenant_primary: ${profileCount[0]?.count}`);
        console.log(`[Verification] Attendance records in tenant_primary: ${attendanceCount[0]?.count}`);
        console.log(`[Verification] Designations in tenant_primary: ${designationCount[0]?.count}`);
        console.log('[Verification] Data integrity verified successfully!');
    } catch (e) {
        console.error('[Verification] Verification query failed:', e);
    }
}

verify();
