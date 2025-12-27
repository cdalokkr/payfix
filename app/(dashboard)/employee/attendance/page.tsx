import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AttendanceDashboard } from "@/features/attendance/AttendanceDashboard"
import { PageHeading } from "@/components/ui/page-heading"

export default function AttendancePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        heading="Office Attendance"
                        description="View your monthly presence, summaries and manage daily check-ins"
                    />
                    <ErrorBoundary level="section">
                        <AttendanceDashboard />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
