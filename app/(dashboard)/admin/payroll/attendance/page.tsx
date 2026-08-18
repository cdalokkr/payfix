import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminAttendanceVerification } from "@/features/attendance/AdminAttendanceVerification"

export default function AdminAttendancePage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Attendance Management"
                description="Monitor real-time biometric & kiosk punches, verify and manage employee attendance logs"
            >
                <div className="space-y-6">
                    <ErrorBoundary level="section">
                        <AdminAttendanceVerification />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}

