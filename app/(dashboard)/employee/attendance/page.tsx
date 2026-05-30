import { redirect } from "next/navigation"

export default function AttendancePageRedirect() {
    redirect("/employee/attendance-history")
}

