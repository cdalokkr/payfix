import { tenantStorage } from '../lib/tenant/store';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const alphaContext = {
        tenantId: "a79d99cd-305f-45d6-9050-6952c02e94db",
        slug: "alpha",
        databaseUrl: null,
        tenantSchema: "tenant_alpha",
        brandName: "Alpha Corporation",
        trusted: true as const
    };

    await tenantStorage.run(alphaContext, async () => {
        try {
            const result = await db.execute(sql`
                SELECT id, email, avatar_url
                FROM profiles 
                WHERE email = 'alokkr@alphacorp.com';
            `);
            if (result && result.length > 0) {
                const user = result[0];
                console.log("Raw avatar_url:", user.avatar_url);
                console.log("Length:", user.avatar_url?.length);
                console.log("JSON:", JSON.stringify(user.avatar_url));
                console.log("Type:", typeof user.avatar_url);
            } else {
                console.log("User not found");
            }
        } catch (err: any) {
            console.error("Error:", err.message);
        }
    });
}

main().catch(console.error);
