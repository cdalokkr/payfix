import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminPayrollDashboard } from "@/features/attendance/AdminPayrollDashboard"
import { PageHeading } from "@/components/ui/page-heading"

export default function ModeratorPayrollDashboardPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        title="Payroll Management"
                        description="Overview of attendance and leave management"
                    />
                    <ErrorBoundary level="section">
                        <AdminPayrollDashboard />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
