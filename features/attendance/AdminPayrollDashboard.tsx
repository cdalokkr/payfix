"use client"

import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"
import { Settings, ArrowRight, Plane as PlaneIcon, Clock as ClockIcon, CalendarCheck as CalendarCheckIcon, CalendarMinus as CalendarMinusIcon, Users as UsersIcon } from "lucide-react"
import Link from "next/link"
import { useProfile } from '@/lib/context/profile-context'
import { useSharedManagementChannel } from "@/hooks/use-shared-management-channel"
import { CompactMetricCard } from "@/components/dashboard/compact-metric-card"
import { CardShell } from "./CardShell"
import { format, parseISO, isWithinInterval } from "date-fns"

export function AdminPayrollDashboard() {
    const { profile } = useProfile()
    const { subscribe } = useSharedManagementChannel()

    // Queries with real-time friendly settings
    const { data: attendance, isLoading: attendanceLoading, isFetching: attendanceFetching, refetch: refetchAttendance } = trpc.attendance.getAttendance.useQuery(
        {},
        {
            staleTime: 0,
            refetchOnWindowFocus: false,
        }
    )
    const { data: leaves, isLoading: leavesLoading, isFetching: leavesFetching, refetch: refetchLeaves } = trpc.attendance.getLeaves.useQuery(
        { status: 'all' }, // Get all to filter locally
        {
            staleTime: 0,
            refetchOnWindowFocus: false,
        }
    )

    // Subscribe to shared management channel for real-time updates
    useEffect(() => {
        if (!profile?.id) return

        const unsubscribe = subscribe((category, payload) => {
            if (category === 'attendance_update' || category === 'dashboard_sync' || category === 'leave_update') {
                const action = payload?.action
                if (action === 'clock-in' || action === 'clock-out' || action === 'verified' || action === 'rejected' || action === 'leave-apply' || action === 'leave-approve') {
                    refetchAttendance()
                    refetchLeaves()
                }
            }
        })

        return unsubscribe
    }, [profile?.id, subscribe, refetchAttendance, refetchLeaves])

    const todayStr = format(new Date(), 'yyyy-MM-dd')

    const pendingVerification = attendance?.filter(a => a.status === 'pending').length || 0
    const pendingLeaves = leaves?.filter(l => l.status === 'pending').length || 0

    const clockedInToday = attendance?.filter(a => a.date === todayStr && a.check_in).length || 0
    const onLeaveToday = leaves?.filter(l => {
        if (l.status !== 'approved') return false
        const start = parseISO(l.start_date)
        const end = parseISO(l.end_date)
        return isWithinInterval(new Date(todayStr), { start, end })
    }).length || 0

    return (
        <div className="space-y-8">
            {/* Stats summary sectioned into Shells */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CardShell
                    title="Pending Approval"
                    icon={ClockIcon}
                    className="xl:col-span-1"
                    description="Actions requiring administrative attention"
                    contentClassName="min-h-0 p-4 pt-2"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <CompactMetricCard
                            label="Attendance"
                            value={pendingVerification}
                            icon={ClockIcon}
                            theme="emerald"
                            loading={attendanceLoading || attendanceFetching}
                        />
                        <CompactMetricCard
                            label="Leave"
                            value={pendingLeaves}
                            icon={CalendarMinusIcon}
                            theme="amber"
                            loading={leavesLoading || leavesFetching}
                        />
                    </div>
                </CardShell>

                <CardShell
                    title="Today's Attendance"
                    icon={CalendarCheckIcon}
                    className="xl:col-span-1"
                    description={`Overview for ${format(new Date(), 'MMM dd, yyyy')}`}
                    contentClassName="min-h-0 p-4 pt-2"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <CompactMetricCard
                            label="Clock In"
                            value={clockedInToday}
                            icon={UsersIcon}
                            theme="blue"
                            loading={attendanceLoading || attendanceFetching}
                        />
                        <CompactMetricCard
                            label="Leave"
                            value={onLeaveToday}
                            icon={CalendarMinusIcon}
                            theme="rose"
                            loading={leavesLoading || leavesFetching}
                        />
                    </div>
                </CardShell>
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
                                <CalendarCheckIcon className="h-5 w-5 text-primary" />
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
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <PlaneIcon className="h-5 w-5 text-primary rotate-45" />
                                </div>
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
