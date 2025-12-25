import { Metadata } from "next"
import { UserReportsView } from "@/features/reports/components/user-reports-view"

export const metadata: Metadata = {
    title: "My Reports | User Dashboard",
    description: "Personal usage reports and analytics",
}

export default function UserReportsPage() {
    return <UserReportsView />
}
