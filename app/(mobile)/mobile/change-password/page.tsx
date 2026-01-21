import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileChangePasswordClient } from './mobile-change-password-client'

export const metadata = {
    title: 'Change Password',
}

export default async function MobileChangePasswordPage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <MobileChangePasswordClient />
    )
}
