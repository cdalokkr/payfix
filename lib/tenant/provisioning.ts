import { masterDb } from '@/lib/db/master-connection';
import { tenants, tenantBranding } from '@/lib/db/master-schema';
import { db } from '@/lib/db'; // Central Connection
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

/**
 * Automates the dynamic schema provisioning for a new tenant.
 * 1. Generates and validates a clean database schema name.
 * 2. Creates the schema.
 * 3. Reads and sanitizes the setup-fresh-db.sql script, stripping the 'public.' schema prefixes.
 * 4. Runs the SQL scripts inside the new schema to compile all tables, constraints, and indexes.
 * 5. Seeds the tenant database with default configurations.
 */
export async function provisionTenant(slug: string, companyName: string, adminEmail: string, trialDurationDays = 14) {
    // 1. Strict Alphanumeric Validation on the slug
    const safeSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (safeSlug.length < 3 || safeSlug.length > 30) {
        throw new Error('Tenant subdomain must be between 3 and 30 characters and alphanumeric.');
    }

    const schemaName = `tenant_${safeSlug.replace(/-/g, '_')}`;

    try {
        // 2. Create the schema
        console.log(`[Provisioning] Creating schema: ${schemaName}`);
        await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(schemaName)};`);

        // 3. Clone table structures dynamically from public schema
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
            'complaints',
            'support_tickets',
            'ticket_messages',
            'call_logs',
            'salary_slips',
            'salary_templates'
        ];

        for (const table of tables) {
            const exists = await db.execute(sql`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = ${table}
                );
            `);
            
            if (exists[0]?.exists) {
                await db.execute(sql`
                    CREATE TABLE IF NOT EXISTS ${sql.raw(schemaName)}.${sql.raw(table)} 
                    (LIKE public.${sql.raw(table)} INCLUDING ALL);
                `);
            }
        }

        // 4. Seed initial designations & office settings in the new schema
        await db.execute(sql`SET search_path TO ${sql.raw(schemaName)};`);
        await db.execute(sql`
            INSERT INTO designations (name, description, role) 
            VALUES 
            ('Administrator', 'System Administrator with full access rights', 'admin'),
            ('Manager', 'Operations Manager / Department Supervisor', 'moderator'),
            ('Employee', 'Standard Staff Member', 'employee')
            ON CONFLICT DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO office_settings (default_check_in, default_check_out, absent_deduction_multiplier) 
            VALUES ('10:00:00', '19:00:00', 1)
            ON CONFLICT DO NOTHING;
        `);

        console.log(`[Provisioning] Schema ${schemaName} populated successfully.`);

        // 5. Register in Central Control Plane Table (public.tenants)
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
            await db.execute(sql`DROP SCHEMA IF EXISTS ${db.raw(schemaName)} CASCADE;`);
        } catch (rollbackErr) {
            console.error('[Provisioning] Schema rollback failed:', rollbackErr);
        }
        throw err;
    }
}

// Helper to construct raw SQL statements safely inside drizzle-orm
import { sql } from 'drizzle-orm';
