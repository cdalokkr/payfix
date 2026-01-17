import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfilePhotoCapture } from '@/features/mobile/profile-photo-capture'

export const metadata = {
    title: 'Update Profile Photo',
}

export default async function UpdatePhotoPage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <ProfilePhotoCapture profileId={user.id} />
    )
}
