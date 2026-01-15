import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdminOfficeSettings } from "@/features/attendance/AdminOfficeSettings"
import { AdminOfficeLocations } from "@/features/settings/AdminOfficeLocations"

export default function AdminSettingsPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Payroll Settings"
                description="Configure office timings, locations, and manage holidays"
            >
                <div className="space-y-8">
                    {/* Office Locations for Geofencing */}
                    <ErrorBoundary level="section">
                        <AdminOfficeLocations />
                    </ErrorBoundary>

                    {/* Existing Office Settings */}
                    <ErrorBoundary level="section">
                        <AdminOfficeSettings />
                    </ErrorBoundary>
                </div>
            </DashboardPageLayout>
        </div>
    )
}
