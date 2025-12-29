import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminLeaveApproval } from "@/features/attendance/AdminLeaveApproval"
import { PageHeading } from "@/components/ui/page-heading"

export default function ModeratorLeavesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Leave Approvals"
                description="Review and manage employee leave requests"
            >
                <ErrorBoundary level="section">
                    <AdminLeaveApproval />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
