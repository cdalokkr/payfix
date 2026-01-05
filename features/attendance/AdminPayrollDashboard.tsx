"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"
import { Users, CalendarCheck, CalendarOff, Clock, Settings, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"

export function AdminPayrollDashboard() {
    const { data: profile } = trpc.profile.get.useQuery()

    // Enable real-time updates for managers
    useUserRealtimeDashboard(
        profile?.id || '',
        undefined,
        (profile?.role as any) || 'moderator'
    )

    const { data: attendance, isLoading: attendanceLoading, isFetching: attendanceFetching } = trpc.attendance.getAttendance.useQuery({})
    const { data: leaves, isLoading: leavesLoading, isFetching: leavesFetching } = trpc.attendance.getLeaves.useQuery({ status: 'pending' })

    const pendingVerification = attendance?.filter(a => a.status === 'pending').length || 0
    const pendingLeaves = leaves?.length || 0

    return (
        <div className="space-y-6">
            {/* Stats summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title="Pending Verification"
                    value={pendingVerification.toString()}
                    icon={<Clock />}
                    description="Attendance records awaiting review"
                    iconBgColor="bg-amber-500/20"
                    iconColor="text-amber-700 dark:text-amber-400"
                    borderColor="border-amber-200/50 dark:border-amber-900/50"
                    cardBgColor="bg-amber-50/50 dark:bg-amber-900/5"
                    delay={0.1}
                    loading={attendanceLoading || attendanceFetching}
                />
                <MetricCard
                    title="Pending Leave Approvals"
                    value={pendingLeaves.toString()}
                    icon={<CalendarOff />}
                    description="Leave requests needing approval"
                    iconBgColor="bg-rose-500/20"
                    iconColor="text-rose-700 dark:text-rose-400"
                    borderColor="border-rose-200/50 dark:border-rose-900/50"
                    cardBgColor="bg-rose-50/50 dark:bg-rose-900/5"
                    delay={0.2}
                    loading={leavesLoading || leavesFetching}
                />
                <MetricCard
                    title="Total Attendance Records"
                    value={attendance?.length.toString() || "0"}
                    icon={<Users />}
                    description="All time attendance entries"
                    iconBgColor="bg-indigo-500/20"
                    iconColor="text-indigo-700 dark:text-indigo-400"
                    borderColor="border-indigo-200/50 dark:border-indigo-900/50"
                    cardBgColor="bg-indigo-50/50 dark:bg-indigo-900/5"
                    delay={0.3}
                    loading={attendanceLoading || attendanceFetching}
                />
            </div>

            {/* Admin Quick Actions */}
            <div className="pt-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h3 className="text-lg font-bold tracking-tight">Administrative Actions</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
                        <CardHeader>
                            <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                                <CalendarCheck className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle>Verify Attendance</CardTitle>
                            <CardDescription>Review and approve employee daily check-ins</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/admin/payroll/attendance">
                                <Button variant="outline" className="w-full group/btn">
                                    Go to Verification <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
                        <CardHeader>
                            <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                                <PlaneIcon className="h-5 w-5 text-primary rotate-45" />
                            </div>
                            <CardTitle>Leave Requests</CardTitle>
                            <CardDescription>Manage employee leave applications</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/admin/payroll/leaves">
                                <Button variant="outline" className="w-full group/btn">
                                    Review Leaves <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
                        <CardHeader>
                            <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                                <Settings className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle>Configure Office</CardTitle>
                            <CardDescription>Set office hours and manage holiday calendar</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/admin/payroll/settings">
                                <Button variant="outline" className="w-full group/btn">
                                    Manage Settings <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function PlaneIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
    )
}
