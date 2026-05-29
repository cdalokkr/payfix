"use client"

import { MetricCard } from "@/components/dashboard/metric-card"
import {
    Activity,
    BarChart3,
    Clock,
    Calendar,
    IndianRupee,
    Ticket,
    User,
    Bell,
    LogOut,
    MapPin,
    TrendingUp
} from "lucide-react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { ActivityLogFeed, type UserActivity } from "@/components/dashboard/activity-log-feed"
import { format, isValid } from "date-fns"
import { useEffect, useState, useMemo } from "react"
import { useProfile } from "@/lib/context/profile-context"
import { createClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"

interface ActivitiesCardProps {
    activities: UserActivity[]
    loading: boolean
}

function ActivitiesCard({ activities, loading }: ActivitiesCardProps) {
    return (
        <MetricCard
            className="shadow-xl border-border/40"
            gradientColor="from-purple-500/10 to-indigo-500/5"
            delay={0.4}
            disableHover={true}
            borderColor="border-primary/10"
            cardBgColor="bg-card/50"
        >
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight">Recent Activities</h3>
                        <p className="text-sm text-muted-foreground">Your latest actions and updates</p>
                    </div>
                </div>
                <div className="bg-background/30 rounded-2xl border border-primary/5 p-4">
                    <ActivityLogFeed activities={activities} isLoading={loading} />
                </div>
            </div>
        </MetricCard>
    )
}

export default function EmployeeDashboard({ initialData }: { initialData?: any }) {
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const { profile } = useProfile()

    // Date calculations for timezone consistency (IST GMT+5:30)
    const localDateStr = useMemo(() => {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    // 1. Fetch Today's attendance status (lightweight query)
    const { data: todayAttendance, isLoading: todayLoading } = trpc.attendance.getMobileAttendance.useQuery(undefined, {
        staleTime: 30000,
        refetchOnWindowFocus: false,
    })

    // 2. Fetch Personal Leave Summary
    const { data: leavesList, isLoading: leavesLoading } = trpc.attendance.getLeaves.useQuery(
        { status: 'all' },
        {
            staleTime: 30000,
            refetchOnWindowFocus: false,
        }
    )

    // 3. Fetch Unread Notifications Count
    const { data: unreadNotifications, isLoading: notificationsLoading } = trpc.notification.getUnreadCount.useQuery(undefined, {
        staleTime: 15000,
        refetchOnWindowFocus: false,
    })

    // 4. Fetch Last Session Data
    const { data: sessionInfo, isLoading: sessionLoading } = trpc.profile.getLastSession.useQuery(undefined, {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    })

    // 5. Fetch Recent Activities
    const { data: activitiesData, isLoading: activitiesLoading, refetch: refetchActivities } = trpc.admin.dashboard.getRecentActivities.useQuery(
        { limit: 10 },
        {
            staleTime: 30000,
            refetchOnWindowFocus: false,
            refetchOnMount: 'always'
        }
    )
    const recentActivities = activitiesData?.data || []

    // Subscribe to real-time activity updates
    useEffect(() => {
        if (!profile?.id) return

        const supabase = createClient()
        const channel = supabase
            .channel(`employee-activities-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'activities',
                    filter: `user_id=eq.${profile.id}`
                },
                (payload) => {
                    console.log('[EMPLOYEE-DASHBOARD] Activity change detected:', payload.eventType)
                    refetchActivities()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.id, refetchActivities])

    // Format display states
    const clockStatusText = useMemo(() => {
        if (!todayAttendance) return 'Not Clocked In'
        if (todayAttendance.check_in && !todayAttendance.check_out) return 'Clocked In'
        return 'Punches Completed'
    }, [todayAttendance])

    const clockStatusColor = useMemo(() => {
        if (!todayAttendance) return 'text-amber-600 bg-amber-500/10 border-amber-500/20'
        if (todayAttendance.check_in && !todayAttendance.check_out) return 'text-blue-600 bg-blue-500/10 border-blue-500/20'
        return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
    }, [todayAttendance])

    const totalApprovedLeaves = useMemo(() => {
        if (!leavesList) return 0
        return leavesList.filter(l => l.status === 'approved').length
    }, [leavesList])

    const totalPendingLeaves = useMemo(() => {
        if (!leavesList) return 0
        return leavesList.filter(l => l.status === 'pending').length
    }, [leavesList])

    const isDataLoading = todayLoading || leavesLoading || notificationsLoading || sessionLoading || activitiesLoading

    return (
        <div className="space-y-6 gesture-friendly">
            
            {/* Live Metrics Row (Cohesive 4-Column Grid) */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {/* Today's Punch Card */}
                <Link href="/employee/attendance" className="block h-full">
                    <MetricCard
                        title="Today's Punch"
                        value={clockStatusText}
                        description={
                            todayAttendance?.check_in 
                                ? `In: ${format(new Date(todayAttendance.check_in), "HH:mm")}${todayAttendance.check_out ? ` | Out: ${format(new Date(todayAttendance.check_out), "HH:mm")}` : ''}`
                                : 'Daily check-in required'
                        }
                        icon={<Clock />}
                        loading={todayLoading}
                        iconBgColor="bg-blue-500/15"
                        iconColor="text-blue-600 dark:text-blue-400"
                        borderColor="border-blue-500/10"
                        gradientColor="from-blue-500/10 to-cyan-500/5"
                        cardBgColor="bg-blue-50/20 dark:bg-blue-950/10"
                        delay={0.1}
                    />
                </Link>

                {/* Leaves Balance Card */}
                <Link href="/employee/payroll/leaves" className="block h-full">
                    <MetricCard
                        title="My Leaves"
                        value={`${totalApprovedLeaves} Approved`}
                        description={`${totalPendingLeaves} pending approval`}
                        icon={<Calendar />}
                        loading={leavesLoading}
                        iconBgColor="bg-purple-500/15"
                        iconColor="text-purple-600 dark:text-purple-400"
                        borderColor="border-purple-500/10"
                        gradientColor="from-purple-500/10 to-indigo-500/5"
                        cardBgColor="bg-purple-50/20 dark:bg-purple-950/10"
                        delay={0.15}
                    />
                </Link>

                {/* Alerts/Notifications Card */}
                <MetricCard
                    title="Unread Alerts"
                    value={notificationsLoading ? 0 : (unreadNotifications || 0)}
                    description="Pending unread notifications"
                    icon={<Bell />}
                    loading={notificationsLoading}
                    iconBgColor="bg-amber-500/15"
                    iconColor="text-amber-600 dark:text-amber-400"
                    borderColor="border-amber-500/10"
                    gradientColor="from-amber-500/10 to-red-500/5"
                    cardBgColor="bg-amber-50/20 dark:bg-amber-950/10"
                    delay={0.2}
                />

                {/* Session Card */}
                <MetricCard
                    title="Last Logout"
                    value={
                        sessionInfo?.lastLogout && isValid(new Date(sessionInfo.lastLogout))
                            ? format(new Date(sessionInfo.lastLogout), "MMM dd, HH:mm")
                            : "No recent logout"
                    }
                    description={`Joined: ${sessionInfo?.joinedAt ? format(new Date(sessionInfo.joinedAt), "MMM yyyy") : 'N/A'}`}
                    icon={<LogOut />}
                    loading={sessionLoading}
                    iconBgColor="bg-rose-500/15"
                    iconColor="text-rose-600 dark:text-rose-400"
                    borderColor="border-rose-500/10"
                    gradientColor="from-rose-500/10 to-pink-500/5"
                    cardBgColor="bg-rose-50/20 dark:bg-rose-950/10"
                    delay={0.25}
                />
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 gap-6">
                <MetricCard
                    className="shadow-xl border-border/40"
                    gradientColor="from-primary/10 to-transparent"
                    delay={0.3}
                    disableHover={true}
                    borderColor="border-primary/10"
                    cardBgColor="bg-card/50"
                >
                    <div className="flex flex-col gap-4 h-full">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-1 bg-primary rounded-full" />
                                <h3 className="text-xl font-bold tracking-tight">Quick Actions</h3>
                            </div>
                            <div className="text-right px-4">
                                <p className="text-lg font-bold tracking-tight tabular-nums text-foreground" suppressHydrationWarning>{format(currentTime, "hh:mm:ss a")}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Current Time</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-2">
                            {/* Attendance Clock In */}
                            <Link
                                href="/employee/attendance"
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-blue-200/40 bg-blue-50/30 dark:bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 group-hover/action:scale-115 group-hover/action:rotate-3 transition-all">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Clock In/Out</p>
                                    <p className="text-sm font-semibold group-hover/action:font-black group-hover/action:text-blue-600 transition-all duration-300">Mark Presence</p>
                                </div>
                            </Link>

                            {/* Leaves Application */}
                            <Link
                                href="/employee/payroll/leaves"
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-200/40 bg-purple-50/30 dark:bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 group-hover/action:scale-115 group-hover/action:-rotate-3 transition-all">
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Leaves</p>
                                    <p className="text-sm font-semibold group-hover/action:font-black group-hover/action:text-purple-600 transition-all duration-300">Apply Leave</p>
                                </div>
                            </Link>

                            {/* Payroll Dashboard */}
                            <Link
                                href="/employee/payroll/dashboard"
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-emerald-200/40 bg-emerald-50/30 dark:bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 group-hover/action:scale-115 group-hover/action:rotate-3 transition-all">
                                    <IndianRupee className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Pay Slips</p>
                                    <p className="text-sm font-semibold group-hover/action:font-black group-hover/action:text-emerald-600 transition-all duration-300">Payroll Panel</p>
                                </div>
                            </Link>

                            {/* Support Tickets */}
                            <Link
                                href="/employee/tickets"
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200/40 bg-amber-50/30 dark:bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 group-hover/action:scale-115 group-hover/action:-rotate-3 transition-all">
                                    <Ticket className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Helpdesk</p>
                                    <p className="text-sm font-semibold group-hover/action:font-black group-hover/action:text-amber-600 transition-all duration-300">Support Tickets</p>
                                </div>
                            </Link>

                            {/* Profile Settings */}
                            <Link
                                href="/employee/profile"
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200/40 bg-indigo-50/30 dark:bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 group-hover/action:scale-115 group-hover/action:rotate-3 transition-all">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Settings</p>
                                    <p className="text-sm font-semibold group-hover/action:font-black group-hover/action:text-indigo-600 transition-all duration-300">My Profile</p>
                                </div>
                            </Link>

                            {/* Reports & Insights */}
                            <Link
                                href="/employee/reports"
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-200/40 bg-rose-50/30 dark:bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/5 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 group-hover/action:scale-115 group-hover/action:-rotate-3 transition-all">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Reports</p>
                                    <p className="text-sm font-semibold group-hover/action:font-black group-hover/action:text-rose-600 transition-all duration-300">Analytics</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </MetricCard>
            </div>

            {/* Recent Activities */}
            <ActivitiesCard activities={recentActivities as any} loading={activitiesLoading} />
        </div>
    )
}
