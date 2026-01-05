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
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"



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
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Get profile to obtain userId for real-time subscriptions
    const { data: profile } = trpc.profile.get.useQuery()

    // Use the optimized unified dashboard hook
    const {
        stats,
        recentActivities,
        isLoading,
        refetch,
        magicCardsDataReady,
        recentActivityDataReady
    } = useUserRealtimeDashboard(profile?.id || '', initialData, 'employee')

    // Fetch last 2 days for attendance status
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd')

    const { data: attendance, isLoading: attendanceLoading } = trpc.attendance.getAttendance.useQuery({
        startDate: yesterdayStr,
        endDate: todayStr
    })

    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery()

    const clockInMutation = trpc.attendance.clockIn.useMutation({
        onSuccess: () => {
            toast.success("Clocked in successfully")
            utils.attendance.getAttendance.invalidate()
            refetch()
        },
        onError: (error) => toast.error(error.message)
    })

    const clockOutMutation = trpc.attendance.clockOut.useMutation({
        onSuccess: () => {
            toast.success("Clocked out successfully")
            utils.attendance.getAttendance.invalidate()
            refetch()
        },
        onError: (error) => toast.error(error.message)
    })

    // Find today's record and pending record
    const todayRecord = attendance?.find(r => r.date === todayStr)
    const pendingRecord = attendance?.filter(r => !r.check_out).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    const isClockedIn = !!pendingRecord
    const isMarked = !!todayRecord?.check_in && !!todayRecord?.check_out
    const isTodayOffDay = settings?.off_days?.includes(new Date().getDay())
    const todayClosure = closures?.find(c => c.date === todayStr)
    const isTodayHoliday = !!todayClosure

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
                                <p className="text-lg font-bold tracking-tight tabular-nums text-foreground">{format(currentTime, "hh:mm:ss a")}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Current Time</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-2">
                            {/* Attendance Action (First Position) */}
                            {attendanceLoading ? (
                                <div className="flex items-center justify-center p-4 rounded-2xl border border-muted-foreground/10 bg-muted/5 animate-pulse min-h-[82px]">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : isMarked ? (
                                <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-200/50 bg-green-50/30 dark:bg-green-500/5 cursor-default relative overflow-hidden group">
                                    <div className="p-2.5 rounded-xl bg-green-500/10 text-green-700 dark:text-green-400">
                                        <UserCheck className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-600/60 leading-none mb-1.5">Attendance</p>
                                        <p className="text-sm font-bold text-green-700 dark:text-green-400">Marked for Today</p>
                                    </div>
                                </div>
                            ) : isClockedIn ? (
                                <button
                                    onClick={handleClockOut}
                                    disabled={clockOutMutation.isPending}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-orange-200/50 bg-orange-50/30 dark:bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 group cursor-pointer disabled:opacity-50"
                                >
                                    <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-700 dark:text-orange-400 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                        {clockOutMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Action</p>
                                        <p className="text-sm font-bold group-hover:text-primary transition-colors">Office - Out</p>
                                    </div>
                                </button>
                            ) : isTodayHoliday ? (
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
                                <button
                                    onClick={() => handleClockIn(false)}
                                    disabled={clockInMutation.isPending}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-green-200/50 bg-green-50/30 dark:bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300 group cursor-pointer disabled:opacity-50"
                                >
                                    <div className="p-2.5 rounded-xl bg-green-500/10 text-green-700 dark:text-green-400 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                                        {clockInMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                                    </div>
                                    <div className="flex flex-col text-left">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Action</p>
                                        <p className="text-sm font-bold group-hover:text-primary transition-colors">Office - In</p>
                                    </div>
                                </button>
                            )}

                            {/* Profile Item */}
                            <Link
                                href="/employee/profile"
                                className="flex items-center gap-3 p-4 rounded-2xl border border-blue-200/50 bg-blue-50/30 dark:bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group cursor-pointer"
                            >
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Settings</p>
                                    <p className="text-sm font-bold group-hover:text-primary transition-colors">Profile</p>
                                </div>
                            </Link>

                            {/* Reports Item */}
                            <Link
                                href="/employee/reports"
                                className="flex items-center gap-3 p-4 rounded-2xl border border-orange-200/50 bg-orange-50/30 dark:bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 group cursor-pointer"
                            >
                                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-700 dark:text-orange-400 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Reports</p>
                                    <p className="text-sm font-bold group-hover:text-primary transition-colors">Analytics</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </MetricCard>
            </div>

            {/* Recent Activities */}
            <ActivitiesCard activities={recentActivities as any} loading={!recentActivityDataReady && !initialData} />
        </div>
    )
}

