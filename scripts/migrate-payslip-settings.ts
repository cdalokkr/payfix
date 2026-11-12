import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = postgres(connectionString, { max: 1 })
  try {
    console.log('[Migration] Starting payslip_enabled migration...')
    
    // Find all schemas
    const schemas = await sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public';
    `

    for (const { schema_name } of schemas) {
      console.log(`[Migration] Migrating schema: ${schema_name}`)
      try {
        await sql.unsafe(`
          ALTER TABLE "${schema_name}".office_settings 
          ADD COLUMN IF NOT EXISTS payslip_enabled BOOLEAN NOT NULL DEFAULT TRUE;
        `)
      } catch (err: any) {
        console.log(`  office_settings note: ${err.message}`)
      }

      try {
        await sql.unsafe(`
          ALTER TABLE "${schema_name}".profiles 
          ADD COLUMN IF NOT EXISTS payslip_enabled BOOLEAN DEFAULT TRUE;
        `)
      } catch (err: any) {
        console.log(`  profiles note: ${err.message}`)
      }
    }

    console.log('[Migration] payslip_enabled columns added successfully.')
  } catch (err) {
    console.error('[Migration] Failed:', err)
  } finally {
    await sql.end()
    process.exit(0)
  }
}

run()
