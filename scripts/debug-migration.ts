import './env-config';
import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function test() {
    try {
        console.log('[Debug] Testing copy for table: profiles...');
        await centralDb.execute(sql`
            INSERT INTO tenant_primary.profiles 
            SELECT * FROM public.profiles;
        `);
        console.log('[Debug] Copy succeeded!');
    } catch (err: any) {
        console.error('[Debug] Copy failed with error:', err);
    }
}

test();
