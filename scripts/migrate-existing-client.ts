import './env-config';
import { masterDb } from '../lib/db/master-connection';
import { tenants, tenantBranding } from '../lib/db/master-schema';
import { centralDb } from '../lib/db/index';
import { sql, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function run() {
    const slug = process.env.MIGRATION_CLIENT_SLUG || 'primary'; // Target subdomain
    const companyName = process.env.MIGRATION_CLIENT_COMPANY || 'PayFix Corporate';
    const adminEmail = process.env.MIGRATION_CLIENT_EMAIL || 'admin@payfix.com';
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    console.log(`[Migration] Starting migration of existing client data to schema: ${schemaName}`);

    try {
        // Delete existing central records for tenant to allow clean re-run
        const existingTenant = await masterDb.query.tenants.findFirst({
            where: eq(tenants.slug, slug)
        });
        if (existingTenant) {
            console.log(`[Migration] Deleting existing central records for tenant: ${slug}`);
            await masterDb.delete(tenants).where(eq(tenants.slug, slug));
        }

        // 1. Drop existing schema for a clean run, then create
        await centralDb.execute(sql`DROP SCHEMA IF EXISTS ${sql.raw(schemaName)} CASCADE;`);
        await centralDb.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(schemaName)};`);
        console.log(`[Migration] Schema ${schemaName} created.`);

        // 2. Clone table structures dynamically from public schema
        // Complete list matching schema.ts — dependency order (referenced tables first)
        const tables = [
            'designations',
            'profiles',
            'activities',
            'attendance',
            'leaves',
            'notifications',
            'user_status_history',
            'analytics_metrics',
            'office_settings',
            'office_closures',
            'employee_settings',
            'biometric_devices',
            'office_locations',
            'user_mpin',
            'push_subscriptions',
            'profile_photo_requests',
            'employee_salary_setup',
            'employee_advances',
            'monthly_attendance_summary',
            'clients',
            'complaints',
            'tickets',
            'ticket_assignments',
            'ticket_resolutions',
            'call_logs',
            'salary_payments',
        ];

        for (const table of tables) {
            try {
                // Verify if table exists in public schema first
                const exists = await centralDb.execute(sql`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = ${table}
                    );
                `);
                
                if (exists[0]?.exists) {
                    console.log(`[Migration] Cloning table structure for: ${table}...`);
                    await centralDb.execute(sql`
                        CREATE TABLE IF NOT EXISTS ${sql.raw(schemaName)}.${sql.raw(table)} 
                        (LIKE public.${sql.raw(table)} INCLUDING ALL);
                    `);
                }
            } catch (err: any) {
                console.error(`[Migration] Error cloning structure for table ${table}:`, err.message);
            }
        }
        console.log(`[Migration] Table structures cloned into ${schemaName}.`);

        for (const table of tables) {
            try {
                // Verify if table exists in public schema first
                const exists = await centralDb.execute(sql`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = ${table}
                    );
                `);
                
                if (exists[0]?.exists) {
                    console.log(`[Migration] Copying data for table: ${table}...`);
                    // Copy data from public table into the tenant schema table
                    await centralDb.execute(sql`
                        INSERT INTO ${sql.raw(schemaName)}.${sql.raw(table)} 
                        SELECT * FROM public.${sql.raw(table)};
                    `);
                    console.log(`[Migration] Table ${table} data copied successfully.`);
                } else {
                    console.log(`[Migration] Table ${table} does not exist in public schema, skipping.`);
                }
            } catch (err: any) {
                console.error(`[Migration] Error copying table ${table}:`, err.message);
            }
        }

        // 4. Register the tenant in central registry
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setFullYear(trialStart.getFullYear() + 10); // 10 years active status

        const [newTenant] = await masterDb.insert(tenants).values({
            slug,
            company_name: companyName,
            tenant_schema: schemaName,
            status: 'active', // Keep active
            trial_start: trialStart,
            trial_end: trialEnd,
            trial_duration_days: 365 * 10,
            admin_email: adminEmail,
            license_expires_at: trialEnd,
        }).returning();

        // Register default branding settings
        await masterDb.insert(tenantBranding).values({
            tenant_id: newTenant.id,
            app_name: companyName,
            short_name: companyName.substring(0, 15),
            primary_color: '#4f46e5',
            secondary_color: '#0f172a',
            accent_color: '#f59e0b',
            background_color: '#020617',
            theme_color: '#020617',
        });

        console.log(`[Migration] Existing client successfully registered in control plane with slug: ${slug}`);
        console.log(`[Migration] Migration completed successfully!`);

    } catch (error) {
        console.error('[Migration] Migration failed:', error);
    }
}

run();
