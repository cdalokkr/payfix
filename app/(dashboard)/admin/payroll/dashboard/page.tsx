import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminPayrollDashboard } from "@/features/attendance/AdminPayrollDashboard"
import { PageHeading } from "@/components/ui/page-heading"

export default function AdminPayrollDashboardPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        title="Payroll Administration"
                        description="Manage employee attendance, leaves, and organization settings"
                    />
                    <ErrorBoundary level="section">
                        <AdminPayrollDashboard />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
