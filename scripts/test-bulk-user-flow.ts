import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { db } from '../lib/db';
import { profiles } from '../lib/db/schema';
import { tenantStorage } from '../lib/tenant/store';
import { eq } from 'drizzle-orm';
import { createSupabaseAdminClient } from '../lib/auth/supabase-admin';

async function main() {
    console.log('--- Testing Bulk User Creation & Password Reset Logic ---');
    const tenantContext = {
        tenantId: 'c3e28d92-e3ea-4fe0-8efd-927ce550b666',
        slug: 'primary',
        databaseUrl: process.env.DATABASE_URL || null,
        tenantSchema: 'tenant_primary',
        brandName: 'PayFix Corporate',
        trusted: true
    };

    const supabaseAdmin = createSupabaseAdminClient();
    const testEmail = `test_bulk_${Date.now()}@payfix.internal`;
    const testMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    await tenantStorage.run(tenantContext, async () => {
        // 1. Create test auth user with #User@1234$ and must_change_password: true
        console.log(`1. Creating test auth user with default password #User@1234$...`);
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: testEmail,
            password: '#User@1234$',
            email_confirm: true,
            user_metadata: {
                full_name: 'Test Bulk Employee',
                status: 'active',
                must_change_password: true,
            }
        });

        if (authError || !authData?.user) {
            throw new Error(`Auth creation failed: ${authError?.message}`);
        }

        const userId = authData.user.id;
        console.log(`   ✅ Auth user created with ID: ${userId}`);

        // 2. Insert profile with must_change_password: true
        console.log(`2. Inserting profile into tenant_primary with must_change_password = true...`);
        const [inserted] = await db.insert(profiles).values({
            id: userId,
            tenant_id: tenantContext.tenantId,
            email: testEmail,
            first_name: 'Test',
            last_name: 'Bulk Employee',
            full_name: 'Test Bulk Employee',
            mobile_no: testMobile,
            date_of_birth: '1996-05-10',
            sex: 'male',
            role: 'employee',
            status: 'active',
            must_change_password: true,
        }).returning();

        console.log(`   ✅ Profile inserted. must_change_password is: ${inserted.must_change_password}`);
        if (inserted.must_change_password !== true) {
            throw new Error('must_change_password should be true!');
        }

        // 3. Simulate first-time password setup (reset)
        console.log(`3. Simulating first-time password setup (new personal password)...`);
        await db.update(profiles).set({
            must_change_password: false,
            updated_at: new Date()
        }).where(eq(profiles.id, userId));

        const updated = await db.query.profiles.findFirst({
            where: eq(profiles.id, userId),
            columns: { id: true, must_change_password: true }
        });

        console.log(`   ✅ Updated profile. must_change_password is now: ${updated?.must_change_password}`);
        if (updated?.must_change_password !== false) {
            throw new Error('must_change_password should now be false!');
        }

        // 4. Cleanup test user
        console.log(`4. Cleaning up test user...`);
        await db.delete(profiles).where(eq(profiles.id, userId));
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log(`   ✅ Test user cleaned up cleanly.`);
    });

    console.log('\n--- Bulk User & Password Reset Test PASSED! ---');
    process.exit(0);
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
