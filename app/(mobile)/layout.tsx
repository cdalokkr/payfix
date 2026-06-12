import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TRPCProvider } from '@/lib/trpc/provider'
import '@/app/globals.css'
import { MobileHeader } from './mobile-header'
import { MobileBottomNav } from './mobile-bottom-nav'
import { PermissionGuard } from '@/features/mobile/PermissionGuard'

export default async function MobileLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Check PWA standalone status from server-side cookies
    const cookieStore = await cookies()
    const isPwa = cookieStore.get('pwa_standalone')?.value === 'true'

    // Check authentication
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    const user = data?.user || null

    if (!user) {
        redirect('/login')
    }

    // Get profile to verify role
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, status, email')
        .eq('id', user.id)
        .single()

    if (!profile) {
        redirect('/login')
    }

    // Only employees and moderators can use mobile app
    if (profile.role !== 'employee' && profile.role !== 'moderator') {
        redirect(`/${profile.role}`)
    }

    if (profile.status === 'deactive') {
        redirect('/deactive-account')
    }

    return (
        <TRPCProvider>
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
                {/* Sticky Header */}
                <MobileHeader profile={profile} />

                {/* Main Content with padding for header and bottom nav */}
                <main className="max-w-md mx-auto px-4 pt-20 pb-24 min-h-screen">
                    <PermissionGuard isPwaServer={isPwa}>
                        {children}
                    </PermissionGuard>
                </main>

                {/* Bottom Navigation */}
                <MobileBottomNav />
            </div>
        </TRPCProvider>
    )
}
