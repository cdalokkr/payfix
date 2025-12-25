import { Metadata } from "next"
import { ModeratorReportsView } from "@/features/reports/components/moderator-reports-view"

export const metadata: Metadata = {
    title: "Reports | Moderator Dashboard",
    description: "System reports and analytics for moderators",
}

export default function ModeratorReportsPage() {
    return <ModeratorReportsView />
}
