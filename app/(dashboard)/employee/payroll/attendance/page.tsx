import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AttendanceControl } from "@/features/attendance/AttendanceControl"
import { AttendanceHistory } from "@/features/attendance/AttendanceHistory"
import { PageHeading } from "@/components/ui/page-heading"

export default function EmployeeAttendancePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        title="Office Attendance"
                        description="Manage your daily check-in and check-out"
                    />
                    <ErrorBoundary level="section">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1">
                                <AttendanceControl />
                            </div>
                            <div className="md:col-span-2">
                                <AttendanceHistory />
                            </div>
                        </div>
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
