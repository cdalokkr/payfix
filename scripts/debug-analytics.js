const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
    const { data: acts } = await supabase.from('activities').select('user_id, activity_type, created_at')
    const { data: profs } = await supabase.from('profiles').select('id, email, role')

    console.log('--- DATA DUMP ---')
    console.log('ACTIVITIES:', acts);
    console.log('PROFILES:', profs);

    if (profs && acts) {
        acts.forEach(a => {
            const p = profs.find(p => p.id === a.user_id);
            console.log(`Activity ${a.activity_type} linked to: ${p ? p.email : 'NOT FOUND'} (id: ${a.user_id})`);
        });
    }
}

test()
