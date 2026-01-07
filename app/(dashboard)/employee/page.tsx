import { ErrorBoundary } from '@/components/ui/error-boundary'
import EmployeeDashboard from '@/components/dashboard/employee-dashboard'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { getServerClient } from '@/lib/trpc/server-client'
import { DASHBOARD_QUERY_PARAMS } from '@/lib/dashboard-config'

export default async function EmployeeDashboardPage() {
    let initialData = null

    try {
        // Current date in IST (GMT+5:30) for accurate server-side prefetch
        // This must match the client's local date calculation to avoid hydration mismatch
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes
        const istDate = new Date(now.getTime() + istOffset);
        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Prefetch data on the server for instant loading
        const trpc = await getServerClient()

        // OPTIMIZATION: Only fetch attendance status (already cached from login)
        // Employees don't need the heavy unified dashboard query (that's for admins)
        const attendanceStatus = await trpc.attendance.getTodayStatus({ localDate: todayStr })

        initialData = {
            attendanceStatus
        }
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
