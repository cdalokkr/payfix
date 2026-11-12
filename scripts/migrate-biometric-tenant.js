const postgres = require('postgres');

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in environment');
  }

  const sql = postgres(dbUrl, { max: 1 });
  console.log('Connected to Postgres database via postgres library.');

  // 1. Add tenant_id to biometric_devices
  await sql`
    ALTER TABLE biometric_devices 
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  `;
  console.log('Added tenant_id column to biometric_devices.');

  // 2. Set existing devices to primary tenant
  const updateRes = await sql`
    UPDATE biometric_devices 
    SET tenant_id = 'c3e28d92-e3ea-4fe0-8efd-927ce550b666' 
    WHERE tenant_id IS NULL;
  `;
  console.log(`Updated ${updateRes.count} existing devices with primary tenant_id.`);

  // 3. Check columns
  const cols = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'biometric_devices';
  `;
  console.log('biometric_devices columns now:', cols.map(c => c.column_name));

  await sql.end();
  console.log('Migration completed successfully.');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
