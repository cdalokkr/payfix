import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { MobileAttendanceClient } from './mobile-attendance-client'
import { redirect } from 'next/navigation'
import { isDefaultAvatar } from '@/lib/utils/avatar-helper'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'
import { db } from '@/lib/db'
import { attendance, profiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'


export const metadata = {
    title: 'Mark Attendance',
}

// Get today's date in IST (Asia/Kolkata timezone)
function getLocalDateIST(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
}

interface PageProps {
    searchParams?: Promise<{ action?: string }>
}

export default async function MobileAttendancePage({ searchParams }: PageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const requestedAction = resolvedSearchParams?.action === 'clock_out' ? 'clock_out' : resolvedSearchParams?.action === 'clock_in' ? 'clock_in' : null

    const cookieStore = await cookies()
    const isPwa = cookieStore.get('pwa_standalone')?.value === 'true'

    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user || null

    if (!user) {
        redirect('/login')
    }

    // Get today's date in IST
    const today = getLocalDateIST()

    // Skip redundant todayAttendance DB query when ?action= is explicitly provided from dashboard
    const { profile, todayAttendance } = await runWithRequestHeaders(async () => {
        const profilePromise = db.query.profiles.findFirst({
            where: eq(profiles.id, user.id)
        })
        const attPromise = requestedAction
            ? Promise.resolve(null)
            : db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, user.id),
                    eq(attendance.date, today)
                )
            })
        const [profileRecord, attRecord] = await Promise.all([profilePromise, attPromise])
        return {
            profile: profileRecord || null,
            todayAttendance: attRecord || null
        }
    })

    const hasNoPhoto = profile?.avatar_status !== 'custom' && (!profile?.avatar_url || isDefaultAvatar(profile.avatar_url))

    if (hasNoPhoto) {
        redirect('/mobile')
    }

    // Determine action:
    // 1. If explicit query parameter was provided (e.g. ?action=clock_out), prioritize it
    // 2. Otherwise determine dynamically from tenant DB attendance record
    let action: 'clock_in' | 'clock_out' = 'clock_in'

    if (requestedAction) {
        action = requestedAction
    } else if (todayAttendance) {
        const isClockedIn = todayAttendance.current_session_status === 'checked_in' || (todayAttendance.check_in && !todayAttendance.check_out)
        action = isClockedIn ? 'clock_out' : 'clock_in'
    }

    return (
        <MobileAttendanceClient
            key={action}
            profile={profile!}
            action={action}
            isPwaServer={isPwa}
        />
    )
}
