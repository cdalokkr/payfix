import './env-config';
import { provisionTenant } from '../lib/tenant/provisioning';
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

async function run() {
    // Read parameters from env or fallback to defaults
    const slug = process.env.ONBOARD_SLUG || 'alpha'; // Target subdomain slug (e.g. alpha)
    const companyName = process.env.ONBOARD_COMPANY || 'Alpha Corporation';
    const adminEmail = process.env.ONBOARD_EMAIL || 'admin@alphacorp.com';
    const adminPassword = process.env.ONBOARD_PASSWORD || 'AlphaAdmin123!';

    console.log(`==================================================`);
    console.log(`[Onboarding] Starting onboarding for new tenant:`);
    console.log(`  Slug: ${slug}`);
    console.log(`  Company: ${companyName}`);
    console.log(`  Admin Email: ${adminEmail}`);
    console.log(`==================================================`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[Onboarding] Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Step 1: Provision the tenant database schema and registry
        console.log(`[Onboarding] Step 1: Provisioning tenant database schema and registry...`);
        const provisionResult = await provisionTenant(slug, companyName, adminEmail);
        console.log(`[Onboarding] Step 1 Complete: Schema ${provisionResult.schemaName} created and registered.`);

        // Step 2: Create Supabase Auth User
        console.log(`[Onboarding] Step 2: Creating Supabase auth user...`);
        
        // List users to check if user already exists
        const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            throw new Error(`Failed to list users: ${listError.message}`);
        }
        
        let userId: string;
        const existingUser = usersList.users.find(u => u.email === adminEmail);
        
        if (existingUser) {
            console.log(`[Onboarding] Auth user already exists with ID: ${existingUser.id}`);
            userId = existingUser.id;
        } else {
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: adminEmail,
                password: adminPassword,
                email_confirm: true,
                user_metadata: {
                    full_name: 'Administrator',
                    status: 'active'
                }
            });

            if (authError) {
                throw new Error(`Failed to create auth user: ${authError.message}`);
            }

            userId = authData.user.id;
            console.log(`[Onboarding] Auth user created successfully with ID: ${userId}`);
        }

        // Step 3: Insert the admin profile into the tenant schema
        console.log(`[Onboarding] Step 3: Creating admin profile inside tenant schema...`);
        
        // Find designation ID in the tenant schema
        const schemaName = provisionResult.schemaName;
        const designResult = await db.execute(sql`
            SELECT id FROM ${sql.raw(schemaName)}.designations 
            WHERE role = 'admin' LIMIT 1;
        `);
        
        const designationId = designResult[0]?.id;
        if (!designationId) {
            throw new Error(`Admin designation not found in tenant schema ${schemaName}`);
        }

        // Check if profile already exists in tenant schema
        const existingProfile = await db.execute(sql`
            SELECT id FROM ${sql.raw(schemaName)}.profiles 
            WHERE id = ${userId} LIMIT 1;
        `);

        if (existingProfile.length > 0) {
            console.log(`[Onboarding] Profile already exists in tenant schema.`);
        } else {
            await db.execute(sql`
                INSERT INTO ${sql.raw(schemaName)}.profiles (
                    id, email, full_name, role, status, designation_id, created_at, updated_at
                ) VALUES (
                    ${userId}, ${adminEmail}, 'Administrator', 'admin', 'active', ${designationId}, NOW(), NOW()
                );
            `);
            console.log(`[Onboarding] Admin profile created successfully in tenant schema.`);
        }

        console.log(`==================================================`);
        console.log(`🎉 TENANT ONBOARDED SUCCESSFULLY!`);
        console.log(`==================================================`);
        console.log(`To test this tenant:`);
        console.log(`1. Vercel Preview URL:`);
        console.log(`   https://payfix-git-develop-corebitdigital.vercel.app/?tenant=${slug}`);
        console.log(`2. Login Credentials:`);
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
        console.log(`==================================================`);
        process.exit(0);

    } catch (err: any) {
        console.error('[Onboarding] Error during onboarding:', err.message || err);
        process.exit(1);
    }
}

run();
