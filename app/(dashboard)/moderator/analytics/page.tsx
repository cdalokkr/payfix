import { Metadata } from "next"
import { ModeratorAnalyticsView } from "@/features/reports/components/moderator-analytics-view"
import { PageErrorBoundary } from "@/components/ui/error-boundary"

export const metadata: Metadata = {
    title: "Analytics | Moderator",
    description: "System analytics and reports for moderators",
}

export default function ModeratorAnalyticsPage() {
    return (
        <PageErrorBoundary>
            <ModeratorAnalyticsView />
        </PageErrorBoundary>
    )
}
