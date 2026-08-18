import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileHistoryClient } from './mobile-history-client'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
    title: 'Attendance History',
}

export default async function MobileHistoryPage() {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    const user = data?.user || null

    if (!user) {
        redirect('/login')
    }

    const profile = await runWithRequestHeaders(async () => {
        return await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            columns: {
                id: true,
                full_name: true,
                email: true,
                avatar_url: true,
                mobile_no: true,
                avatar_status: true,
            }
        })
    })

    if (!profile) {
        redirect('/login')
    }

    return (
        <MobileHistoryClient profile={profile as any} />
    )
}

