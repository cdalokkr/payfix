import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { MonthlyAttendanceCompilation } from "@/features/attendance/MonthlyAttendanceCompilation"

export default function ModeratorMonthlyAttendancePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Monthly Attendance"
                description="Compile and confirm monthly attendance for payroll"
            >
                <ErrorBoundary level="section">
                    <MonthlyAttendanceCompilation basePath="/moderator/payroll" />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
