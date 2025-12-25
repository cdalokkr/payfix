import { PageErrorBoundary } from '@/components/ui/error-boundary'
import { UserDashboardStreaming } from '@/components/dashboard/user-dashboard-streaming'
import { getServerClient } from '@/lib/trpc/server-client'
import { DASHBOARD_QUERY_PARAMS } from '@/lib/dashboard-config'

export default async function ModeratorDashboardPage() {
    let initialData = null

    try {
        // Prefetch data on the server for instant loading
        const trpc = await getServerClient()
        initialData = await trpc.admin.dashboard.getUnifiedDashboardData(DASHBOARD_QUERY_PARAMS)
    } catch (error) {
        console.error('[MODERATOR-PAGE] Prefetch failed:', error)
    }

    return (
        <PageErrorBoundary>
            <UserDashboardStreaming initialData={initialData} />
        </PageErrorBoundary>
    )
}
