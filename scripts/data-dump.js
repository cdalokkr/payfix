const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
    const { data: profs } = await supabase.from('profiles').select('id, email, role')
    const { data: acts } = await supabase.from('activities').select('user_id, activity_type, id')

    console.log('--- TABLES DUMP ---')
    console.log('PROFILES:')
    profs?.forEach(p => console.log(`  [${p.id}] ${p.email} (${p.role})`))

    console.log('\nACTIVITIES:')
    acts?.forEach(a => {
        const p = profs?.find(p => p.id === a.user_id)
        console.log(`  [${a.id}] user_id: ${a.user_id} -> ${p ? p.email : '!!! NOT FOUND !!!'} (${a.activity_type})`)
    })
    console.log('--- END ---')
}

test()
