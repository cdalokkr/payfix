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

    // Fetch profile data
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, employee_id')
        .eq('id', user.id)
        .single()

    if (!profile) {
        redirect('/login')
    }

    return (
        <ProfilePhotoCapture
            profileId={user.id}
            profileData={{
                fullName: profile.full_name,
                email: profile.email,
                role: profile.role,
                avatarUrl: profile.avatar_url,
                employeeId: profile.employee_id
            }}
        />
    )
}
