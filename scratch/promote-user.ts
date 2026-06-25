import { centralDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const email = 'srpadmin@saaskit.in';
    console.log(`Promoting ${email} to super_admin...`);
    
    // Update role in public.profiles
    const res = await centralDb.execute(sql`
        UPDATE public.profiles
        SET role = 'super_admin'
        WHERE email = ${email}
        RETURNING id, email, role, status;
    `);
    
    console.log("Update result:", res);
}

main().catch(console.error);
