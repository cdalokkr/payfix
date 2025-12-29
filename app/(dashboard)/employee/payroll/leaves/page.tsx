import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { LeaveApplication } from "@/features/attendance/LeaveApplication"
import { PageHeading } from "@/components/ui/page-heading"

export default function EmployeeLeavesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Leave Management"
                description="Apply for leaves and track your requests"
            >
                <ErrorBoundary level="section">
                    <LeaveApplication />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
