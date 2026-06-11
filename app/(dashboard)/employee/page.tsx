import { ErrorBoundary } from '@/components/ui/error-boundary'
import EmployeeDashboard from '@/components/dashboard/employee-dashboard'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { getServerClient } from '@/lib/trpc/server-client'
import { DASHBOARD_QUERY_PARAMS } from '@/lib/dashboard-config'

export default async function EmployeeDashboardPage() {
    // No server-side prefetch is needed here as the client-side component performs lazy, concurrent fetching.
    // This turns the server component render into a fast, non-blocking operation.
    const initialData = null;

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
