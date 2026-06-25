import { sql } from 'drizzle-orm';
import { masterDb } from '@/lib/db/master-connection';
import { tenants, tenantBranding } from '@/lib/db/master-schema';
import { centralDb } from '@/lib/db';

/**
 * Automates the dynamic schema provisioning for a new tenant.
 * 1. Generates and validates a clean database schema name.
 * 2. Creates the schema.
 * 3. Clones ALL business tables from public schema using LIKE ... INCLUDING ALL.
 * 4. Seeds the tenant database with default configurations.
 * 5. Creates the initial admin profile inside the tenant schema.
 * 6. Registers the tenant in the central control plane.
 *
 * IMPORTANT: All queries use explicit schema-qualified table names to avoid
 * SET search_path pollution on the shared connection pool.
 */
export async function provisionTenant(
    slug: string,
    companyName: string,
    adminEmail: string,
    trialDurationDays = 14,
    adminUserId?: string  // Optional: if auth user already created, pass ID to insert profile
) {
    // 1. Strict Alphanumeric Validation on the slug
    const safeSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (safeSlug.length < 3 || safeSlug.length > 30) {
        throw new Error('Tenant subdomain must be between 3 and 30 characters and alphanumeric.');
    }

    const schemaName = `tenant_${safeSlug.replace(/-/g, '_')}`;

    // Complete list of business tables from schema.ts — kept in dependency order
    // (referenced tables before referencing tables)
    const businessTables = [
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

    try {
        // 2. Create the schema
        console.log(`[Provisioning] Creating schema: ${schemaName}`);
        await centralDb.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(schemaName)};`);

        // 3. Clone table structures dynamically from public schema
        // Uses explicit schema-prefixed names — NO SET search_path (avoids connection pool poisoning)
        for (const table of businessTables) {
            const exists = await centralDb.execute(sql`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = ${table}
                );
            `);
            
            if (exists[0]?.exists) {
                console.log(`[Provisioning] Cloning table: ${schemaName}.${table}`);
                await centralDb.execute(sql`
                    CREATE TABLE IF NOT EXISTS ${sql.raw(schemaName)}.${sql.raw(table)} 
                    (LIKE public.${sql.raw(table)} INCLUDING ALL);
                `);
            } else {
                console.warn(`[Provisioning] Table public.${table} does not exist, skipping.`);
            }
        }

        // 4. Seed initial designations & office settings using explicit schema-qualified names
        console.log(`[Provisioning] Seeding default data into ${schemaName}...`);
        await centralDb.execute(sql`
            INSERT INTO ${sql.raw(schemaName)}.designations (name, description, role) 
            VALUES 
            ('Administrator', 'System Administrator with full access rights', 'admin'),
            ('Manager', 'Operations Manager / Department Supervisor', 'moderator'),
            ('Employee', 'Standard Staff Member', 'employee')
            ON CONFLICT DO NOTHING;
        `);

        await centralDb.execute(sql`
            INSERT INTO ${sql.raw(schemaName)}.office_settings (default_check_in, default_check_out, absent_deduction_multiplier) 
            VALUES ('10:00:00', '19:00:00', 1)
            ON CONFLICT DO NOTHING;
        `);

        // 5. Create admin profile if userId provided
        if (adminUserId) {
            console.log(`[Provisioning] Creating admin profile for user ${adminUserId}...`);
            const designResult = await centralDb.execute(sql`
                SELECT id FROM ${sql.raw(schemaName)}.designations 
                WHERE role = 'admin' LIMIT 1;
            `);
            
            const designationId = designResult[0]?.id;
            if (designationId) {
                await centralDb.execute(sql`
                    INSERT INTO ${sql.raw(schemaName)}.profiles (
                        id, email, full_name, role, status, designation_id, created_at, updated_at
                    ) VALUES (
                        ${adminUserId}, ${adminEmail}, 'Administrator', 'admin', 'active', 
                        ${designationId}, NOW(), NOW()
                    )
                    ON CONFLICT (id) DO NOTHING;
                `);
                console.log(`[Provisioning] Admin profile created in ${schemaName}.profiles`);
            } else {
                console.warn(`[Provisioning] Admin designation not found in ${schemaName} — profile not created.`);
            }
        }

        console.log(`[Provisioning] Schema ${schemaName} populated successfully.`);

        // 6. Register in Central Control Plane Table (public.tenants)
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialStart.getDate() + trialDurationDays);

        // We run these inserts on the masterDb (which maps to public central schema)
        const [newTenant] = await masterDb.insert(tenants).values({
            slug: safeSlug,
            company_name: companyName,
            tenant_schema: schemaName,
            status: 'trial',
            trial_start: trialStart,
            trial_end: trialEnd,
            trial_duration_days: trialDurationDays,
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

        console.log(`[Provisioning] Tenant ${safeSlug} successfully registered in control plane.`);
        
        return {
            success: true,
            tenantId: newTenant.id,
            schemaName,
            slug: safeSlug
        };

    } catch (err: any) {
        console.error(`[Provisioning] Failed to provision tenant ${safeSlug}:`, err);
        // Rollback schema if failed to avoid garbage schemas
        try {
            await centralDb.execute(sql`DROP SCHEMA IF EXISTS ${sql.raw(schemaName)} CASCADE;`);
            console.log(`[Provisioning] Rolled back schema ${schemaName}.`);
        } catch (rollbackErr) {
            console.error('[Provisioning] Schema rollback failed:', rollbackErr);
        }
        throw err;
    }
}
