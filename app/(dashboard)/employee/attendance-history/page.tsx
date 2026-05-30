import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AttendanceDashboard } from "@/features/attendance/AttendanceDashboard"

export default function AttendanceHistoryPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Attendance History"
                description="View your monthly presence, summaries and manage daily check-ins"
            >
                <ErrorBoundary level="section">
                    <AttendanceDashboard />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
