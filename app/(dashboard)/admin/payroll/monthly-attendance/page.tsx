import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { UnifiedPayrollHub } from "@/features/attendance/UnifiedPayrollHub"

export default function AdminMonthlyAttendancePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Payroll & Payslips"
                description="Compile attendance, configure bonuses, and generate employee payslips in one unified workflow"
            >
                <ErrorBoundary level="section">
                    <UnifiedPayrollHub basePath="/admin/payroll" defaultTab="attendance" />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
