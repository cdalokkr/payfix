/**
 * Seed Master Admin Script
 * 
 * This script:
 * 1. Removes existing admin data from all tables
 * 2. Creates/updates the master admin profile
 * 3. Inserts activity logs with correct activity_type
 * 4. Updates analytics metrics
 * 
 * Usage: node scripts/seed-admin.js
 * 
 * Prerequisites:
 * - NEXT_PUBLIC_SUPABASE_URL must be set in .env.local
 * - SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 */

const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    console.error('\nMake sure these are set in your .env.local file')
    process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

// Master Admin Data
const masterAdmin = {
    id: '0a4274fb-6fc9-482b-993e-f7c903ec0dd7',
    email: 'srpadmin@saaskit.in',
    full_name: 'srp admin',
    avatar_url: '/avatars/default-male.png',
    role: 'super_admin',
    first_name: 'srp',
    last_name: 'admin',
    mobile_no: '8707064200',
    date_of_birth: '1982-07-10',
    middle_name: '',
    sex: 'male',
    status: 'active'
}

// Admin Password
const adminPassword = 'Srpadmin@7626$'

// ============================================
// STEP 1: Clean up existing data
// ============================================
async function cleanupExistingData() {
    console.log('\n🧹 Cleaning up existing data...')

    // Get auth user ID - handle potential pagination
    let existingUser = null
    let page = 1
    const perPage = 100

    while (true) {
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
            page: page,
            perPage: perPage
        })

        if (listError) {
            console.error('   ⚠️ Error listing users:', listError.message)
            break
        }

        existingUser = listData.users.find(u => u.email.toLowerCase() === masterAdmin.email.toLowerCase())
        if (existingUser || listData.users.length < perPage) break
        page++
    }

    if (existingUser) {
        console.log(`   ℹ️ Found existing user: ${existingUser.id}`)
        // Delete activities for this user
        const { error: actError } = await supabase
            .from('activities')
            .delete()
            .eq('user_id', existingUser.id)

        if (actError) {
            console.log('   ⚠️ Could not delete activities:', actError.message)
        } else {
            console.log('   ✅ Deleted existing activities')
        }

        // Delete profile
        const { error: profError } = await supabase
            .from('profiles')
            .delete()
            .eq('email', masterAdmin.email)

        if (profError) {
            console.log('   ⚠️ Could not delete profile:', profError.message)
        } else {
            console.log('   ✅ Deleted existing profile')
        }

        // Delete auth user
        const { error: authError } = await supabase.auth.admin.deleteUser(existingUser.id)

        if (authError) {
            console.log('   ⚠️ Could not delete auth user:', authError.message)
        } else {
            console.log('   ✅ Deleted existing auth user')
        }
    } else {
        console.log('   ℹ️ No existing admin user found')
    }

    // Delete analytics for user_created on today
    const today = new Date().toISOString().split('T')[0]
    const { error: anlError } = await supabase
        .from('analytics_metrics')
        .delete()
        .eq('metric_name', 'user_created')
        .eq('metric_date', today)

    if (anlError) {
        console.log('   ⚠️ Could not delete analytics:', anlError.message)
    } else {
        console.log('   ✅ Deleted existing analytics for today')
    }

    console.log('   ✅ Cleanup complete')
}

// ============================================
// STEP 2: Create Auth User
// ============================================
async function createAuthUser() {
    console.log('\n📧 Creating Auth User...')

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: masterAdmin.email,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
            full_name: masterAdmin.full_name,
            role: 'super_admin'
        }
    })

    if (createError) {
        console.error('❌ Failed to create auth user:', createError.message)
        return null
    }

    console.log('✅ Auth user created successfully!')
    console.log('   ID:', newUser.user.id)
    return newUser.user.id
}

// ============================================
// STEP 2.5: Ensure Designation Exists
// ============================================
async function ensureDesignation() {
    console.log('\n🏷️ Ensuring Designation exists...')

    const designationData = {
        id: 'd1234567-89ab-cdef-0123-456789abcdef',
        name: 'Srp Admin',
        description: 'Master Administrator with full system access',
        role: 'admin'
    }

    const { data, error } = await supabase
        .from('designations')
        .upsert(designationData, { onConflict: 'name' })
        .select()
        .single()

    if (error) {
        console.error('❌ Failed to ensure designation:', error.message)
        return null
    }

    console.log('✅ Designation ready:', data.name)
    return data.id
}

