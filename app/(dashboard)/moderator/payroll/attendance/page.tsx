import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminAttendanceVerification } from "@/features/attendance/AdminAttendanceVerification"
import { PageHeading } from "@/components/ui/page-heading"

export default function ModeratorAttendancePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        title="Attendance Verification"
                        description="Verify and manage employee attendance logs"
                    />
                    <ErrorBoundary level="section">
                        <AdminAttendanceVerification />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
