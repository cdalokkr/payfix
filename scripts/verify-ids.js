const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verify() {
    console.log('--- DB ID VERIFICATION ---')
    const { data: profiles } = await supabase.from('profiles').select('id, user_id, email')
    const { data: activities } = await supabase.from('activities').select('user_id, activity_type')

    console.log('PROFILES:')
    profiles?.forEach(p => {
        const matches = activities?.filter(a => a.user_id === p.id).length || 0
        console.log(`Email: ${p.email} | id: ${p.id} | user_id: ${p.user_id} | equal: ${p.id === p.user_id} | Activity count (by p.id): ${matches}`)
    })

    console.log('\nACTIVITIES SAMPLES (user_id):')
    activities?.slice(0, 5).forEach(a => console.log(`Type: ${a.activity_type} | user_id: ${a.user_id}`))
    console.log('--- END ---')
}

verify()