// ============================================
// STEP 2.7: Ensure Office Settings Initialized
// ============================================
async function ensureOfficeSettings() {
    console.log('\n⚙️ Ensuring Office Settings initialized...')

    const { data: existing } = await supabase
        .from('office_settings')
        .select('id')
        .maybeSingle()

    if (existing) {
        console.log('   ℹ️ Office settings already exist')
        return existing.id
    }

    const { data, error } = await supabase
        .from('office_settings')
        .insert({
            default_check_in: '10:00:00',
            default_check_out: '19:00:00',
            off_days: [0] // Sunday
        })
        .select()
        .single()

    if (error) {
        console.error('❌ Failed to initialize office settings:', error.message)
        return null
    }

    console.log('✅ Office settings initialized')
    return data.id
}

// ============================================
// STEP 3: Create Profile
// ============================================
async function createProfile(authUserId) {
    console.log('\n📋 Creating Profile...')

    const { error: insertError } = await supabase
        .from('profiles')
        .insert({
            id: authUserId, // Use same ID as auth user
            email: masterAdmin.email,
            full_name: masterAdmin.full_name,
            avatar_url: masterAdmin.avatar_url,
            role: masterAdmin.role,
            first_name: masterAdmin.first_name,
            last_name: masterAdmin.last_name,
            mobile_no: masterAdmin.mobile_no,
            date_of_birth: masterAdmin.date_of_birth,
            middle_name: masterAdmin.middle_name,
            sex: masterAdmin.sex,
            status: masterAdmin.status,
            designation_id: 'd1234567-89ab-cdef-0123-456789abcdef',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })

    if (insertError) {
        console.error('❌ Failed to insert profile:', insertError.message)
        return false
    }

    console.log('✅ Profile created successfully!')
    return true
}

// ============================================
// STEP 4: Insert Activity
// ============================================
async function insertActivity(authUserId) {
    console.log('\n📝 Inserting Activity Log...')

    const timestamp = new Date()
    const formattedTime = timestamp.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    })

    // Valid activity_type enum values:
    // 'login' | 'logout' | 'profile_update' | 'data_view' | 'data_edit' | 'data_delete' | 'data_create'
    const activityData = {
        user_id: authUserId,
        activity_type: 'data_create',  // Using updated enum value
        module: 'auth',
        description: `admin - [${masterAdmin.email}] - created 👤 at ${formattedTime}`,
        metadata: {
            created_user_id: authUserId,
            created_email: masterAdmin.email,
            actor_role: 'admin',
            actor_email: masterAdmin.email,
            timestamp: timestamp.toISOString(),
            seed_script: true
        }
    }

    const { error } = await supabase
        .from('activities')
        .insert(activityData)

    if (error) {
        console.error('❌ Failed to insert activity:', error.message)
        return false
    }

    console.log('✅ Activity inserted successfully!')
    console.log(`   Type: ${activityData.activity_type}`)
    console.log(`   Description: ${activityData.description}`)
    return true
}

// ============================================
// STEP 5: Insert Analytics Metrics
// ============================================
async function insertAnalyticsMetrics() {
    console.log('\n📊 Inserting Analytics Metrics...')

    const today = new Date().toISOString().split('T')[0]

    // Insert new analytics metric
    // Table columns: id, metric_name, metric_value, metric_date, metadata, created_at
    const { error: insertError } = await supabase
        .from('analytics_metrics')
        .insert({
            metric_name: 'user_created',
            metric_value: 1,
            metric_date: today,
            metadata: {
                created_by_seed: true,
                created_user: masterAdmin.email,
                timestamp: new Date().toISOString()
            }
        })

    if (insertError) {
        console.error('❌ Failed to insert analytics:', insertError.message)
        return false
    }

    console.log('✅ Analytics metric inserted!')
    console.log(`   Date: ${today}`)
    console.log(`   Metric Name: user_created`)
    console.log(`   Value: 1`)

    return true
}

