/**
 * PayFix FULL Automated Setup Script
 * 
 * Automates EVERYTHING:
 * 1. Creates database schema (runs setup-fresh-db.sql)
 * 2. Seeds default data (designations, settings, holidays, admin)
 * 3. Deploys Edge Functions
 * 
 * Usage: 
 *   npx tsx scripts/complete-setup.ts --ref YOUR_PROJECT_REF --token YOUR_ACCESS_TOKEN
 * 
 * Or interactive mode:
 *   npx tsx scripts/complete-setup.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import * as readline from 'readline'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// =============================================================================
// CONFIGURATION
// =============================================================================

let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Master Admin Configuration
const ADMIN_CONFIG = {
    email: 'srpadmin@saaskit.in',
    password: 'Srpadmin@7626$',
    firstName: 'SRP',
    lastName: 'Admin',
    mobile: '8707064200',
    dateOfBirth: '1982-07-10'
}

// Seed Data
const DESIGNATIONS = [
    {
        id: 'd1234567-89ab-cdef-0123-456789abcdef',
        name: 'System Administrator',
        description: 'Master Administrator with full system access',
        role: 'admin'
    }
]

const OFFICE_SETTINGS = {
    default_check_in: '10:00:00',
    default_check_out: '19:00:00',
    off_days: [0, 6],
    daily_working_hours: {
        monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
        saturday: 0, sunday: 0
    }
}

const HOLIDAYS_2026 = [
    { date: '2026-01-26', reason: 'Republic Day', type: 'holiday' },
    { date: '2026-03-10', reason: 'Holi', type: 'holiday' },
    { date: '2026-04-14', reason: 'Dr. Ambedkar Jayanti', type: 'holiday' },
    { date: '2026-05-01', reason: 'May Day', type: 'holiday' },
    { date: '2026-08-15', reason: 'Independence Day', type: 'holiday' },
    { date: '2026-10-02', reason: 'Gandhi Jayanti', type: 'holiday' },
    { date: '2026-10-20', reason: 'Dussehra', type: 'holiday' },
    { date: '2026-11-08', reason: 'Diwali', type: 'holiday' },
    { date: '2026-12-25', reason: 'Christmas', type: 'holiday' }
]

const EDGE_FUNCTIONS = [
    'attendance-clock',
    'broadcast-notification',
    'attendance-stats'
]

// =============================================================================
// HELPERS
// =============================================================================

function log(icon: string, message: string) {
    console.log(`${icon} ${message}`)
}

function success(message: string) {
    console.log(`   ✅ ${message}`)
}

function error(message: string) {
    console.log(`   ❌ ${message}`)
}

function info(message: string) {
    console.log(`   ℹ️  ${message}`)
}

async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close()
            resolve(answer.trim())
        })
    })
}

function parseArgs(): { ref?: string, token?: string, serviceKey?: string } {
    const args = process.argv.slice(2)
    const result: { ref?: string, token?: string, serviceKey?: string } = {}

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--ref' && args[i + 1]) {
            result.ref = args[i + 1]
            i++
        } else if (args[i] === '--token' && args[i + 1]) {
            result.token = args[i + 1]
            i++
        } else if (args[i] === '--service-key' && args[i + 1]) {
            result.serviceKey = args[i + 1]
            i++
        }
    }

    return result
}

// =============================================================================
// SCHEMA CREATION
// =============================================================================

async function runSchemaSQL(projectRef: string, accessToken: string) {
    log('🗄️', 'Creating database schema...')

    // Read the SQL file
    const sqlPath = resolve(process.cwd(), 'supabase', 'setup-fresh-db.sql')
    let sqlContent: string

    try {
        sqlContent = readFileSync(sqlPath, 'utf-8')
        info(`Read ${sqlPath}`)
    } catch (err) {
        error(`Could not read setup-fresh-db.sql: ${err}`)
        return false
    }

    // Execute SQL via Supabase Management API
    const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sqlContent })
        })

        if (!response.ok) {
            const errorText = await response.text()
            // Check if it's just "already exists" errors which are OK
            if (errorText.includes('already exists')) {
                info('Some objects already exist (OK)')
                return true
            }
            error(`API Error: ${response.status} - ${errorText}`)
            return false
        }

        success('Database schema created successfully')
        return true
    } catch (err: any) {
        error(`Failed to execute SQL: ${err.message}`)
        return false
    }
}

// =============================================================================
// DATABASE SEEDING
// =============================================================================

async function seedDatabase(supabase: any) {
    log('🌱', 'Seeding database...')

    // 1. Seed Designations
    log('📋', 'Seeding designations...')
    for (const designation of DESIGNATIONS) {
        const { error: err } = await supabase
            .from('designations')
            .upsert(designation, { onConflict: 'name' })

        if (err) {
            error(`Failed to seed designation: ${err.message}`)
            return false
        }
        success(`Created: ${designation.name}`)
    }

    // 2. Seed Office Settings
    log('🏢', 'Seeding office settings...')
    const { data: existing } = await supabase
        .from('office_settings')
        .select('id')
        .limit(1)

    if (existing && existing.length > 0) {
        await supabase
            .from('office_settings')
            .update(OFFICE_SETTINGS)
            .eq('id', existing[0].id)
        success('Updated existing office settings')
    } else {
        await supabase.from('office_settings').insert(OFFICE_SETTINGS)
        success('Created new office settings')
    }

    // 3. Seed Holidays
    log('🎉', 'Seeding holidays...')
    let holidayCount = 0
    for (const holiday of HOLIDAYS_2026) {
        const { error: err } = await supabase
            .from('office_closures')
            .upsert(holiday, { onConflict: 'date' })
        if (!err) holidayCount++
    }
    success(`Seeded ${holidayCount}/${HOLIDAYS_2026.length} holidays`)

    // 4. Create Admin User
    log('👤', 'Creating admin user...')

    // Check if admin exists
    const { data: existingAdmin } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', ADMIN_CONFIG.email)
        .maybeSingle()

    if (existingAdmin) {
        info('Admin user already exists')
        return true
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: ADMIN_CONFIG.email,
        password: ADMIN_CONFIG.password,
        email_confirm: true,
        user_metadata: {
            full_name: `${ADMIN_CONFIG.firstName} ${ADMIN_CONFIG.lastName}`,
            status: 'active'
        }
    })

    if (authError) {
        if (authError.message?.includes('already been registered')) {
            info('Auth user exists, checking profile...')
            const { data: users } = await supabase.auth.admin.listUsers()
            const user = users?.users?.find((u: any) => u.email === ADMIN_CONFIG.email)
            if (user) {
                await createAdminProfile(supabase, user.id)
            }
        } else {
            error(`Failed to create auth user: ${authError.message}`)
            return false
        }
    } else if (authData.user) {
        await createAdminProfile(supabase, authData.user.id)
    }

    success(`Admin created: ${ADMIN_CONFIG.email}`)
    return true
}

async function createAdminProfile(supabase: any, userId: string) {
    const { error: err } = await supabase.from('profiles').upsert({
        id: userId,
        email: ADMIN_CONFIG.email,
        full_name: `${ADMIN_CONFIG.firstName} ${ADMIN_CONFIG.lastName}`,
        avatar_url: '/avatars/default-male.png',
        role: 'admin',
        designation_id: 'd1234567-89ab-cdef-0123-456789abcdef',
        first_name: ADMIN_CONFIG.firstName,
        middle_name: '',
        last_name: ADMIN_CONFIG.lastName,
        mobile_no: ADMIN_CONFIG.mobile,
        date_of_birth: ADMIN_CONFIG.dateOfBirth,
        sex: 'male',
        status: 'active'
    }, { onConflict: 'id' })

    if (err) {
        error(`Failed to create profile: ${err.message}`)
    }
}

// =============================================================================
// EDGE FUNCTIONS DEPLOYMENT
// =============================================================================

async function deployEdgeFunctions(projectRef: string, accessToken: string) {
    log('🚀', 'Deploying Edge Functions...')

    for (const funcName of EDGE_FUNCTIONS) {
        log('📦', `Deploying ${funcName}...`)

        try {
            execSync(
                `npx supabase functions deploy ${funcName} --project-ref ${projectRef}`,
                {
                    cwd: process.cwd(),
                    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe']
                }
            )
            success(`Deployed: ${funcName}`)
        } catch (err: any) {
            error(`Failed to deploy ${funcName}: ${err.message}`)
            return false
        }
    }

    return true
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║       🚀 PAYFIX FULL AUTOMATED SETUP                         ║')
    console.log('╠══════════════════════════════════════════════════════════════╣')
    console.log('║  This script will:                                           ║')
    console.log('║  1. Create all database tables & RLS policies                ║')
    console.log('║  2. Seed default data (settings, holidays, admin)            ║')
    console.log('║  3. Deploy all Edge Functions                                ║')
    console.log('╚══════════════════════════════════════════════════════════════╝')
    console.log('')

    // Parse command line args
    const args = parseArgs()

    // Get project ref
    let projectRef = args.ref
    if (!projectRef) {
        console.log('   Get Reference ID from: Supabase Dashboard → Settings → General')
        projectRef = await prompt('📋 Enter Supabase Project Reference ID: ')
    }

    if (!projectRef) {
        error('Project reference is required!')
        process.exit(1)
    }

    // Build URL from project ref
    SUPABASE_URL = `https://${projectRef}.supabase.co`
    info(`Supabase URL: ${SUPABASE_URL}`)

    // Get access token
    let accessToken = args.token
    if (!accessToken) {
        console.log('')
        console.log('   Get token from: https://supabase.com/dashboard/account/tokens')
        accessToken = await prompt('🔑 Enter Supabase Access Token: ')
    }

    if (!accessToken) {
        error('Access token is required!')
        process.exit(1)
    }

    // Get service role key
    let serviceKey = args.serviceKey || SUPABASE_SERVICE_KEY
    if (!serviceKey) {
        console.log('')
        console.log('   Get from: Supabase Dashboard → Settings → API → service_role (secret)')
        serviceKey = await prompt('🔐 Enter Service Role Key: ')
    }

    if (!serviceKey) {
        error('Service role key is required!')
        process.exit(1)
    }

    SUPABASE_SERVICE_KEY = serviceKey

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')

    // Step 1: Create Schema
    const schemaSuccess = await runSchemaSQL(projectRef, accessToken)
    if (!schemaSuccess) {
        error('Schema creation failed! You may need to run setup-fresh-db.sql manually.')
        console.log('')
        console.log('   Manual step: Copy supabase/setup-fresh-db.sql to Supabase SQL Editor and run it.')
        console.log('')
        const proceed = await prompt('   Continue anyway? (y/n): ')
        if (proceed.toLowerCase() !== 'y') {
            process.exit(1)
        }
    }
    console.log('')

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    })

    // Wait a moment for schema to be ready
    info('Waiting for schema to be ready...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Step 2: Seed database
    const seedSuccess = await seedDatabase(supabase)
    if (!seedSuccess) {
        error('Database seeding failed!')
        process.exit(1)
    }
    console.log('')

    // Step 3: Deploy Edge Functions
    const deploySuccess = await deployEdgeFunctions(projectRef, accessToken)
    if (!deploySuccess) {
        error('Edge function deployment failed!')
        process.exit(1)
    }
    console.log('')

    // Summary
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('✅ FULL SETUP COMPLETED SUCCESSFULLY!')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('📋 What was done:')
    console.log('   ✅ Database schema created (tables, indexes, RLS policies)')
    console.log('   ✅ Default designations seeded')
    console.log('   ✅ Office settings configured')
    console.log('   ✅ 2026 holidays added')
    console.log('   ✅ Admin user created')
    console.log('   ✅ Edge Functions deployed')
    console.log('')
    console.log('🔐 Admin Login:')
    console.log(`   Email:    ${ADMIN_CONFIG.email}`)
    console.log(`   Password: ${ADMIN_CONFIG.password}`)
    console.log('')
    console.log('🌐 Edge Functions:')
    console.log(`   ${SUPABASE_URL}/functions/v1/attendance-clock`)
    console.log(`   ${SUPABASE_URL}/functions/v1/broadcast-notification`)
    console.log(`   ${SUPABASE_URL}/functions/v1/attendance-stats`)
    console.log('')
    console.log('🚀 Next Steps:')
    console.log('   1. Update .env.local with your keys')
    console.log('   2. Run: npm run dev')
    console.log('   3. Open: http://localhost:3000')
    console.log('')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
