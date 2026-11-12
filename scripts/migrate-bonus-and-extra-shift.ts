import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { centralDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('--- Applying Bonus & Extra Shift Schema Migration ---');
  try {
    const schemaRows = await centralDb.execute(sql`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    `);
    const schemas = schemaRows.map((r: any) => r.schema_name);
    console.log('Discovered schemas to update:', schemas);

    for (const s of schemas) {
      console.log(`\nMigrating schema: ${s}...`);

      // 1. monthly_bonuses table
      await centralDb.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS "${s}"."monthly_bonuses" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "profile_id" uuid NOT NULL REFERENCES "${s}"."profiles"("id") ON DELETE CASCADE,
            "month" integer NOT NULL,
            "year" integer NOT NULL,
            "amount" numeric(10, 2) NOT NULL DEFAULT '0',
            "bonus_type" text NOT NULL DEFAULT 'festival_bonus',
            "title" text NOT NULL DEFAULT 'Monthly Bonus',
            "remarks" text,
            "created_by" uuid REFERENCES "${s}"."profiles"("id") ON DELETE SET NULL,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now()
        );
      `));

      await centralDb.execute(sql.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS "monthly_bonuses_profile_month_year_title_idx" 
        ON "${s}"."monthly_bonuses" ("profile_id", "month", "year", "title");
      `));

      // 2. Add extra_shift_type to attendance
      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."attendance"
        ADD COLUMN IF NOT EXISTS "extra_shift_type" text;
      `));

      // 3. Add extra_shift_type to attendance_sessions
      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."attendance_sessions"
        ADD COLUMN IF NOT EXISTS "extra_shift_type" text;
      `));

      // 4. Add extra_shift_type to shift_roster
      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."shift_roster"
        ADD COLUMN IF NOT EXISTS "extra_shift_type" text;
      `));

      console.log(`Successfully migrated schema: ${s}`);
    }

    console.log('\n--- Bonus & Extra Shift Migration Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
