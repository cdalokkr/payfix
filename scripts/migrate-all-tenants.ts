/**
 * scripts/migrate-all-tenants.ts
 *
 * Run this script once to apply missing tables/columns to ALL existing tenant schemas.
 * Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS.
 *
 * Usage:
 *   npx tsx scripts/migrate-all-tenants.ts
 *
 * What it does per tenant schema:
 *  1. CREATE TABLE IF NOT EXISTS profile_photo_requests
 *  2. ALTER TABLE profiles ADD COLUMN IF NOT EXISTS face_embedding real[]
 *  3. CREATE TABLE IF NOT EXISTS attendance_sessions
 *  4. CREATE TABLE IF NOT EXISTS biometric_raw_logs
 *  5. ALTER TABLE attendance ADD COLUMN IF NOT EXISTS (multi-session columns)
 *  6. Add kiosk to attendance_source enum
 *  7. ALTER TABLE employee_settings ADD COLUMN IF NOT EXISTS face_vector
 */

import { config } from 'dotenv'
import { resolve } from 'path'
// Load .env.local (Next.js convention) for tsx scripts run outside Next.js
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })
import { sql } from 'drizzle-orm'
import { masterDb } from '../lib/db/master-connection'
import { centralDb } from '../lib/db'
import { tenants } from '../lib/db/master-schema'

