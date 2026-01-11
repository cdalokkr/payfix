/**
 * Complete Database Seed Script
 * Run with: npm run db:seed
 * 
 * Seeds designations, office settings, holidays, and admin profile
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Master Admin Configuration
const ADMIN_CONFIG = {
    id: '0a4274fb-6fc9-482b-993e-f7c903ec0dd7',
    email: 'srpadmin@saaskit.in',
    password: 'Srpadmin@7626$',
    firstName: 'SRP',
    lastName: 'Admin',
    mobile: '8707064200',
    dateOfBirth: '1982-07-10'
}

// =============================================================================
// VALIDATION
// =============================================================================

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║           🌱 PAYFIX DATABASE SEED SCRIPT                     ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('❌ ERROR: Missing environment variables!')
    console.log('')
    console.log('   Required in .env.local:')
    console.log('   - NEXT_PUBLIC_SUPABASE_URL')
    console.log('   - SUPABASE_SERVICE_ROLE_KEY')
    console.log('')
    console.log('   Get service role key from:')
    console.log('   Supabase Dashboard → Settings → API → service_role (secret)')
    console.log('')
    process.exit(1)
}

console.log('📡 Supabase URL:', SUPABASE_URL)
console.log('🔑 Service Key:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...')
console.log('')

// Create admin client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
})

// =============================================================================
// SEED DATA
// =============================================================================

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
    { date: '2026-04-02', reason: 'Ram Navami', type: 'holiday' },
    { date: '2026-04-03', reason: 'Good Friday', type: 'holiday' },
    { date: '2026-04-14', reason: 'Dr. Ambedkar Jayanti', type: 'holiday' },
    { date: '2026-05-01', reason: 'May Day', type: 'holiday' },
    { date: '2026-05-23', reason: 'Buddha Purnima', type: 'holiday' },
    { date: '2026-06-07', reason: 'Eid ul-Fitr', type: 'holiday' },
    { date: '2026-07-18', reason: 'Muharram', type: 'holiday' },
    { date: '2026-08-15', reason: 'Independence Day', type: 'holiday' },
    { date: '2026-08-20', reason: 'Janmashtami', type: 'holiday' },
    { date: '2026-10-02', reason: 'Gandhi Jayanti', type: 'holiday' },
    { date: '2026-10-20', reason: 'Dussehra', type: 'holiday' },
    { date: '2026-11-08', reason: 'Diwali', type: 'holiday' },
    { date: '2026-11-09', reason: 'Diwali (Day 2)', type: 'holiday' },
    { date: '2026-11-14', reason: 'Guru Nanak Jayanti', type: 'holiday' },
    { date: '2026-12-25', reason: 'Christmas', type: 'holiday' }
]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function logStep(icon: string, message: string) {
    console.log(`${icon} ${message}`)
}

function logSuccess(message: string) {
    console.log(`   ✅ ${message}`)
}

function logError(message: string, error: unknown) {
    console.log(`   ❌ ${message}`)
    if (error instanceof Error) {
        console.log(`      Error: ${error.message}`)
    } else if (typeof error === 'object' && error !== null) {
        console.log(`      Error: ${JSON.stringify(error)}`)
    }
}

function logInfo(message: string) {
    console.log(`   ℹ️  ${message}`)
}

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function seedDesignations(): Promise<boolean> {
    logStep('📋', 'Seeding designations...')

    try {
        for (const designation of DESIGNATIONS) {
            const { data, error } = await supabase
                .from('designations')
                .upsert(designation, { onConflict: 'name' })
                .select()
                .single()

            if (error) {
                logError(`Failed to insert "${designation.name}"`, error)
                return false
            }
            logSuccess(`Created: ${designation.name} (${designation.role})`)
        }
        return true
    } catch (err) {
        logError('Unexpected error', err)
        return false
    }
}

async function seedOfficeSettings(): Promise<boolean> {
    logStep('🏢', 'Seeding office settings...')

    try {
        // Check if settings exist
        const { data: existing, error: selectError } = await supabase
            .from('office_settings')
            .select('id')
            .limit(1)

        if (selectError) {
            logError('Failed to check existing settings', selectError)
            return false
        }

        if (existing && existing.length > 0) {
            const { error } = await supabase
                .from('office_settings')
                .update(OFFICE_SETTINGS)
                .eq('id', existing[0].id)

            if (error) {
                logError('Failed to update settings', error)
                return false
            }
            logSuccess('Updated existing office settings')
        } else {
            const { error } = await supabase
                .from('office_settings')
                .insert(OFFICE_SETTINGS)

            if (error) {
                logError('Failed to insert settings', error)
                return false
            }
            logSuccess('Created new office settings')
        }

        logInfo(`Hours: ${OFFICE_SETTINGS.default_check_in} - ${OFFICE_SETTINGS.default_check_out}`)
        logInfo(`Off days: Sunday, Saturday`)
        return true
    } catch (err) {
        logError('Unexpected error', err)
        return false
    }
}

async function seedHolidays(): Promise<boolean> {
    logStep('🎉', 'Seeding holidays (2026)...')

    try {
        let successCount = 0

        for (const holiday of HOLIDAYS_2026) {
            const { error } = await supabase
                .from('office_closures')
                .upsert(holiday, { onConflict: 'date' })

            if (error) {
                logError(`Failed: ${holiday.reason}`, error)
            } else {
                successCount++
            }
        }

        logSuccess(`Seeded ${successCount}/${HOLIDAYS_2026.length} holidays`)
        return successCount === HOLIDAYS_2026.length
    } catch (err) {
        logError('Unexpected error', err)
        return false
    }
}

async function seedAdminProfile(): Promise<boolean> {
    logStep('👤', 'Seeding admin profile...')

    try {
        // First check if admin auth user exists
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(ADMIN_CONFIG.id)

        if (authError || !authUser.user) {
            logInfo('Admin auth user not found, creating...')

            // Create auth user
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: ADMIN_CONFIG.email,
                password: ADMIN_CONFIG.password,
                email_confirm: true,
                user_metadata: {
                    full_name: `${ADMIN_CONFIG.firstName} ${ADMIN_CONFIG.lastName}`,
                    status: 'active'
                }
            })

            if (createError) {
                // Check if user already exists with different ID
                if (createError.message?.includes('already been registered')) {
                    logInfo('Admin user already exists in auth, fetching...')

                    const { data: users } = await supabase.auth.admin.listUsers()
                    const existingUser = users?.users?.find(u => u.email === ADMIN_CONFIG.email)

                    if (existingUser) {
                        logSuccess(`Found existing auth user: ${existingUser.id}`)
                        // Update ADMIN_CONFIG.id for profile creation
                        await createAdminProfile(existingUser.id)
                        return true
                    }
                }
                logError('Failed to create auth user', createError)
                return false
            }

            if (newUser.user) {
                logSuccess(`Created auth user: ${newUser.user.id}`)
                await createAdminProfile(newUser.user.id)
                return true
            }
        } else {
            logInfo(`Auth user exists: ${authUser.user.id}`)
            await createAdminProfile(authUser.user.id)
            return true
        }

        return false
    } catch (err) {
        logError('Unexpected error', err)
        return false
    }
}

async function createAdminProfile(userId: string): Promise<boolean> {
    const profileData = {
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
    }

    const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
        .select()
        .single()

    if (error) {
        logError('Failed to create profile', error)
        return false
    }

    logSuccess(`Profile created: ${ADMIN_CONFIG.email}`)
    logInfo(`Login: ${ADMIN_CONFIG.email} / ${ADMIN_CONFIG.password}`)
    return true
}

async function verifyData(): Promise<void> {
    logStep('🔍', 'Verifying seeded data...')

    const { count: designationCount } = await supabase
        .from('designations')
        .select('*', { count: 'exact', head: true })

    const { count: settingsCount } = await supabase
        .from('office_settings')
        .select('*', { count: 'exact', head: true })

    const { count: holidayCount } = await supabase
        .from('office_closures')
        .select('*', { count: 'exact', head: true })

    const { count: profileCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    console.log('')
    console.log('   ┌─────────────────────┬───────┐')
    console.log('   │ Table               │ Count │')
    console.log('   ├─────────────────────┼───────┤')
    console.log(`   │ designations        │   ${String(designationCount || 0).padStart(3)} │`)
    console.log(`   │ office_settings     │   ${String(settingsCount || 0).padStart(3)} │`)
    console.log(`   │ office_closures     │   ${String(holidayCount || 0).padStart(3)} │`)
    console.log(`   │ profiles            │   ${String(profileCount || 0).padStart(3)} │`)
    console.log('   └─────────────────────┴───────┘')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    const results: boolean[] = []

    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')

    // Seed in order (designations first because profile references it)
    results.push(await seedDesignations())
    console.log('')

    results.push(await seedOfficeSettings())
    console.log('')

    results.push(await seedHolidays())
    console.log('')

    results.push(await seedAdminProfile())
    console.log('')

    // Verify
    await verifyData()

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')

    const allSuccess = results.every(r => r)
    if (allSuccess) {
        console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!')
    } else {
        console.log('⚠️  DATABASE SEEDING COMPLETED WITH SOME ERRORS')
    }

    console.log('')
    console.log('Next steps:')
    console.log(`  1. Login at your app with: ${ADMIN_CONFIG.email}`)
    console.log(`  2. Password: ${ADMIN_CONFIG.password}`)
    console.log('')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
