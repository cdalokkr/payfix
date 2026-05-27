import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    console.error('Missing DATABASE_URL')
    process.exit(1)
}

const sql = postgres(databaseUrl)

async function run() {
    console.log('Attempting to add column "face_embedding" to "profiles" table...')

    try {
        await sql`
            ALTER TABLE profiles 
            ADD COLUMN IF NOT EXISTS face_embedding REAL[];
        `
        console.log('SUCCESS: Column "face_embedding" of type REAL[] added (or already exists).')
    } catch (error: any) {
        console.error('FAILED to add column:', error.message)
    } finally {
        await sql.end()
    }
}

run()
