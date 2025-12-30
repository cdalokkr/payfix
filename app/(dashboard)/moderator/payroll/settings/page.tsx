import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { ModeratorOfficeSettings } from "@/features/attendance/ModeratorOfficeSettings"

export default function ModeratorSettingsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Payroll Settings"
                description="View office timings and manage holidays"
            >
                <ErrorBoundary level="section">
                    <ModeratorOfficeSettings />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
