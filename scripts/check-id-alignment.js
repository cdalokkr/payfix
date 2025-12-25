const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
    const { data: profs } = await supabase.from('profiles').select('id, user_id, email')
    console.log('--- ID ALIGNMENT CHECK ---')
    profs?.forEach(p => {
        console.log(`Email: ${p.email} | id: ${p.id} | user_id: ${p.user_id} | Match: ${p.id === p.user_id}`)
    })
}

test()
