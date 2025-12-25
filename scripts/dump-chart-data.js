const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function simulate() {
    const [actsResult, profsResult] = await Promise.all([
        supabase.from('activities').select('activity_type, user_id').gte('created_at', '2024-01-01').lte('created_at', '2025-12-31'),
        supabase.from('profiles').select('id, user_id, role, email, first_name, last_name')
    ])

    const userActivityCounts = new Map()
    actsResult.data.forEach(a => userActivityCounts.set(a.user_id, (userActivityCounts.get(a.user_id) || 0) + 1))

    const adminUsers = []
    profsResult.data.forEach(p => {
        const count = userActivityCounts.get(p.id) || 0
        if (count > 0 && p.role === 'admin') adminUsers.push({ user_id: p.id, name: p.email, count })
    })

    if (adminUsers.length === 0) {
        console.log('No admins with activities')
        return
    }

    const topUserIds = new Set(adminUsers.map(u => u.user_id))
    const activityTypesMap = new Map()
    const allActivityTypes = new Set()

    actsResult.data.forEach(a => {
        if (topUserIds.has(a.user_id)) {
            allActivityTypes.add(a.activity_type)
            if (!activityTypesMap.has(a.user_id)) activityTypesMap.set(a.user_id, new Map())
            const userTypes = activityTypesMap.get(a.user_id)
            userTypes.set(a.activity_type, (userTypes.get(a.activity_type) || 0) + 1)
        }
    })

    const chartLabels = Array.from(allActivityTypes).sort()
    const chartDatasets = adminUsers.map((user, index) => {
        const userTypes = activityTypesMap.get(user.user_id) || new Map()
        const data = chartLabels.map(label => userTypes.get(label) || 0)
        return { label: user.name, data }
    })

    console.log('CHART DATA:', JSON.stringify({ labels: chartLabels, datasets: chartDatasets }, null, 2))
}

simulate()
