import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminLeaveApproval } from "@/features/attendance/AdminLeaveApproval"
import { PageHeading } from "@/components/ui/page-heading"

export default function AdminLeavesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        title="Leave Management"
                        description="Review and approve employee leave requests"
                    />
                    <ErrorBoundary level="section">
                        <AdminLeaveApproval />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
