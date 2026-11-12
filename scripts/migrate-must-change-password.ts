import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { centralDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('--- Applying must_change_password Migration ---');
  try {
    const schemaRows = await centralDb.execute(sql`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    `);
    const schemas = schemaRows.map((r: any) => r.schema_name);
    console.log('Discovered schemas to update:', schemas);

    for (const s of schemas) {
      console.log(`Migrating schema: ${s}...`);

      await centralDb.execute(sql.raw(`
        ALTER TABLE IF EXISTS "${s}"."profiles"
        ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false;
      `));

      console.log(`✅ Completed ${s}`);
    }

    console.log('\n--- Migration completed successfully! ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