// ============================================
// STEP 6: Verify Setup
// ============================================
async function verifyAdmin(authUserId) {
    console.log('\n🔍 Verifying Admin Setup...')

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', masterAdmin.email)
        .single()

    if (error || !profile) {
        console.error('❌ Verification failed:', error?.message || 'Profile not found')
        return false
    }

    console.log('\n✅ Admin Profile Verified:')
    console.log('   ─────────────────────────────────────')
    console.log(`   ID:           ${profile.id}`)
    console.log(`   Email:        ${profile.email}`)
    console.log(`   Name:         ${profile.first_name} ${profile.last_name}`)
    console.log(`   Role:         ${profile.role}`)
    console.log(`   Mobile:       ${profile.mobile_no}`)
    console.log(`   DOB:          ${profile.date_of_birth}`)
    console.log(`   Sex:          ${profile.sex}`)
    console.log('   ─────────────────────────────────────')

    // Verify activity was created
    const { data: activities } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', authUserId)
        .eq('activity_type', 'data_create')
        .limit(1)

    if (activities && activities.length > 0) {
        console.log('\n✅ Activity Log Verified:')
        console.log(`   Type: ${activities[0].activity_type}`)
        console.log(`   Description: ${activities[0].description}`)
    }

    // Verify analytics was created
    const today = new Date().toISOString().split('T')[0]
    const { data: analytics } = await supabase
        .from('analytics_metrics')
        .select('*')
        .eq('metric_name', 'user_created')
        .eq('metric_date', today)
        .limit(1)

    if (analytics && analytics.length > 0) {
        console.log('\n✅ Analytics Metric Verified:')
        console.log(`   Name: ${analytics[0].metric_name}`)
        console.log(`   Value: ${analytics[0].metric_value}`)
        console.log(`   Date: ${analytics[0].metric_date}`)
    }

    return true
}

// ============================================
// MAIN
// ============================================
async function main() {
    console.log('╔═══════════════════════════════════════════════╗')
    console.log('║       MASTER ADMIN SEED SCRIPT                ║')
    console.log('╠═══════════════════════════════════════════════╣')
    console.log(`║  Email:    ${masterAdmin.email.padEnd(33)}║`)
    console.log(`║  Password: ${adminPassword.padEnd(33)}║`)
    console.log('╚═══════════════════════════════════════════════╝')

    try {
        // Step 0: Check if database is initialized
        const { error: checkError } = await supabase.from('profiles').select('id').limit(1)
        if (checkError && checkError.message.includes('relation "public.profiles" does not exist')) {
            console.error('\n❌ Database tables not found!')
            console.log('\n📖 To setup a fresh database:')
            console.log('   1. Open Supabase SQL Editor.')
            console.log('   2. Run the script in: supabase/setup-fresh-db.sql')
            console.log('   3. Then run this seed script: npm run seed:admin\n')
            process.exit(1)
        }

        // Step 1: Clean up existing data
        await cleanupExistingData()

        // Wait a bit for Supabase to process deletions
        console.log('⏳ Waiting for 2 seconds...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Step 2: Create auth user
        const authUserId = await createAuthUser()

        if (!authUserId) {
            console.error('\n❌ Failed to create auth user. Aborting.')
            process.exit(1)
        }

        // Step 2.5: Ensure designation exists
        await ensureDesignation()

        // Step 2.7: Ensure office settings initialized
        await ensureOfficeSettings()

        // Step 3: Create profile
        const profileSuccess = await createProfile(authUserId)

        if (!profileSuccess) {
            console.error('\n❌ Failed to create profile. Aborting.')
            process.exit(1)
        }

        // Step 4: Insert activity log
        await insertActivity(authUserId)

        // Step 5: Insert analytics metrics
        await insertAnalyticsMetrics()

        // Step 6: Verify the admin setup
        const verified = await verifyAdmin(authUserId)

        if (verified) {
            console.log('\n🎉 Master Admin setup completed successfully!')
            console.log('\n📋 Login Credentials:')
            console.log(`   Email:    ${masterAdmin.email}`)
            console.log(`   Password: ${adminPassword}`)
            process.exit(0)
        } else {
            console.error('\n⚠️  Admin created but verification failed.')
            process.exit(1)
        }

    } catch (error) {
        console.error('\n❌ Unexpected error:', error.message)
        process.exit(1)
    }
}

main()