async function migrateAllTenants() {
    console.log('\n========================================')
    console.log('  PayFix — All-Tenant Schema Migration')
    console.log('========================================\n')

    // 1. Fetch all tenants from master control plane
    const allTenants = await masterDb.select({
        id: tenants.id,
        slug: tenants.slug,
        company_name: tenants.company_name,
        tenant_schema: tenants.tenant_schema,
        status: tenants.status,
    }).from(tenants)

    if (allTenants.length === 0) {
        console.log('No tenants found in master DB. Exiting.')
        process.exit(0)
    }

    console.log(`Found ${allTenants.length} tenant(s):\n`)
    allTenants.forEach(t => {
        console.log(`  • [${t.status}] ${t.company_name} (schema: ${t.tenant_schema})`)
    })
    console.log('')

    let successCount = 0
    let errorCount = 0

    for (const tenant of allTenants) {
        const schema = tenant.tenant_schema
        if (!schema) {
            console.warn(`  ⚠️  ${tenant.company_name}: No schema name — skipping.`)
            continue
        }

        console.log(`\n─────────────────────────────────────`)
        console.log(`Migrating: ${tenant.company_name} → schema: ${schema}`)

        try {
            // ── 1. profile_photo_requests table ──────────────────────────────────
            await centralDb.execute(sql`
                CREATE TABLE IF NOT EXISTS ${sql.raw(schema)}.profile_photo_requests (
                    "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "profile_id"        uuid NOT NULL REFERENCES ${sql.raw(schema)}.profiles("id") ON DELETE CASCADE,
                    "pending_photo_url" text NOT NULL,
                    "status"            text NOT NULL DEFAULT 'pending',
                    "reviewed_by"       uuid REFERENCES ${sql.raw(schema)}.profiles("id") ON DELETE SET NULL,
                    "reviewed_at"       timestamp with time zone,
                    "rejection_reason"  text,
                    "created_at"        timestamp with time zone DEFAULT now()
                );
            `)
            console.log('  ✅ profile_photo_requests table — OK')

            // ── 2. profiles.face_embedding column ────────────────────────────────
            await centralDb.execute(sql`
                ALTER TABLE IF EXISTS ${sql.raw(schema)}.profiles
                    ADD COLUMN IF NOT EXISTS "face_embedding" real[];
            `)
            console.log('  ✅ profiles.face_embedding column — OK')

            // ── 3. attendance_sessions table ──────────────────────────────────────
            await centralDb.execute(sql`
                CREATE TABLE IF NOT EXISTS ${sql.raw(schema)}.attendance_sessions (
                    "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "attendance_id"             uuid REFERENCES ${sql.raw(schema)}.attendance("id") ON DELETE CASCADE,
                    "profile_id"                uuid NOT NULL REFERENCES ${sql.raw(schema)}.profiles("id") ON DELETE CASCADE,
                    "date"                      date NOT NULL,
                    "session_number"            integer NOT NULL DEFAULT 1,
                    "check_in"                  timestamp with time zone NOT NULL,
                    "check_out"                 timestamp with time zone,
                    "working_hours"             numeric,
                    "source"                    text DEFAULT 'mobile',
                    "device_id"                 text,
                    "location_id"               uuid,
                    "selfie_url"                text,
                    "checkin_latitude"          numeric(10, 7),
                    "checkin_longitude"         numeric(10, 7),
                    "checkin_location_name"     text,
                    "checkout_latitude"         numeric(10, 7),
                    "checkout_longitude"        numeric(10, 7),
                    "checkout_location_name"    text,
                    "status"                    text NOT NULL DEFAULT 'active',
                    "created_at"                timestamp with time zone DEFAULT now(),
                    "updated_at"                timestamp with time zone DEFAULT now()
                );
            `)
            console.log('  ✅ attendance_sessions table — OK')

            // ── 4. biometric_raw_logs table ───────────────────────────────────────
            await centralDb.execute(sql`
                CREATE TABLE IF NOT EXISTS ${sql.raw(schema)}.biometric_raw_logs (
                    "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "profile_id"        uuid REFERENCES ${sql.raw(schema)}.profiles("id") ON DELETE SET NULL,
                    "biometric_user_id" text NOT NULL,
                    "device_id"         text,
                    "location_id"       uuid,
                    "punch_time"        timestamp with time zone NOT NULL,
                    "punch_type"        integer,
                    "raw_payload"       jsonb,
                    "created_at"        timestamp with time zone DEFAULT now()
                );
            `)
            console.log('  ✅ biometric_raw_logs table — OK')

            // ── 5. attendance multi-session columns ───────────────────────────────
            await centralDb.execute(sql`
                ALTER TABLE IF EXISTS ${sql.raw(schema)}.attendance
                    ADD COLUMN IF NOT EXISTS "first_check_in"           timestamp with time zone,
                    ADD COLUMN IF NOT EXISTS "last_check_out"            timestamp with time zone,
                    ADD COLUMN IF NOT EXISTS "total_sessions"            integer DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "current_session_status"    text DEFAULT 'checked_out',
                    ADD COLUMN IF NOT EXISTS "location_id"               uuid;
            `)
            console.log('  ✅ attendance multi-session columns — OK')

            // ── 6. attendance_source enum kiosk value ─────────────────────────────
            try {
                await centralDb.execute(sql`
                    DO $$
                    BEGIN
                        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
                            ALTER TYPE "attendance_source" ADD VALUE IF NOT EXISTS 'kiosk';
                        ELSE
                            CREATE TYPE "attendance_source" AS ENUM ('mobile', 'biometric', 'manual', 'bulk', 'kiosk');
                        END IF;
                    END $$;
                `)
                console.log('  ✅ attendance_source enum kiosk value — OK')
            } catch (e) {
                console.log('  ⚠️  attendance_source enum — already up to date or skipped')
            }

            // ── 7. employee_settings.face_vector column ───────────────────────────
            await centralDb.execute(sql`
                ALTER TABLE IF EXISTS ${sql.raw(schema)}.employee_settings
                    ADD COLUMN IF NOT EXISTS "face_vector" jsonb,
                    ADD COLUMN IF NOT EXISTS "biometric_device_user_id" text;
            `)
            console.log('  ✅ employee_settings.face_vector column — OK')

            // ── 8. kiosk_devices table ──────────────────────────────────────────────
            await centralDb.execute(sql`
                CREATE TABLE IF NOT EXISTS ${sql.raw(schema)}.kiosk_devices (
                    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "name"          text NOT NULL,
                    "pairing_code"  text NOT NULL UNIQUE,
                    "credential_hash" text,
                    "credential_expires_at" timestamp with time zone,
                    "location_id"   uuid REFERENCES ${sql.raw(schema)}.office_locations("id") ON DELETE SET NULL,
                    "is_active"     boolean DEFAULT true,
                    "last_seen_at"  timestamp with time zone,
                    "created_by"    uuid REFERENCES ${sql.raw(schema)}.profiles("id") ON DELETE SET NULL,
                    "created_at"    timestamp with time zone DEFAULT now(),
                    "updated_at"    timestamp with time zone DEFAULT now()
                );
            `)
            await centralDb.execute(sql`
                ALTER TABLE IF EXISTS ${sql.raw(schema)}.kiosk_devices
                    ADD COLUMN IF NOT EXISTS "credential_hash" text,
                    ADD COLUMN IF NOT EXISTS "credential_expires_at" timestamp with time zone;
            `)
            console.log('  ✅ kiosk_devices table — OK')

            console.log(`  ✓  ${tenant.company_name} — Migration Complete!`)
            successCount++

        } catch (err: any) {
            console.error(`  ❌ ${tenant.company_name} — ERROR: ${err.message}`)
            errorCount++
        }
    }

    console.log('\n========================================')
    console.log(`Migration Done!`)
    console.log(`  ✅ Success : ${successCount} tenant(s)`)
    if (errorCount > 0) {
        console.log(`  ❌ Errors  : ${errorCount} tenant(s)`)
    }
    console.log('========================================\n')

    process.exit(errorCount > 0 ? 1 : 0)
}

migrateAllTenants().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
