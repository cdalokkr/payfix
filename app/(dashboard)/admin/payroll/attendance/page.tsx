import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminAttendanceVerification } from "@/features/attendance/AdminAttendanceVerification"
import { PageHeading } from "@/components/ui/page-heading"

export default function AdminAttendancePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Attendance Management"
                description="Verify and manage all employee attendance logs"
            >
                <ErrorBoundary level="section">
                    <AdminAttendanceVerification />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
