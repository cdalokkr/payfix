import { PageErrorBoundary } from '@/components/ui/error-boundary'
import { AdminDashboardStreaming } from '@/components/dashboard/admin-dashboard-streaming'
import { getServerClient } from '@/lib/trpc/server-client'
import { DASHBOARD_QUERY_PARAMS } from '@/lib/dashboard-config'

export default async function AdminDashboardPage() {
  let initialData = null

  try {
    // Prefetch data on the server to eliminate initial loading skeletons
    // This uses the cached context and optimized queries for maximum speed
    const trpc = await getServerClient()
    initialData = await trpc.admin.dashboard.getUnifiedDashboardData(DASHBOARD_QUERY_PARAMS)
  } catch (error) {
    console.error('[ADMIN-PAGE] Prefetch failed:', error)
    // Fallback to client-side loading if prefetch fails
  }

  return (
    <PageErrorBoundary>
      <AdminDashboardStreaming initialData={initialData} />
    </PageErrorBoundary>
  )
}