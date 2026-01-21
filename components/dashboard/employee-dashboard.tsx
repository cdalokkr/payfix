"use client"

import { MetricCard } from "@/components/dashboard/metric-card"
import { User, Activity, BarChart3, Smartphone } from "lucide-react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { ActivityLogFeed, type UserActivity } from "@/components/dashboard/activity-log-feed"
import { format } from "date-fns"
import { useEffect, useState } from "react"
import { useProfile } from "@/lib/context/profile-context"
import { createClient } from "@/lib/supabase/client"



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
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Get profile to obtain userId for real-time subscriptions
    const { profile } = useProfile()

    // OPTIMIZATION: Employees don't need the heavy unified dashboard query
    // Just fetch recent activities with a lightweight query
    // NOTE: Use refetchOnMount: 'always' to ensure fresh data when returning to dashboard
    const { data: activitiesData, isLoading: activitiesLoading, refetch: refetchActivities } = trpc.admin.dashboard.getRecentActivities.useQuery(
        { limit: 10 },
        {
            staleTime: 30000,
            refetchOnWindowFocus: false,
            refetchOnMount: 'always'  // Always refetch when returning to dashboard
        }
    )
    const recentActivities = activitiesData?.data || []
    const isLoading = activitiesLoading

    // =====================================================
    // REAL-TIME ACTIVITY UPDATES
    // =====================================================
    // Subscribe to activity changes for this employee
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
                    // Refetch activities to update the log
                    refetchActivities()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.id, refetchActivities])

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
                                <p className="text-lg font-bold tracking-tight tabular-nums text-foreground" suppressHydrationWarning>{format(currentTime, "hh:mm:ss a")}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Current Time</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-2">
                            {/* PWA Attendance Reminder */}
                            <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/[0.05] dark:bg-primary/[0.08] cursor-default group sm:col-span-2">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                    <Smartphone className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 leading-none mb-1.5">Attendance</p>
                                    <p className="text-sm font-bold text-primary">Use Mobile PWA App</p>
                                </div>
                            </div>

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

