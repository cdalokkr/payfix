import { Metadata } from "next"
import { AdminAnalyticsView } from "@/features/reports/components/admin-analytics-view"
import { PageErrorBoundary } from "@/components/ui/error-boundary"

export const metadata: Metadata = {
    title: "Analytics | Admin Dashboard",
    description: "System analytics and overview",
}

export default function AdminAnalyticsPage() {
    return (
        <PageErrorBoundary>
            <AdminAnalyticsView />
        </PageErrorBoundary>
    )
}
