import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MobileAttendanceClient } from './mobile-attendance-client'
import { redirect } from 'next/navigation'
import { isDefaultAvatar } from '@/lib/utils/avatar-helper'

export const metadata = {
    title: 'Mark Attendance',
}

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Get today's date in IST (Asia/Kolkata timezone)
function getLocalDateIST(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
}

export default async function MobileAttendancePage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_status')
        .eq('id', user!.id)
        .single()

    const hasNoPhoto = profile?.avatar_status !== 'custom' && (!profile?.avatar_url || isDefaultAvatar(profile.avatar_url))

    if (hasNoPhoto) {
        redirect('/mobile')
    }

    // Get today's attendance to determine action using IST date
    const today = getLocalDateIST()
    const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('id, check_in, check_out')
        .eq('profile_id', user!.id)
        .eq('date', today)
        .single()

    const action = todayAttendance?.check_in && !todayAttendance?.check_out
        ? 'clock_out'
        : 'clock_in'

    return (
        <MobileAttendanceClient
            profile={profile!}
            action={action}
        />
    )
}
