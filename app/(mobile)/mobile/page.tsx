import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { MobileDashboard } from './mobile-dashboard'

export const metadata = {
    title: 'Mobile Dashboard',
}

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Get today's date in IST (Asia/Kolkata timezone)
function getLocalDateIST(): string {
    // Use toLocaleDateString with 'sv-SE' locale which gives YYYY-MM-DD format
    const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    console.log('[MOBILE-PAGE] IST date calculated:', dateStr)
    return dateStr
}

export default async function MobilePage() {
    const cookieStore = await cookies()
    const isPwa = cookieStore.get('pwa_standalone')?.value === 'true'

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return null
    }

    // Get today's date in IST (Asia/Kolkata timezone)
    const today = getLocalDateIST()
    console.log('[MOBILE-PAGE] Querying data for user:', user.id, 'date:', today)

    // Parallelize Supabase database fetches to accelerate server response times
    const [profileRes, attendanceRes] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email, sex, avatar_status, role')
            .eq('id', user.id)
            .single(),
        supabase
            .from('attendance')
            .select('id, check_in, check_out, status, date')
            .eq('profile_id', user.id)
            .eq('date', today)
            .maybeSingle()
    ])

    const profile = profileRes.data
    const todayAttendance = attendanceRes.data

    console.log('[MOBILE-PAGE] Attendance result:', todayAttendance ? `found for ${todayAttendance.date}` : 'none', 'profile found:', !!profile)

    return (
        <MobileDashboard
            profile={profile!}
            todayAttendance={todayAttendance}
            isPwaServer={isPwa}
        />
    )
}
