import { PageErrorBoundary } from '@/components/ui/error-boundary'
import { UserDashboardStreaming } from '@/components/dashboard/user-dashboard-streaming'
import { getServerClient } from '@/lib/trpc/server-client'
import { DASHBOARD_QUERY_PARAMS } from '@/lib/dashboard-config'

export default async function ModeratorDashboardPage() {
    let initialData = null

    try {
        // Prefetch dashboard data on the server to eliminate initial loading skeletons
        // This uses the cached context and optimized queries for maximum speed
        const trpc = await getServerClient()
        initialData = await trpc.admin.dashboard.getUnifiedDashboardData(DASHBOARD_QUERY_PARAMS)
    } catch (error) {
        console.error('[MODERATOR-PAGE] Prefetch failed:', error)
        // Fallback to client-side loading if prefetch fails
    }

    return (
        <PageErrorBoundary>
            <UserDashboardStreaming initialData={initialData} />
        </PageErrorBoundary>
    )
}
