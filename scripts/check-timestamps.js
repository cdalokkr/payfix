const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
    const { data: acts } = await supabase.from('activities').select('created_at, activity_type').order('created_at', { ascending: false }).limit(20)
    console.log('--- RECENT ACTIVITIES ---')
    acts?.forEach(a => console.log(`[${a.created_at}] Type: ${a.activity_type}`))

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    console.log('\nNow (ISO):', now.toISOString())
    console.log('30 Days Ago (ISO):', thirtyDaysAgo.toISOString())
}

test()
