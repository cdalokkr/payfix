import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { MobileDashboard } from './mobile-dashboard'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'
import { db } from '@/lib/db'
import { attendance } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const metadata = {
    title: 'Mobile Dashboard',
}

// Get today's date in IST (Asia/Kolkata timezone)
function getLocalDateIST(): string {
    const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    console.log('[MOBILE-PAGE] IST date calculated:', dateStr)
    return dateStr
}

export default async function MobilePage() {
    const cookieStore = await cookies()
    const isPwa = cookieStore.get('pwa_standalone')?.value === 'true'

    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user || null

    if (!user) {
        return null
    }

    const today = getLocalDateIST()
    console.log('[MOBILE-PAGE] Querying data for user:', user.id, 'date:', today)

    const { profile, todayAttendance } = await runWithRequestHeaders(async () => {
        const [profileRes, attRecord] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, full_name, avatar_url, email, sex, avatar_status, role')
                .eq('id', user.id)
                .single(),
            db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, user.id),
                    eq(attendance.date, today)
                )
            })
        ])
        return {
            profile: profileRes.data,
            todayAttendance: attRecord ? {
                id: attRecord.id,
                check_in: attRecord.check_in ? new Date(attRecord.check_in).toISOString() : null,
                check_out: attRecord.check_out ? new Date(attRecord.check_out).toISOString() : null,
                status: attRecord.status,
                current_session_status: attRecord.current_session_status || null,
                date: attRecord.date
            } : null
        }
    })

    console.log('[MOBILE-PAGE] Attendance result:', todayAttendance ? `found for ${todayAttendance.date}` : 'none', 'profile found:', !!profile)

    return (
        <MobileDashboard
            profile={profile!}
            todayAttendance={todayAttendance as any}
            isPwaServer={isPwa}
        />
    )
}
