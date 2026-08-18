import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileEditProfileClient } from './mobile-edit-profile-client'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
    title: 'Edit Profile',
}

export default async function MobileEditProfilePage() {
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
                first_name: true,
                last_name: true,
                middle_name: true,
                full_name: true,
                email: true,
                mobile_no: true,
                date_of_birth: true,
                sex: true,
            }
        })
    })

    if (!profile) {
        redirect('/login')
    }

    return (
        <MobileEditProfileClient profile={profile as any} />
    )
}

