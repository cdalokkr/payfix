import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { UnifiedPayrollHub } from "@/features/attendance/UnifiedPayrollHub"

export default function AdminPayslipsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Payroll & Payslips"
                description="Generate, review, lock, and distribute employee payslips"
            >
                <ErrorBoundary level="section">
                    <UnifiedPayrollHub basePath="/admin/payroll" defaultTab="payslips" />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
