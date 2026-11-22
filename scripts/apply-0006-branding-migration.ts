import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { centralDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('--- Applying 0006 Branding Columns to tenant_branding ---');
  try {
    await centralDb.execute(sql.raw(`
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "company_legal_name" text;
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "company_address" text;
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "city" varchar(100);
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "state" varchar(100);
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "pincode" varchar(20);
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "country" varchar(100) DEFAULT 'India';
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "contact_email" text;
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "contact_phone" varchar(30);
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "website" text;
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "tax_id" varchar(50);
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "report_logo_height" integer DEFAULT 24;
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "report_logo_alignment" varchar(20) DEFAULT 'left';
      ALTER TABLE IF EXISTS "tenant_branding" ADD COLUMN IF NOT EXISTS "payslip_notes" text;
    `));
    console.log('✅ Successfully applied 0006 Branding columns to tenant_branding table!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to apply branding migration:', err);
    process.exit(1);
  }
}

main();
