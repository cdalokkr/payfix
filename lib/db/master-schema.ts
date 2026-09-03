import { pgSchema, pgTable, uuid, text, timestamp, integer, boolean, numeric, jsonb, varchar } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = ['trial', 'active', 'suspended', 'cancelled'] as const;

export const tenantPlans = pgTable('tenant_plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),              // 'starter' | 'professional' | 'enterprise'
    display_name: text('display_name').notNull(),
    price_monthly: numeric('price_monthly', { precision: 10, scale: 2 }),
    
    // Hard limits
    max_employees: integer('max_employees').default(10).notNull(),
    max_moderators: integer('max_moderators').default(2).notNull(), 
    max_storage_gb: integer('max_storage_gb').default(1).notNull(),
    
    // Feature flags enabled on this tier (e.g. { biometric: true, geofencing: true })
    features: jsonb('features').default({}).notNull(),
    is_active: boolean('is_active').default(true).notNull(),
});

export const tenants = pgTable('tenants', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 63 }).notNull().unique(), // Subdomain prefix, e.g. "acme"
    company_name: text('company_name').notNull(),
    custom_domain: text('custom_domain').unique(),           // e.g. "hr.acme.com"
    status: text('status').notNull().default('trial'),       // pending_setup | trial | active | suspended | cancelled
    
    // Database credentials/routing:
    // If databaseUrl is null, connection falls back to Central Shared DB targeting the specific schema
    tenant_schema: varchar('tenant_schema', { length: 63 }).unique(), 
    database_url: text('database_url'), // Encrypted connection URL for enterprise tenants
    
    // Biometric device integration key specific to this workspace
    biometric_api_key: text('biometric_api_key').unique(),
    
    // Trial Tracking
    trial_start: timestamp('trial_start', { withTimezone: true }).defaultNow().notNull(),
    trial_end: timestamp('trial_end', { withTimezone: true }).notNull(),
    trial_duration_days: integer('trial_duration_days').default(14).notNull(),
    trial_extended: boolean('trial_extended').default(false).notNull(),
    
    plan_id: uuid('plan_id').references(() => tenantPlans.id),
    max_employees_override: integer('max_employees_override'),
    max_moderators_override: integer('max_moderators_override'),
    license_expires_at: timestamp('license_expires_at', { withTimezone: true }).notNull(),
    admin_email: text('admin_email').notNull(),
    country: text('country'),
    industry: text('industry'),
    team_size: varchar('team_size', { length: 50 }),
    
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const tenantBranding = pgTable('tenant_branding', {
    tenant_id: uuid('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
    app_name: text('app_name').notNull().default('PayFix'),
    short_name: text('short_name').default('PayFix'),
    tagline: text('tagline'),
    
    // CSS Brand Variables
    primary_color: varchar('primary_color', { length: 7 }).default('#4f46e5').notNull(),
    secondary_color: varchar('secondary_color', { length: 7 }).default('#0f172a').notNull(),
    accent_color: varchar('accent_color', { length: 7 }).default('#f59e0b').notNull(),
    background_color: varchar('background_color', { length: 7 }).default('#020617').notNull(),
    theme_color: varchar('theme_color', { length: 7 }).default('#020617').notNull(),
    
    // White-Label Assets (Supabase Storage bucket URLs)
    logo_url: text('logo_url'),
    favicon_url: text('favicon_url'),
    splash_url: text('splash_url'),
    
    pwa_display: text('pwa_display').default('standalone').notNull(),
    pwa_orientation: text('pwa_orientation').default('portrait').notNull(),
    
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const trialTracking = pgTable('trial_tracking', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    event_type: text('event_type').notNull(), // 'started' | 'expiring' | 'expired' | 'abuse_attempt'
    ip_address: varchar('ip_address', { length: 45 }),
    user_agent: text('user_agent'),
    fingerprint: text('fingerprint'), // Canvas / WebGL browser fingerprint hash
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/**
 * Internal, redacted audit records for tenant ownership repairs.
 *
 * This intentionally lives outside public so ownership maintenance cannot
 * become another control-plane profile data path. Access is limited by the
 * payfix_internal schema grants in its migration.
 */
export const payfixInternal = pgSchema('payfix_internal');

export const tenantOwnershipBackfillAudit = payfixInternal.table('tenant_ownership_backfill_audit', {
    id: uuid('id').primaryKey().defaultRandom(),
    run_id: uuid('run_id').notNull(),
    tenant_id: uuid('tenant_id').notNull(),
    tenant_schema: varchar('tenant_schema', { length: 63 }),
    started_at: timestamp('started_at', { withTimezone: true }).notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }).notNull(),
    mode: text('mode').notNull(),
    status: text('status').notNull(),
    total_profiles: integer('total_profiles').notNull(),
    matching_profiles: integer('matching_profiles').notNull(),
    missing_tenant_id: integer('missing_tenant_id').notNull(),
    conflicting_profiles: integer('conflicting_profiles').notNull(),
    updated_profiles: integer('updated_profiles').notNull(),
    unresolved_conflict_count: integer('unresolved_conflict_count').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
