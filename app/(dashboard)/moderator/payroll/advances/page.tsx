import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AdvanceManagement } from "@/features/attendance/AdvanceManagement"

export default function ModeratorAdvancesPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardPageLayout
                heading="Advance / Loan Management"
                description="Track and manage employee advances and loans"
            >
                <ErrorBoundary level="section">
                    <AdvanceManagement />
                </ErrorBoundary>
            </DashboardPageLayout>
        </div>
    )
}
