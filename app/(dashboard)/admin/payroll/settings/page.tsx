import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminOfficeSettings } from "@/features/attendance/AdminOfficeSettings"
import { PageHeading } from "@/components/ui/page-heading"

export default function AdminSettingsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout>
                <div className="space-y-6">
                    <PageHeading
                        title="Payroll Settings"
                        description="Configure office timings and manage holidays"
                    />
                    <ErrorBoundary level="section">
                        <AdminOfficeSettings />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
