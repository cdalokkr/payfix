import './env-config';
import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function run() {
    console.log('[Setup] Setting up Master Control Plane tables in the public schema...');

    try {
        // 1. Create tenant_plans table
        await centralDb.execute(sql`
            CREATE TABLE IF NOT EXISTS public.tenant_plans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                price_monthly NUMERIC(10, 2),
                max_employees INTEGER DEFAULT 10 NOT NULL,
                max_storage_gb INTEGER DEFAULT 1 NOT NULL,
                features JSONB DEFAULT '{}'::jsonb NOT NULL,
                is_active BOOLEAN DEFAULT true NOT NULL
            );
        `);
        console.log('[Setup] Table public.tenant_plans verified/created.');

        // 2. Create tenants table
        await centralDb.execute(sql`
            CREATE TABLE IF NOT EXISTS public.tenants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                slug VARCHAR(63) NOT NULL UNIQUE,
                company_name TEXT NOT NULL,
                custom_domain TEXT UNIQUE,
                status TEXT DEFAULT 'trial' NOT NULL CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
                tenant_schema VARCHAR(63) UNIQUE,
                database_url TEXT,
                biometric_api_key TEXT UNIQUE,
                trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                trial_end TIMESTAMP WITH TIME ZONE NOT NULL,
                trial_duration_days INTEGER DEFAULT 14 NOT NULL,
                trial_extended BOOLEAN DEFAULT false NOT NULL,
                plan_id UUID REFERENCES public.tenant_plans(id) ON DELETE SET NULL,
                admin_email TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('[Setup] Table public.tenants verified/created.');

        // 3. Create tenant_branding table
        await centralDb.execute(sql`
            CREATE TABLE IF NOT EXISTS public.tenant_branding (
                tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
                app_name TEXT DEFAULT 'PayFix' NOT NULL,
                short_name TEXT DEFAULT 'PayFix',
                tagline TEXT,
                primary_color VARCHAR(7) DEFAULT '#4f46e5' NOT NULL,
                secondary_color VARCHAR(7) DEFAULT '#0f172a' NOT NULL,
                accent_color VARCHAR(7) DEFAULT '#f59e0b' NOT NULL,
                background_color VARCHAR(7) DEFAULT '#020617' NOT NULL,
                theme_color VARCHAR(7) DEFAULT '#020617' NOT NULL,
                logo_url TEXT,
                favicon_url TEXT,
                splash_url TEXT,
                pwa_display TEXT DEFAULT 'standalone' NOT NULL,
                pwa_orientation TEXT DEFAULT 'portrait' NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('[Setup] Table public.tenant_branding verified/created.');

        // 4. Create trial_tracking table
        await centralDb.execute(sql`
            CREATE TABLE IF NOT EXISTS public.trial_tracking (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                fingerprint TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('[Setup] Table public.trial_tracking verified/created.');

        // 5. Seed default plans
        const planExists = await centralDb.execute(sql`SELECT EXISTS (SELECT 1 FROM public.tenant_plans WHERE name = 'starter');`);
        if (!planExists[0]?.exists) {
            await centralDb.execute(sql`
                INSERT INTO public.tenant_plans (name, display_name, price_monthly, max_employees, max_storage_gb, features)
                VALUES 
                ('starter', 'Starter Plan', 19.00, 15, 2, '{"biometric": false, "geofencing": true, "payroll": false}'::jsonb),
                ('professional', 'Professional Plan', 49.00, 50, 10, '{"biometric": true, "geofencing": true, "payroll": true}'::jsonb),
                ('enterprise', 'Enterprise Plan', 149.00, 500, 100, '{"biometric": true, "geofencing": true, "payroll": true, "analytics": true}'::jsonb);
            `);
            console.log('[Setup] Default plans seeded.');
        }

        console.log('[Setup] Master Control Plane setup complete!');
    } catch (error) {
        console.error('[Setup] Failed to create master tables:', error);
    }
}

run();
