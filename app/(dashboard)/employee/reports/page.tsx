import { Metadata } from "next"
import { UserReportsView } from "@/features/reports/components/user-reports-view"

export const metadata: Metadata = {
    title: "Reports | Employee Dashboard",
    description: "Personal reports and activity analytics for employees",
}

export default function EmployeeReportsPage() {
    return <UserReportsView />
}
