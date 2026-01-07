"use client"

import { MetricCard } from "@/components/dashboard/metric-card"
import { ActionButton } from "@/components/ui/action-button"
import { PageHeading } from "@/components/ui/page-heading"
import { Settings, Bell, User, Activity, LogIn, LogOut, Calendar, History, BarChart3, UserCheck, Loader2 } from "lucide-react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Activity as ActivityType } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityLogFeed, type UserActivity } from "@/components/dashboard/activity-log-feed"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useEffect, useState, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { getEventBroadcaster } from "@/lib/events/event-broadcaster"
import { useProfile } from "@/lib/context/profile-context"



interface ActivitiesCardProps {
    activities: UserActivity[]
    loading: boolean
}

function ActivitiesCard({ activities, loading }: ActivitiesCardProps) {
    return (
        <MetricCard
            className="shadow-xl"
            gradientColor="from-primary/5 to-transparent"
            delay={0.3}
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
    const utils = trpc.useUtils()
    const todayStr = useMemo(() => {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Get profile to obtain userId for real-time subscriptions
    const { profile } = useProfile()

    // OPTIMIZATION: Employees don't need the heavy unified dashboard query
    // Just fetch recent activities with a lightweight query
    const { data: activitiesData, isLoading: activitiesLoading } = trpc.admin.dashboard.getRecentActivities.useQuery(
        { limit: 10 },
        { staleTime: 30000, refetchOnWindowFocus: false }
    )
    const recentActivities = activitiesData?.data || []
    const isLoading = activitiesLoading

    // =====================================================
    // ATTENDANCE BUTTON STATE - Simple, Fast, Fresh
    // =====================================================
    // Uses dedicated endpoint that returns: 'not_clocked_in' | 'clocked_in' | 'marked'
    const { data: attendanceStatus, refetch: refetchStatus, isLoading: statusLoading } = trpc.attendance.getTodayStatus.useQuery(
        { localDate: todayStr },
        {
            staleTime: 0,  // Always fetch fresh data
            refetchOnMount: 'always',  // Fresh on every dashboard visit
            refetchOnWindowFocus: false, // Don't spam on tab switch
            initialData: initialData?.attendanceStatus,
            placeholderData: (prev: any) => prev || initialData?.attendanceStatus
        }
    )

    // Get office settings for off-day/holiday checks
    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery()

    const isTodayOffDay = settings?.off_days?.includes(new Date().getDay())
    const todayClosure = closures?.find((c: any) => c.date === todayStr)
    const isTodayHoliday = !!todayClosure

    // Optimistic state for instant button transitions
    const [optimisticState, setOptimisticState] = useState<'idle' | 'clocked_in' | 'marked'>('idle')

    // Reset optimistic state on component mount (fresh page load)
    useEffect(() => {
        setOptimisticState('idle')
    }, [])

    // --- Logout Stability Fix ---
    // Prevent button flicker during signout by freezing the state
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const frozenStatusRef = useRef<string | null>(null)

    useEffect(() => {
        const handleLoggingOut = () => {
            setIsLoggingOut(true)
            // Capture last known status to freeze the UI
            frozenStatusRef.current = optimisticState !== 'idle' ? optimisticState : (attendanceStatus?.status ?? 'not_clocked_in')
        }
        window.addEventListener('loggingOut', handleLoggingOut)
        return () => window.removeEventListener('loggingOut', handleLoggingOut)
    }, [attendanceStatus?.status, optimisticState])

    const clockInMutation = trpc.attendance.clockIn.useMutation({
        onMutate: () => {
            setOptimisticState('clocked_in')
        },
        onSuccess: () => {
            toast.success("Clocked in successfully")
            refetchStatus()  // Refresh button state
            utils.attendance.invalidate()
        },
        onError: (error) => {
            setOptimisticState('idle')
            toast.error(error.message)
        }
    })

    const clockOutMutation = trpc.attendance.clockOut.useMutation({
        onMutate: () => {
            setOptimisticState('marked')
        },
        onSuccess: () => {
            toast.success("Clocked out successfully")
            refetchStatus()  // Refresh button state
            utils.attendance.invalidate()
        },
        onError: (error) => {
            setOptimisticState('clocked_in')
            toast.error(error.message)
        }
    })

    // Sync optimistic state when real data arrives
    useEffect(() => {
        if (attendanceStatus && !clockInMutation.isPending && !clockOutMutation.isPending) {
            setOptimisticState('idle')
        }
    }, [attendanceStatus?.status, clockInMutation.isPending, clockOutMutation.isPending])

    // =====================================================
    // BUTTON STATE LOGIC (Simple and Clear)
    // =====================================================
    // Priority: Logging out (Freeze) > Optimistic state > Server status
    const serverStatus = attendanceStatus?.status ?? 'not_clocked_in'
    const buttonStatus = isLoggingOut
        ? (frozenStatusRef.current || 'not_clocked_in')
        : (optimisticState !== 'idle' ? optimisticState : serverStatus)
    const attendanceLoading = statusLoading && optimisticState === 'idle' && !isLoggingOut

    const handleClockIn = async (isExtra: boolean = false) => {
        try {
            await clockInMutation.mutateAsync({ localDate: todayStr, isExtraDay: isExtra })
        } catch (error: any) { }
    }

    const handleClockOut = async () => {
        try {
            await clockOutMutation.mutateAsync({ localDate: todayStr })
        } catch (error: any) { }
    }

    return (

        <div className="space-y-6 gesture-friendly">
            {/* Quick Actions Row */}
            <div className="grid grid-cols-1 gap-6">
                <MetricCard
                    className="shadow-xl"
                    gradientColor="from-primary/10 to-transparent"
                    delay={0.1}
                    disableHover={false}
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
                            {/* Attendance Button - Status-based rendering */}
                            {attendanceLoading ? (
                                <div className="flex items-center justify-center p-4 rounded-2xl border border-muted-foreground/10 bg-muted/5 animate-pulse min-h-[82px]">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : buttonStatus === 'clocked_in' ? (
                                // STATUS: clocked_in → Show "Office - Out" button
                                <button
                                    onClick={handleClockOut}
                                    disabled={clockOutMutation.isPending}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-orange-100/50 bg-orange-500/[0.08] dark:bg-orange-500/[0.08] hover:bg-orange-500/15 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 group/action cursor-pointer disabled:opacity-50"
                                >
                                    <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 group-hover/action:scale-110 group-hover/action:rotate-3 transition-transform">
                                        {clockOutMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 font-bold">Action</p>
                                        <p className="text-sm font-bold group-hover/action:text-orange-600 transition-colors">Office - Out</p>
                                    </div>
                                </button>
                            ) : buttonStatus === 'marked' ? (
                                // STATUS: marked → Show "Marked Today's" badge
                                <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-200/50 bg-green-50/30 dark:bg-green-500/5 cursor-default relative overflow-hidden group">
                                    <div className="p-2.5 rounded-xl bg-green-500/10 text-green-700 dark:text-green-400">
                                        <UserCheck className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-600/60 leading-none mb-1.5">Attendance</p>
                                        <p className="text-sm font-bold text-green-700 dark:text-green-400">Marked Today's</p>
                                    </div>
                                </div>
                            ) : isTodayHoliday ? (
                                // Holiday check
                                <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200/50 bg-amber-50/30 dark:bg-amber-500/5 cursor-default group">
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600/60 leading-none mb-1.5">Holiday</p>
                                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Office Closed</p>
                                    </div>
                                </div>
                            ) : isTodayOffDay ? (
                                // Week off check
                                <div className="flex items-center gap-3 p-4 rounded-2xl border border-muted-foreground/10 bg-muted/5 cursor-default group">
                                    <div className="p-2.5 rounded-xl bg-muted/10 text-muted-foreground">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Week off Day</p>
                                        <p className="text-sm font-bold text-muted-foreground">Scheduled Off</p>
                                    </div>
                                </div>
                            ) : (
                                // STATUS: not_clocked_in → Show "Office - In" button
                                <button
                                    onClick={() => handleClockIn(false)}
                                    disabled={clockInMutation.isPending}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-100/50 bg-emerald-500/[0.08] dark:bg-emerald-500/[0.08] hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 group/action cursor-pointer disabled:opacity-50"
                                >
                                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 group-hover/action:scale-110 group-hover/action:-rotate-3 transition-transform">
                                        {clockInMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 font-bold">Action</p>
                                        <p className="text-sm font-bold group-hover/action:text-emerald-600 transition-colors">Office - In</p>
                                    </div>
                                </button>
                            )}

                            {/* Profile Item */}
                            <Link
                                href="/employee/profile"
                                className="flex items-center gap-3 p-4 rounded-2xl border border-blue-100/50 bg-blue-500/[0.08] dark:bg-blue-500/[0.08] hover:bg-blue-500/15 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 group-hover/action:scale-110 group-hover/action:rotate-3 transition-transform">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 font-bold">Settings</p>
                                    <p className="text-sm font-bold group-hover/action:text-blue-600 transition-colors">Profile</p>
                                </div>
                            </Link>

                            {/* Reports Item */}
                            <Link
                                href="/employee/reports"
                                className="flex items-center gap-3 p-4 rounded-2xl border border-purple-100/50 bg-purple-500/[0.08] dark:bg-purple-500/[0.08] hover:bg-purple-500/15 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group/action cursor-pointer"
                            >
                                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 group-hover/action:scale-110 group-hover/action:-rotate-3 transition-transform">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 font-bold">Reports</p>
                                    <p className="text-sm font-bold group-hover/action:text-purple-600 transition-colors">Analytics</p>
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

