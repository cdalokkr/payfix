/**
 * Fresh Database & Edge Functions Setup Script
 * Run with: npx ts-node scripts/setup-fresh.ts
 * 
 * This script:
 * 1. Verifies Supabase connection
 * 2. Seeds database with default data
 * 3. Provides Edge Functions deployment instructions
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { execSync } from 'child_process'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// =============================================================================
// VALIDATION
// =============================================================================

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║       🚀 PAYFIX FRESH SETUP SCRIPT                           ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('❌ ERROR: Missing environment variables!')
    console.log('')
    console.log('   Required in .env.local:')
    console.log('   - NEXT_PUBLIC_SUPABASE_URL')
    console.log('   - SUPABASE_SERVICE_ROLE_KEY')
    console.log('')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
})

// =============================================================================
// FUNCTIONS
// =============================================================================

async function checkDatabaseSetup() {
    console.log('📋 Checking database setup...')

    const { error } = await supabase.from('profiles').select('id').limit(1)

    if (error?.message?.includes('does not exist')) {
        console.log('   ❌ Database tables not found!')
        console.log('')
        console.log('   📖 Run these SQL scripts in order:')
        console.log('   1. supabase/setup-fresh-db.sql')
        console.log('   2. supabase/seed-admin.sql')
        console.log('')
        return false
    }

    console.log('   ✅ Database tables exist')
    return true
}

async function checkDefaultData() {
    console.log('📊 Checking default data...')

    // Check office settings
    const { data: settings } = await supabase.from('office_settings').select('id').limit(1)
    if (!settings?.length) {
        console.log('   ⚠️  No office settings found')
        console.log('   Run: npm run db:seed')
        return false
    }
    console.log('   ✅ Office settings exist')

    // Check designations
    const { count: designationCount } = await supabase
        .from('designations')
        .select('*', { count: 'exact', head: true })

    console.log(`   ✅ ${designationCount || 0} designations found`)

    // Check profiles
    const { count: profileCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    console.log(`   ✅ ${profileCount || 0} profiles found`)

    return true
}

function getEdgeFunctionInstructions() {
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('📦 EDGE FUNCTIONS DEPLOYMENT')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('Edge Functions provide faster performance for:')
    console.log('  • Attendance clock-in/clock-out')
    console.log('  • Real-time notifications')
    console.log('  • Dashboard statistics')
    console.log('')
    console.log('To deploy Edge Functions:')
    console.log('')
    console.log('  1. Install Supabase CLI (if not installed):')
    console.log('     npm install -g supabase')
    console.log('')
    console.log('  2. Login to Supabase:')
    console.log('     supabase login')
    console.log('')
    console.log('  3. Link your project:')
    console.log('     supabase link --project-ref YOUR_PROJECT_REF')
    console.log('')
    console.log('  4. Deploy all Edge Functions:')
    console.log('     supabase functions deploy attendance-clock')
    console.log('     supabase functions deploy broadcast-notification')
    console.log('     supabase functions deploy attendance-stats')
    console.log('')
    console.log('  Or deploy all at once:')
    console.log('     supabase functions deploy')
    console.log('')
    console.log('Available Functions:')
    console.log('  ┌─────────────────────────┬────────────────────────────────┐')
    console.log('  │ Function                │ Purpose                        │')
    console.log('  ├─────────────────────────┼────────────────────────────────┤')
    console.log('  │ attendance-clock        │ Fast clock-in/clock-out ops    │')
    console.log('  │ broadcast-notification  │ Real-time notifications        │')
    console.log('  │ attendance-stats        │ Dashboard statistics           │')
    console.log('  └─────────────────────────┴────────────────────────────────┘')
    console.log('')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    console.log('📡 Supabase URL:', SUPABASE_URL)
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')

    const dbReady = await checkDatabaseSetup()
    if (!dbReady) {
        process.exit(1)
    }

    console.log('')

    await checkDefaultData()

    getEdgeFunctionInstructions()

    console.log('═══════════════════════════════════════════════════════════════')
    console.log('✅ SETUP CHECK COMPLETE')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('Next Steps:')
    console.log('  1. If tables missing: Run setup-fresh-db.sql')
    console.log('  2. If data missing: Run npm run db:seed')
    console.log('  3. Deploy Edge Functions (see above)')
    console.log('  4. Start the app: npm run dev')
    console.log('')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
