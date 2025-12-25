const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
    console.log('--- USER DATA CHECK ---')
    const { data: profs } = await supabase.from('profiles').select('id, email, role, user_id')
    const { data: acts } = await supabase.from('activities').select('user_id').limit(50)

    console.log('PROFILES:')
    profs?.forEach(p => console.log(`Email: ${p.email} | id: ${p.id} | user_id: ${p.user_id}`))

    console.log('\nACTIVITY USER_ID LIST (Uniq):')
    const uniqActUserIds = [...new Set(acts?.map(a => a.user_id))]
    uniqActUserIds.forEach(id => {
        const p = profs?.find(p => p.id === id)
        console.log(`Activity user_id: ${id} -> Profile: ${p ? p.email : 'NOT FOUND'}`)
    })
}

test()
