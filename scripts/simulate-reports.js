const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function simulate() {
    const ctx = { supabase }
    const input = { days: 30 }

    // REDACTED: Copied logic from admin-reports.ts
    // (I'll just re-implement enough to see the results)

    const now = new Date()
    const startDate = new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
    const endDate = now

    console.log('Fetching data...')
    const [actsResult, profsResult] = await Promise.all([
        supabase.from('activities')
            .select('activity_type, user_id')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString()),
        supabase.from('profiles').select('id, user_id, role, email, first_name, last_name')
    ])

    if (!actsResult.data || !profsResult.data) {
        console.error('No data found')
        return
    }

    console.log(`Acts: ${actsResult.data.length}, Profiles: ${profsResult.data.length}`)

    const userActivityCounts = new Map()
    actsResult.data.forEach(a => {
        userActivityCounts.set(a.user_id, (userActivityCounts.get(a.user_id) || 0) + 1)
    })

    const adminUsers = []
    profsResult.data.forEach(p => {
        const count = userActivityCounts.get(p.id) || 0
        if (count > 0 && p.role === 'admin') {
            adminUsers.push({ id: p.id, email: p.email, count })
        }
    })

    console.log('Admin Users with Acts:', adminUsers)

    if (adminUsers.length > 0) {
        const topUserIds = new Set(adminUsers.map(u => u.id))
        const allActivityTypes = new Set()
        actsResult.data.forEach(a => {
            if (topUserIds.has(a.user_id)) {
                allActivityTypes.add(a.activity_type)
            }
        })
        console.log('Activity Types found for admins:', Array.from(allActivityTypes))
    }
}

simulate()
