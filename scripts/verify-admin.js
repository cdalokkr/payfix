/**
 * Verify activities and analytics_metrics were created
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verify() {
    console.log('=== VERIFYING SEED DATA ===\n')

    // Check activities for data_edit type (what we're using for create)
    const { data: activities, error: actError } = await supabase
        .from('activities')
        .select('*')
        .eq('activity_type', 'data_edit')
        .order('created_at', { ascending: false })
        .limit(5)

    console.log('📝 Recent data_edit Activities:')
    if (actError) {
        console.log('Error:', actError.message)
    } else if (activities?.length > 0) {
        activities.forEach(act => {
            console.log(`   - ${act.description}`)
            console.log(`     Type: ${act.activity_type}`)
            console.log(`     Created: ${act.created_at}`)
            console.log('')
        })
    } else {
        console.log('   No activities found')
    }

    // Check analytics
    const { data: analytics, error: anlError } = await supabase
        .from('analytics_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    console.log('📊 Recent Analytics Metrics:')
    if (anlError) {
        console.log('Error:', anlError.message)
    } else if (analytics?.length > 0) {
        analytics.forEach(metric => {
            console.log(`   - ${metric.metric_name}: ${metric.metric_value} (${metric.metric_date})`)
        })
    } else {
        console.log('   No analytics found')
    }

    // Check profile
    const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'srpadmin@saaskit.in')
        .single()

    console.log('\n👤 Admin Profile:')
    if (profError) {
        console.log('Error:', profError.message)
    } else if (profile) {
        console.log(`   Email: ${profile.email}`)
        console.log(`   Role: ${profile.role}`)
        console.log(`   Name: ${profile.first_name} ${profile.last_name}`)
        console.log(`   User ID: ${profile.user_id}`)
    }
}

verify()
