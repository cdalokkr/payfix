import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileProfileClient } from './mobile-profile-client'

import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'

export const metadata = {
    title: 'Profile',
}

export default async function MobileProfilePage() {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user || null

    if (!user) {
        redirect('/login')
    }

    const profile = await runWithRequestHeaders(async () => {
        return await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            with: {
                designation: true
            }
        })
    })

    if (!profile) {
        redirect('/login')
    }

    const transformedProfile = {
        ...profile,
        designation: profile.designation ? { name: profile.designation.name } : null
    }

    return (
        <MobileProfileClient profile={transformedProfile} />
    )
}
