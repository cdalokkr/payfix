import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually
const envPath = path.join(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars: Record<string, string> = {}
envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const index = trimmed.indexOf('=')
    if (index === -1) return
    const key = trimmed.substring(0, index).trim()
    let val = trimmed.substring(index + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1)
    }
    envVars[key] = val
})

const connectionString = envVars['DATABASE_URL']
if (!connectionString) {
    console.error("DATABASE_URL not found in .env.local")
    process.exit(1)
}

const client = postgres(connectionString, { prepare: false })
const db = drizzle(client)

async function run() {
    console.log("Adding column absent_deduction_multiplier to office_settings...")
    try {
        await db.execute(sql`
            ALTER TABLE office_settings 
            ADD COLUMN IF NOT EXISTS absent_deduction_multiplier integer NOT NULL DEFAULT 1;
        `)
        console.log("Column added successfully!")
    } catch (e) {
        console.error("Failed to add column:", e)
    } finally {
        await client.end()
    }
    process.exit(0)
}

run()
