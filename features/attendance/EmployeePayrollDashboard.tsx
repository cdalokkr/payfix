"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/dashboard/metric-card"
import { trpc } from "@/lib/trpc/client"
import { CalendarCheck, CalendarOff, Clock, UserCheck, Briefcase, Plane } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { DailyAttendanceCard } from "./DailyAttendanceCard"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"
import { useProfile } from '@/lib/context/profile-context'
import { useMemo } from "react"
import { motion } from "framer-motion"

export function EmployeePayrollDashboard() {
    const { profile } = useProfile()

    // Enable real-time subscription for attendance updates
    // This will show toasts on verify/reject/edit and auto-refresh data
    useUserRealtimeDashboard(
        profile?.id || '',
        undefined,
        'employee'  // Employee role
    )

    // Fetch last 7 days of attendance to compute the 7-day trend
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)

    const { data: attendance, isLoading: attendanceLoading, isFetching: attendanceFetching } = trpc.attendance.getAttendance.useQuery({
        profileId: profile?.id,
        startDate: format(lastWeek, 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    }, {
        enabled: !!profile?.id
    })

    const { data: leaves, isLoading: leavesLoading, isFetching: leavesFetching } = trpc.attendance.getLeaves.useQuery({
        profileId: profile?.id,
        status: 'all'
    })

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayRecord = useMemo(() => {
        if (!attendance) return undefined
        return attendance.find(r => r.date.split('T')[0] === todayStr)
    }, [attendance, todayStr])

    const last7DaysAttendance = useMemo(() => {
        if (!attendance) return []
        // Sort ascending by date and slice last 7 days
        return [...attendance]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-7)
    }, [attendance])

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
                    cardBgColor="bg-amber-5/30 dark:bg-amber-500/5"
                    borderColor="border-amber-200/50"
                    gradientColor="from-amber-500/10 to-transparent"
                    delay={0.1}
                    loading={leavesLoading || leavesFetching}
                >
                    <div className="mt-4 h-10 flex items-center justify-between">
                        <div className="flex gap-1.5 items-end h-full">
                            <svg className="w-24 h-8 overflow-visible text-amber-500/30" viewBox="0 0 100 30">
                                <path
                                    d="M0 25 Q15 15, 30 22 T60 8 T90 12 T100 4"
                                    fill="none"
                                    stroke="rgb(245, 158, 11)"
                                    strokeWidth="1.5"
                                />
                                <path
                                    d="M0 25 Q15 15, 30 22 T60 8 T90 12 T100 4 L100 30 L0 30 Z"
                                    fill="url(#amber-gradient)"
                                    opacity="0.3"
                                />
                                <defs>
                                    <linearGradient id="amber-gradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/60 dark:text-amber-400/50">Active Burn-down</span>
                    </div>
                </MetricCard>

                <MetricCard
                    title="Attendance Status"
                    value={todayRecord?.status || 'N/A'}
                    icon={<UserCheck className="h-4 w-4" />}
                    description="Today's verification"
                    iconBgColor="bg-green-500/10"
                    iconColor="text-green-600"
                    cardBgColor="bg-green-5/30 dark:bg-green-500/5"
                    borderColor="border-green-200/50"
                    gradientColor="from-green-500/10 to-transparent"
                    delay={0.2}
                    loading={attendanceLoading || attendanceFetching}
                >
                    <div className="mt-4 h-10 flex items-center justify-between">
                        <div className="flex gap-1 items-end h-full">
                            <svg className="w-24 h-8 overflow-visible text-green-500/30" viewBox="0 0 100 30">
                                <path
                                    d="M0 28 L20 28 L40 5 L60 5 L80 28 L100 5"
                                    fill="none"
                                    stroke="rgb(34, 197, 94)"
                                    strokeWidth="1.5"
                                />
                                <path
                                    d="M0 28 L20 28 L40 5 L60 5 L80 28 L100 5 L100 30 L0 30 Z"
                                    fill="url(#green-gradient)"
                                    opacity="0.3"
                                />
                                <defs>
                                    <linearGradient id="green-gradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-green-600/60 dark:text-green-400/50">Weekly presence</span>
                    </div>
                </MetricCard>

                <MetricCard
                    title="Work Hours"
                    value={todayRecord?.working_hours ? `${todayRecord.working_hours.toFixed(1)}h` : '0h'}
                    icon={<Briefcase className="h-4 w-4" />}
                    description="Today's total"
                    iconBgColor="bg-blue-500/10"
                    iconColor="text-blue-600"
                    cardBgColor="bg-blue-5/30 dark:bg-blue-500/5"
                    borderColor="border-blue-200/50"
                    gradientColor="from-blue-500/10 to-transparent"
                    delay={0.3}
                    loading={attendanceLoading || attendanceFetching}
                >
                    <div className="mt-4 h-10 flex items-center justify-between">
                        <div className="flex gap-1.5 items-end h-8">
                            {last7DaysAttendance.map((rec, i) => {
                                const hrs = Number(rec.working_hours) || 0
                                // Max height is 30px, representing 10 hours max
                                const barHeight = Math.min(30, Math.max(2, (hrs / 10) * 30))
                                return (
                                    <div key={i} className="flex flex-col items-center gap-1 group/bar">
                                        <div 
                                            className="w-2 rounded-t-[1px] bg-blue-500/30 group-hover/bar:bg-blue-500 transition-colors duration-300"
                                            style={{ height: `${barHeight}px` }}
                                            title={`${hrs.toFixed(1)}h worked on ${format(new Date(rec.date), 'MMM dd')}`}
                                        />
                                    </div>
                                )
                            })}
                            {last7DaysAttendance.length === 0 && (
                                <div className="flex gap-1 items-end h-8">
                                    {[4, 6, 8, 2, 9, 8, 5].map((val, i) => (
                                        <div 
                                            key={i} 
                                            className="w-2 rounded-t-[1px] bg-blue-500/20"
                                            style={{ height: `${(val / 10) * 30}px` }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600/60 dark:text-blue-400/50">7-day hours trend</span>
                    </div>
                </MetricCard>
            </div>

            {/* Quick Actions */}
            <div className="pt-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h3 className="text-lg font-bold tracking-tight">Payroll Quick Actions</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <motion.div
                        whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                        whileTap={{ scale: 0.98 }}
                        className="h-full"
                    >
                        <Card className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden border-primary/5 bg-card/60 backdrop-blur-md h-full flex flex-col justify-between">
                            <CardHeader className="pb-4">
                                <div className="p-3 w-fit rounded-xl bg-primary/10 mb-2 group-hover:scale-110 transition-transform">
                                    <CalendarCheck className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle>Attendance</CardTitle>
                                <CardDescription>View your attendance history and mark daily status</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/employee/attendance-history">
                                    <Button variant="outline" className="w-full group/btn font-semibold">
                                        Manage Attendance <Clock className="ml-2 h-4 w-4 group-hover/btn:rotate-12 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div
                        whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                        whileTap={{ scale: 0.98 }}
                        className="h-full"
                    >
                        <Card className="group hover:border-amber-500/50 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden border-amber-500/5 bg-card/60 backdrop-blur-md h-full flex flex-col justify-between">
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
                    </motion.div>

                    <motion.div
                        whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                        whileTap={{ scale: 0.98 }}
                        className="h-full"
                    >
                        <Card className="group hover:border-emerald-500/50 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden border-emerald-500/5 bg-card/60 backdrop-blur-md h-full flex flex-col justify-between">
                            <CardHeader className="pb-4">
                                <div className="p-3 w-fit rounded-xl bg-emerald-500/10 mb-2 group-hover:scale-110 transition-transform">
                                    <Briefcase className="h-6 w-6 text-emerald-600" />
                                </div>
                                <CardTitle>Salary & Advances</CardTitle>
                                <CardDescription>View your monthly payslips and adjust loan/advance requests</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/employee/payroll/advances">
                                    <Button variant="outline" className="w-full group/btn font-semibold hover:border-emerald-500/50 hover:bg-emerald-50/50">
                                        Manage Advances <Briefcase className="ml-2 h-4 w-4 group-hover/btn:translate-y-0.5 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

