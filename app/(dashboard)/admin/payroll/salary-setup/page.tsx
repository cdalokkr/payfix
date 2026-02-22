import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { SalarySetupManagement } from "@/features/attendance/SalarySetupManagement"

export default function AdminSalarySetupPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Salary Setup"
                description="Configure salary components for each employee"
            >
                <ErrorBoundary level="section">
                    <SalarySetupManagement />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
