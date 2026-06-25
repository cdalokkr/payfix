import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('[Migration] Applying SQL migration file...');
    const sqlFilePath = path.resolve(process.cwd(), 'supabase/migrations/20260626000000_superadmin_license.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
        console.error('Migration SQL file not found at:', sqlFilePath);
        process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    try {
        await centralDb.execute(sql.raw(sqlContent));
        console.log('[Migration] SQL migration applied successfully!');
    } catch (error) {
        console.error('[Migration] Failed to apply migration:', error);
        process.exit(1);
    }
}

main();
