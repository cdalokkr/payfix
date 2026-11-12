import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { db } from '../lib/db';
import { tenantStorage } from '../lib/tenant/store';
import { sql } from 'drizzle-orm';

async function main() {
    const tenantContext = {
        tenantId: 'c3e28d92-e3ea-4fe0-8efd-927ce550b666',
        slug: 'primary',
        databaseUrl: process.env.DATABASE_URL || null,
        tenantSchema: 'tenant_primary',
        brandName: 'PayFix Corporate',
        trusted: true
    };

    await tenantStorage.run(tenantContext, async () => {
        const rows = await db.execute(sql`
            SELECT a.*, p.full_name, p.email
            FROM attendance a
            JOIN profiles p ON p.id = a.profile_id
            WHERE a.date = '2026-11-04' AND p.email ILIKE '%aktestuser%'
        `);
        console.log('--- ATTENDANCE RECORD ---');
        console.dir(rows, { depth: null });

        const sessions = await db.execute(sql`
            SELECT s.*
            FROM attendance_sessions s
            JOIN attendance a ON a.id = s.attendance_id
            JOIN profiles p ON p.id = a.profile_id
            WHERE a.date = '2026-11-04' AND p.email ILIKE '%aktestuser%'
        `);
        console.log('--- SESSIONS ---');
        console.dir(sessions, { depth: null });
    });

    process.exit(0);
}

main().catch(console.error);
