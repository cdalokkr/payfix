import { ErrorBoundary } from '@/components/ui/error-boundary'
import EmployeeDashboard from '@/components/dashboard/employee-dashboard'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { getServerClient } from '@/lib/trpc/server-client'
import { DASHBOARD_QUERY_PARAMS } from '@/lib/dashboard-config'

export default async function EmployeeDashboardPage() {
    let initialData = null

    try {
        // Prefetch data on the server for instant loading
        const trpc = await getServerClient()
        initialData = await trpc.admin.dashboard.getUnifiedDashboardData(DASHBOARD_QUERY_PARAMS)
    } catch (error) {
        console.error('[EMPLOYEE-PAGE] Prefetch failed:', error)
    }

    return (
        <ErrorBoundary level="page">
            <DashboardPageLayout
                heading="Employee Dashboard"
                description="Welcome back! Here is an overview of your common tasks and recent activity."
            >
                <ErrorBoundary level="section">
                    <EmployeeDashboard initialData={initialData} />
                </ErrorBoundary>
            </DashboardPageLayout>
        </ErrorBoundary>
    )
}
