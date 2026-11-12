import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { SalaryPassbookView } from "@/features/payroll/SalaryPassbookView"

export default function ModeratorSalaryBookPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Salary Book & Passbook"
                description="Comprehensive employee payroll ledger and payment passbook with grand total payment summary"
            >
                <ErrorBoundary level="section">
                    <SalaryPassbookView basePath="/moderator/payroll" />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
