import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileEditProfileClient } from './mobile-edit-profile-client'

export const metadata = {
    title: 'Edit Profile',
}

export default async function MobileEditProfilePage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_name, full_name, email, mobile_no, date_of_birth, sex')
        .eq('id', user.id)
        .single()

    if (!profile) {
        redirect('/login')
    }

    return (
        <MobileEditProfileClient profile={profile} />
    )
}
