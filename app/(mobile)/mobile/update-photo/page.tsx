import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfilePhotoCapture } from '@/features/mobile/profile-photo-capture'

export const metadata = {
    title: 'Update Profile Photo',
}

export default async function UpdatePhotoPage() {
    console.log('[UPDATE-PHOTO] Page started')
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    console.log('[UPDATE-PHOTO] User:', user?.id ? 'Found' : 'Not found')
    if (!user) {
        console.log('[UPDATE-PHOTO] Redirecting to /login (no user)')
        redirect('/login')
    }

    // Fetch profile data with designation
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, designation:designations(name)')
        .eq('id', user.id)
        .single()

    console.log('[UPDATE-PHOTO] Profile:', profile ? 'Found' : 'Not found', 'Error:', error?.message || 'None')
    if (!profile) {
        console.log('[UPDATE-PHOTO] Redirecting to /login (no profile)')
        redirect('/login')
    }

    // Extract designation name from relation
    const designation = profile.designation as { name: string } | { name: string }[] | null
    const designationName = Array.isArray(designation)
        ? designation[0]?.name
        : designation?.name

    console.log('[UPDATE-PHOTO] Rendering component for:', profile.full_name)

    return (
        <ProfilePhotoCapture
            profileId={user.id}
            profileData={{
                fullName: profile.full_name,
                email: profile.email,
                role: profile.role,
                avatarUrl: profile.avatar_url,
                designation: designationName || null
            }}
        />
    )
}
