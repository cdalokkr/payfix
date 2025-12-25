import { Metadata } from "next"
import { AdminReportsView } from "@/features/reports/components/admin-reports-view"

export const metadata: Metadata = {
    title: "Reports | Admin Dashboard",
    description: "System-wide reports and analytics",
}

export default function AdminReportsPage() {
    return <AdminReportsView />
}
