import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { EmployeeAdvancesDashboard } from "@/features/attendance/EmployeeAdvancesDashboard"

export default function EmployeeAdvancesPage() {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 dark:bg-slate-950">
            <DashboardPageLayout
                heading="My Advances"
                description="View your personal advance logs, outstanding balances, and loans."
            >
                <ErrorBoundary level="section">
                    <EmployeeAdvancesDashboard />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
