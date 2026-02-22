import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { PayslipGeneration } from "@/features/attendance/PayslipGeneration"

export default function AdminPayslipsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Payslips"
                description="Generate and view employee payslips"
            >
                <ErrorBoundary level="section">
                    <PayslipGeneration basePath="/admin/payroll" />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
