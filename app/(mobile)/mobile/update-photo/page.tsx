import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfilePhotoCapture } from '@/features/mobile/profile-photo-capture'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
    title: 'Update Profile Photo',
}

export default async function UpdatePhotoPage() {
    const supabase = await createServerSupabaseClient()
    const { data, error: authError } = await supabase.auth.getUser()
    const user = data?.user || null

    if (!user) {
        redirect('/login')
    }

    // Fetch profile data strictly from tenant schema with designation
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

    const designationName = profile.designation?.name || null

    console.log('[UPDATE-PHOTO] Rendering component for:', profile.full_name)

    return (
        <ProfilePhotoCapture
            profileId={user.id}
            profileData={{
                fullName: profile.full_name,
                email: profile.email,
                role: profile.role,
                avatarUrl: profile.avatar_url,
                avatarStatus: profile.avatar_status,
                mobileNo: profile.mobile_no || null,
                designation: designationName || null
            }}
        />
    )
}
