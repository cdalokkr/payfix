import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileProfileClient } from './mobile-profile-client'

export const metadata = {
    title: 'Profile',
}

export default async function MobileProfilePage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, mobile_no, avatar_status, designation:designations(name)')
        .eq('id', user.id)
        .single()

    if (!profile) {
        redirect('/login')
    }

    // Transform the designation array to single object (Supabase returns array for relations)
    const transformedProfile = {
        ...profile,
        designation: Array.isArray(profile.designation)
            ? profile.designation[0] || null
            : profile.designation
    }

    return (
        <MobileProfileClient profile={transformedProfile} />
    )
}
