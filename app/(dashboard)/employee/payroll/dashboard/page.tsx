import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { EmployeePayrollDashboard } from "@/features/attendance/EmployeePayrollDashboard"
import { PageHeading } from "@/components/ui/page-heading"

export default function EmployeePayrollDashboardPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        title="Payroll Dashboard"
                        description="Overview of your attendance, leaves, and payroll details"
                    />
                    <ErrorBoundary level="section">
                        <EmployeePayrollDashboard />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
