import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileLeavesClient } from './mobile-leaves-client'

export const metadata = {
    title: 'Apply & Track Leaves',
}

export default async function MobileLeavesPage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, mobile_no, avatar_status')
        .eq('id', user.id)
        .single()

    if (!profile) {
        redirect('/login')
    }

    return (
        <MobileLeavesClient profile={profile} />
    )
}
