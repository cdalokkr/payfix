import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileHistoryClient } from './mobile-history-client'

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

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, mobile_no, avatar_status')
        .eq('id', user.id)
        .single()

    if (!profile) {
        redirect('/login')
    }

    return (
        <MobileHistoryClient profile={profile} />
    )
}
