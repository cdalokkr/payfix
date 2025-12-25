"use client"

import { MetricCard } from "@/components/dashboard/metric-card"
import { ActionButton } from "@/components/ui/action-button"
import { PageHeading } from "@/components/ui/page-heading"
import { Settings, Bell, User, Activity, LogIn, LogOut, Calendar, History, BarChart3 } from "lucide-react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Activity as ActivityType } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityLogFeed, type UserActivity } from "@/components/dashboard/activity-log-feed"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"



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
    // Get profile to obtain userId for real-time subscriptions
    const { data: profile } = trpc.profile.get.useQuery()

    // Use the optimized unified dashboard hook instead of individual manual queries
    // This hook is already optimized for speed and handles real-time updates
    const {
        stats,
        recentActivities,
        isLoading,
        refetch,
        magicCardsDataReady,
        recentActivityDataReady
    } = useUserRealtimeDashboard(profile?.user_id || '', initialData, 'employee')

    // Still need sessionInfo for specific last login/logout details
    // but aggregate counts come from the unified endpoint now
    const { data: sessionInfo, isLoading: sessionLoading } = trpc.profile.getLastSession.useQuery(undefined, {
        staleTime: 60 * 1000,
    })

    const isDataReady = (magicCardsDataReady || !!initialData) && !sessionLoading

    return (
        <div className="space-y-6 gesture-friendly">
            {/* Header */}
            <PageHeading
                heading="Employee Dashboard"
                description="Welcome back! Here is an overview of your common tasks and recent activity."
                variant="gradient"
            />

            {/* Quick Actions & Session Row - Two Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions Column */}
                <MetricCard
                    className="shadow-xl"
                    gradientColor="from-primary/10 to-transparent"
                    delay={0.1}
                    disableHover={true}
                    borderColor="border-primary/10"
                    cardBgColor="bg-card/50"
                >
                    <div className="flex flex-col gap-4 h-full">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-1 bg-primary rounded-full" />
                            <h3 className="text-xl font-bold tracking-tight">Quick Actions</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
                            {/* Edit Profile Item */}
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

                {/* Session & Activity Summary Column */}
                <MetricCard
                    className="shadow-xl"
                    gradientColor="from-indigo-500/10 to-purple-500/10"
                    delay={0.15}
                    disableHover={true}
                    borderColor="border-indigo-500/10"
                    cardBgColor="bg-card/50"
                >
                    <div className="flex flex-col gap-4 h-full">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-1 bg-indigo-500 rounded-full" />
                            <h3 className="text-xl font-bold tracking-tight">Account Overview</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
                            {/* Total Activities */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: isDataReady ? 1 : 0, scale: isDataReady ? 1 : 0.95 }}
                                className="flex items-center gap-4 p-4 rounded-2xl border border-purple-200/50 bg-purple-50/30 dark:bg-purple-500/5 hover:shadow-md transition-all duration-300 group cursor-default"
                            >
                                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 group-hover:scale-110 transition-transform">
                                    <History className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Activities</p>
                                    <div className="mt-1">
                                        {sessionLoading ? (
                                            <div className="h-5 w-12 bg-muted animate-pulse rounded" />
                                        ) : (
                                            <p className="text-lg font-bold tabular-nums">{sessionInfo?.totalActivities || 0}</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Last Logged Out */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: isDataReady ? 1 : 0, scale: isDataReady ? 1 : 0.95 }}
                                className="flex items-center gap-4 p-4 rounded-2xl border border-pink-200/50 bg-pink-50/30 dark:bg-pink-500/5 hover:shadow-md transition-all duration-300 group cursor-default"
                            >
                                <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-700 dark:text-pink-400 group-hover:scale-110 transition-transform">
                                    <LogOut className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Last Logout</p>
                                    <div className="mt-1">
                                        {sessionLoading ? (
                                            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                                        ) : (
                                            <p className="text-sm font-bold truncate">
                                                {sessionInfo?.lastLogout ? format(new Date(sessionInfo.lastLogout), "MMM dd, HH:mm") : "None"}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </MetricCard>
            </div>

            {/* Recent Activities */}
            <ActivitiesCard activities={recentActivities as any} loading={!recentActivityDataReady && !initialData} />
        </div>
    )
}

