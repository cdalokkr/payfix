"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/dashboard/metric-card"
import { trpc } from "@/lib/trpc/client"
import { CalendarCheck, CalendarOff, Clock, UserCheck, Briefcase, Plane } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { DailyAttendanceCard } from "./DailyAttendanceCard"

export function EmployeePayrollDashboard() {
    const { data: attendance, isLoading: attendanceLoading, isFetching: attendanceFetching } = trpc.attendance.getAttendance.useQuery({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    })

    const { data: leaves, isLoading: leavesLoading, isFetching: leavesFetching } = trpc.attendance.getLeaves.useQuery({
        status: 'all'
    })

    const todayRecord = attendance?.[0]
    const pendingLeaves = leaves?.filter(l => l.status === 'pending').length || 0

    return (
        <div className="space-y-6">


            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                    title="Pending Leaves"
                    value={pendingLeaves.toString()}
                    icon={<CalendarOff className="h-4 w-4" />}
                    description="Waiting for approval"
                    iconBgColor="bg-amber-500/10"
                    iconColor="text-amber-600"
                    cardBgColor="bg-amber-50/30 dark:bg-amber-500/5"
                    borderColor="border-amber-200/50"
                    delay={0.1}
                    loading={leavesLoading || leavesFetching}
                />
                <MetricCard
                    title="Attendance Status"
                    value={todayRecord?.status || 'N/A'}
                    icon={<UserCheck className="h-4 w-4" />}
                    description="Today's verification"
                    iconBgColor="bg-green-500/10"
                    iconColor="text-green-600"
                    cardBgColor="bg-green-50/30 dark:bg-green-500/5"
                    borderColor="border-green-200/50"
                    delay={0.2}
                    loading={attendanceLoading || attendanceFetching}
                />
                <MetricCard
                    title="Work Hours"
                    value={todayRecord?.working_hours ? `${todayRecord.working_hours.toFixed(1)}h` : '0h'}
                    icon={<Briefcase className="h-4 w-4" />}
                    description="Today's total"
                    iconBgColor="bg-blue-500/10"
                    iconColor="text-blue-600"
                    cardBgColor="bg-blue-50/30 dark:bg-blue-500/5"
                    borderColor="border-blue-200/50"
                    delay={0.3}
                    loading={attendanceLoading || attendanceFetching}
                />
            </div>

            {/* Quick Actions */}
            <div className="pt-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h3 className="text-lg font-bold tracking-tight">Payroll Quick Actions</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden border-primary/5">
                        <CardHeader className="pb-4">
                            <div className="p-3 w-fit rounded-xl bg-primary/10 mb-2 group-hover:scale-110 transition-transform">
                                <CalendarCheck className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Attendance</CardTitle>
                            <CardDescription>View your attendance history and mark daily status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/employee/attendance">
                                <Button variant="outline" className="w-full group/btn font-semibold">
                                    Manage Attendance <Clock className="ml-2 h-4 w-4 group-hover/btn:rotate-12 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="group hover:border-amber-500/50 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden border-amber-500/5">
                        <CardHeader className="pb-4">
                            <div className="p-3 w-fit rounded-xl bg-amber-500/10 mb-2 group-hover:scale-110 transition-transform">
                                <CalendarOff className="h-6 w-6 text-amber-600" />
                            </div>
                            <CardTitle>Leaves</CardTitle>
                            <CardDescription>Apply for leaves and check your request status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/employee/payroll/leaves">
                                <Button variant="outline" className="w-full group/btn font-semibold hover:border-amber-500/50 hover:bg-amber-50/50">
                                    Manage Leaves <Plane className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
