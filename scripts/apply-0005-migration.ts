import { centralDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('--- Applying 0005 Migration ---');
  try {
    // 1. Get all schemas (public and tenant_*)
    const schemaRows = await centralDb.execute(sql`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    `);
    const schemas = schemaRows.map((r: any) => r.schema_name);
    console.log('Discovered schemas to update:', schemas);

    for (const s of schemas) {
      console.log(`\nMigrating schema: ${s}...`);

      // Departments table
      await centralDb.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS "${s}"."departments" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" text NOT NULL,
            "code" varchar(20),
            "description" text,
            "manager_id" uuid,
            "location_id" uuid,
            "is_active" boolean DEFAULT true,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now()
        );
      `));

      // Add department_id to designations
      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."designations"
        ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "${s}"."departments"("id") ON DELETE SET NULL;
      `));

      // Add department_id to profiles & drop not null on email
      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."profiles"
        ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "${s}"."departments"("id") ON DELETE SET NULL;
      `));

      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."profiles"
        ALTER COLUMN "email" DROP NOT NULL;
      `));

      await centralDb.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS "idx_${s}_profiles_mobile_no" ON "${s}"."profiles" ("mobile_no");
      `));

      // office_shifts table
      await centralDb.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS "${s}"."office_shifts" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "location_id" uuid,
            "department_id" uuid REFERENCES "${s}"."departments"("id") ON DELETE SET NULL,
            "name" text NOT NULL,
            "code" varchar(20),
            "start_time" text NOT NULL,
            "end_time" text NOT NULL,
            "duration_hours" numeric(4, 2) NOT NULL DEFAULT 8.00,
            "is_overnight" boolean DEFAULT false,
            "buffer_minutes" integer NOT NULL DEFAULT 15,
            "break_minutes" integer DEFAULT 0,
            "min_half_day_hours" numeric DEFAULT 4.0,
            "min_full_day_hours" numeric DEFAULT 8.0,
            "is_default" boolean DEFAULT false,
            "color" text DEFAULT '#3b82f6',
            "is_active" boolean DEFAULT true,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now()
        );
      `));

      // employee_shift_assignments table
      await centralDb.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS "${s}"."employee_shift_assignments" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "profile_id" uuid NOT NULL REFERENCES "${s}"."profiles"("id") ON DELETE CASCADE,
            "location_id" uuid,
            "duty_hours" numeric(4, 2) NOT NULL DEFAULT 8.00,
            "shift_mode" text NOT NULL DEFAULT 'default',
            "assigned_shift_ids" jsonb DEFAULT '[]'::jsonb,
            "rotation_type" text DEFAULT 'none',
            "rotation_shift_ids" jsonb DEFAULT '[]'::jsonb,
            "rotation_start_date" date,
            "effective_from" date DEFAULT CURRENT_DATE,
            "effective_to" date,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now()
        );
      `));

      // shift_roster table
      await centralDb.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS "${s}"."shift_roster" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "profile_id" uuid NOT NULL REFERENCES "${s}"."profiles"("id") ON DELETE CASCADE,
            "department_id" uuid REFERENCES "${s}"."departments"("id") ON DELETE CASCADE,
            "shift_id" uuid REFERENCES "${s}"."office_shifts"("id") ON DELETE SET NULL,
            "date" date NOT NULL,
            "status" text NOT NULL DEFAULT 'scheduled',
            "is_extra_shift" boolean DEFAULT false,
            "notes" text,
            "allotted_by" uuid REFERENCES "${s}"."profiles"("id") ON DELETE SET NULL,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now()
        );
      `));

      // attendance table columns
      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."attendance"
        ADD COLUMN IF NOT EXISTS "shift_id" uuid REFERENCES "${s}"."office_shifts"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "shift_name" text,
        ADD COLUMN IF NOT EXISTS "duty_hours" numeric,
        ADD COLUMN IF NOT EXISTS "extra_hours" numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "is_extra_shift" boolean DEFAULT false;
      `));

      // attendance_sessions table columns
      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."attendance_sessions"
        ADD COLUMN IF NOT EXISTS "shift_id" uuid REFERENCES "${s}"."office_shifts"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "is_extra_shift" boolean DEFAULT false;
      `));

      console.log(`Schema ${s} successfully migrated.`);
    }

    console.log('\n--- Migration Completed Successfully ---');
  } catch (err) {
    console.error('Migration error:', err);
  }
  process.exit(0);
}

runMigration();
