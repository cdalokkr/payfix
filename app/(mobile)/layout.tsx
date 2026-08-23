import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TRPCProvider } from '@/lib/trpc/provider'
import '@/app/globals.css'
import { MobileHeader } from './mobile-header'
import { MobileBottomNav } from './mobile-bottom-nav'
import { PermissionGuard } from '@/features/mobile/PermissionGuard'
import { OfflineBanner } from '@/components/ui/offline-banner'
import { BiometricCameraPrewarm } from '@/features/mobile/biometric-camera-prewarm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MobileLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Check PWA standalone status from server-side cookies
    const cookieStore = await cookies()
    const isPwa = cookieStore.get('pwa_standalone')?.value === 'true'

    // Check authentication for current request
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Direct query to tenant private schema for the authenticated user
    const { db } = await import('@/lib/db')
    const { profiles } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')
    const { runWithRequestHeaders } = await import('@/lib/tenant/with-context')

    const profile = await runWithRequestHeaders(async () => {
        return await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id)
        })
    })

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
                <BiometricCameraPrewarm />
                {/* Sticky Header */}
                <MobileHeader profile={profile} />

                {/* Offline Network Resilience Banner */}
                <OfflineBanner message="Offline Mode: Punches will sync automatically when reconnected." />

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
