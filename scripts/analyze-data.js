const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
    const { data: profs } = await supabase.from('profiles').select('id, email, role')
    const { data: acts } = await supabase.from('activities').select('user_id, activity_type')

    console.log('--- DATA ANALYSIS ---')
    profs?.forEach(p => {
        const myActs = acts?.filter(a => a.user_id === p.id) || []
        console.log(`User: ${p.email} | Role: ${p.role} | ProfileID: ${p.id} | Acts Count: ${myActs.length}`)
        if (myActs.length > 0) {
            const types = myActs.map(a => a.activity_type)
            console.log(`  Types: ${[...new Set(types)].join(', ')}`)
        }
    })

    const orphanActs = acts?.filter(a => !profs?.some(p => p.id === a.user_id)) || []
    console.log(`\nOrphan activities (user_id not in profiles.id): ${orphanActs.length}`)
    if (orphanActs.length > 0) {
        console.log('Orphan user_id sample:', orphanActs[0].user_id)
    }
}

test()
