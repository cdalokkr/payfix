
import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    console.error('Missing DATABASE_URL')
    process.exit(1)
}

const sql = postgres(databaseUrl)

async function addColumn() {
    console.log('Attempting to add column "avatar_status" to "profiles" table...')

    try {
        await sql`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS avatar_status TEXT DEFAULT 'default';
    `
        console.log('SUCCESS: Column "avatar_status" added (or already exists).')
    } catch (error: any) {
        console.error('FAILED to add column:', error.message)
    } finally {
        await sql.end()
    }
}

addColumn()
