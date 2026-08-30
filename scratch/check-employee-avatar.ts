import { tenantStorage } from '../lib/tenant/store';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const alphaContext = {
        tenantId: "a79d99cd-305f-45d6-9050-6952c02e94db",
        slug: "alpha",
        databaseUrl: null,
        tenantSchema: "tenant_alpha",
        brandName: "Alpha Corporation"
    };

    await tenantStorage.run(alphaContext, async () => {
        try {
            const employees = await db.execute(sql`
                SELECT id, email, full_name, role, avatar_url, sex, avatar_status 
                FROM profiles 
                WHERE email = 'alokkr@alphacorp.com';
            `);
            console.log("Employee Profile Details in DB:");
            console.table(employees);
        } catch (err: any) {
            console.error("Error querying profiles:", err.message);
        }
    });
}

main().catch(console.error);
