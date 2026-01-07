"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { Users, Activity, Shield, User, RefreshCw, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTheme } from "next-themes"
import { useUserRealtimeDashboard } from "@/hooks/use-realtime-dashboard-data"
import { AnalyticsTab } from "./analytics-tab"
import { MetricCard } from '@/components/dashboard/metric-card'
import { AdminActivityChart } from "./admin-activity-chart"
import { useProfile } from '@/lib/context/profile-context'

export function ModeratorAnalyticsView() {
    const { theme } = useTheme()
    const isDark = theme === "dark"
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const { profile } = useProfile()

    // Use realtime dashboard hook for live updates (moderator version)
    const {
        stats,
        activeUsers,
        isLoading: realtimeLoading,
        isError: realtimeError,
        refetch: realtimeRefetch,
        magicCardsDataReady,
        showSkeleton
    } = useUserRealtimeDashboard(profile?.user_id || '', undefined, 'moderator')

    // Fetch reports data - using the new moderator router
    const { data: reportsData, isLoading: reportsLoading, error: reportsError, refetch: reportsRefetch } = trpc.moderator.reports.getReportsData.useQuery(
        {
            days: dateRange
                ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
                : 30,
            startDate: dateRange?.from.toISOString(),
            endDate: dateRange?.to.toISOString(),
        },
        {
            refetchInterval: 30000,
        }
    )

    const isError = reportsError || realtimeError
    const dataReady = !showSkeleton && magicCardsDataReady && reportsData

    // Handle manual refresh
    const handleRefresh = async () => {
        setIsRefreshing(true)
        await Promise.all([reportsRefetch(), realtimeRefetch()])
        setIsRefreshing(false)
    }

    // Format numbers with commas
    const formatNumber = (num: number | undefined) => {
        if (num === undefined) return '0'
        return num.toLocaleString()
    }

    // Calculate display values
    const displayStats = {
        totalUsers: dataReady ? (reportsData?.stats.totalUsers ?? stats.totalUsers) : 0,
        activeUsers: dataReady ? (reportsData?.stats.activeUsers ?? activeUsers) : 0,
        totalActivities: dataReady ? (reportsData?.stats.totalActivities ?? stats.totalActivities) : 0,
        todayActivities: dataReady ? (reportsData?.stats.todayActivities ?? stats.todayActivities) : 0,
        totalModerators: dataReady ? (reportsData?.stats.totalModerators ?? 0) : 0,
        totalEmployees: dataReady ? (reportsData?.stats.totalEmployees ?? 0) : 0,
    }

    const trends = reportsData?.trends || {
        userGrowth: 0,
        activityGrowth: 0,
    }

    if (isError && !reportsData) {
        return (
            <DashboardPageLayout
                heading="Analytics"
                description="System analytics and overview"
            >
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load analytics data. Please try refreshing the page.
                    </AlertDescription>
                </Alert>
                <Button onClick={handleRefresh} variant="outline" className="mt-4">
                    <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                    Retry
                </Button>
            </DashboardPageLayout>
        )
    }

    return (
        <DashboardPageLayout
            heading="Analytics"
            description="System analytics and overview"
        >
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                    {/* Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            title="Total Users"
                            value={formatNumber(displayStats.totalUsers)}
                            icon={<Users />}
                            loading={!dataReady}
                            iconBgColor="bg-blue-500/20"
                            iconColor="text-blue-700 dark:text-blue-400"
                            borderColor="border-blue-200/50 dark:border-blue-900/50"
                            gradientColor="from-blue-500/10 to-cyan-500/10"
                            cardBgColor="bg-blue-50/50 dark:bg-blue-950/20"
                            delay={0.1}
                            trend={trends.userGrowth > 0 ? { value: trends.userGrowth, label: "vs last month", positive: true } : undefined}
                        />
                        <MetricCard
                            title="Active Now"
                            value={`+${formatNumber(displayStats.activeUsers)}`}
                            icon={<Activity />}
                            loading={!dataReady}
                            iconBgColor="bg-emerald-500/20"
                            iconColor="text-emerald-700 dark:text-emerald-400"
                            borderColor="border-emerald-200/50 dark:border-emerald-900/50"
                            gradientColor="from-emerald-500/10 to-emerald-500/10"
                            cardBgColor="bg-emerald-50/50 dark:bg-emerald-950/20"
                            delay={0.2}
                        />
                        <MetricCard
                            title="Moderators"
                            value={formatNumber(displayStats.totalModerators)}
                            icon={<Shield />}
                            loading={!dataReady}
                            iconBgColor="bg-purple-500/20"
                            iconColor="text-purple-700 dark:text-purple-400"
                            borderColor="border-purple-200/50 dark:border-purple-900/50"
                            gradientColor="from-purple-500/10 to-pink-500/10"
                            cardBgColor="bg-purple-50/50 dark:bg-purple-950/20"
                            delay={0.3}
                        />
                        <MetricCard
                            title="Employees"
                            value={formatNumber(displayStats.totalEmployees)}
                            icon={<User />}
                            loading={!dataReady}
                            iconBgColor="bg-amber-500/20"
                            iconColor="text-amber-700 dark:text-amber-400"
                            borderColor="border-amber-200/50 dark:border-amber-900/50"
                            gradientColor="from-amber-500/10 to-red-500/10"
                            cardBgColor="bg-amber-50/50 dark:bg-amber-950/20"
                            delay={0.4}
                        />
                    </div>

                    {/* Main Content Section - Activity Charts */}
                    <div className="space-y-10">
                        {/* Role-Based Operations Section Heading */}
                        <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">Role-Based Operations</h3>
                                <p className="text-sm text-muted-foreground">Detailed activity metrics for moderators and staff members</p>
                            </div>
                        </div>

                        {/* Top Moderator Activity Section - Detailed breakdown for moderators */}
                        <MetricCard
                            title="Top Moderator Activity"
                            description="Activity breakdown by type for top 5 moderators"
                            className="shadow-lg h-full w-full"
                            disableHover={true}
                            delay={0.5}
                        >
                            <div className="mt-4">
                                {reportsData?.charts.moderatorActivity ? (
                                    <AdminActivityChart
                                        data={reportsData.charts.moderatorActivity}
                                        className="h-[350px]"
                                    />
                                ) : (
                                    <div className="h-[350px] flex items-center justify-center">
                                        <div className="text-muted-foreground">Loading moderator activity...</div>
                                    </div>
                                )}
                            </div>
                        </MetricCard>

                        {/* Top Employee Activity Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <User className="h-4 w-4 text-indigo-600" />
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Staff Performance</h4>
                            </div>
                            <MetricCard
                                title="Employee Activity"
                                description="Top 5 most active staff members"
                                className="shadow-lg h-full"
                                disableHover={true}
                                delay={0.6}
                            >
                                <div className="mt-4">
                                    {reportsData?.charts.employeeActivity ? (
                                        <AdminActivityChart
                                            data={reportsData.charts.employeeActivity}
                                            className="h-[300px]"
                                            layout="horizontal"
                                        />
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center">
                                            <div className="text-muted-foreground">Loading employee activity...</div>
                                        </div>
                                    )}
                                </div>
                            </MetricCard>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="analytics" className="space-y-4">
                    <AnalyticsTab role="moderator" />
                </TabsContent>
                <TabsContent value="notifications" className="space-y-4">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Notifications</CardTitle>
                            <CardDescription>System notifications and alerts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Notifications content coming soon...</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </DashboardPageLayout>
    )
}
