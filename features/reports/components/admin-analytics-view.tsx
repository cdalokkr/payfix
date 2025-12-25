"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { AdminActivityChart } from "./admin-activity-chart"
import { UserActivityChart } from "./user-activity-chart"
import { Users, Activity, Shield, User, RefreshCw, AlertCircle, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTheme } from "next-themes"
import { AnalyticsTab } from "./analytics-tab"
import { MetricCard } from '@/components/dashboard/metric-card'

export function AdminAnalyticsView() {
    const { theme } = useTheme()
    const isDark = theme === "dark"
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>()
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Fetch reports data
    const { data: reportsData, isLoading: reportsLoading, error: reportsError, refetch: reportsRefetch } = trpc.admin.reports.getReportsData.useQuery(
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

    const isError = reportsError
    const dataReady = reportsData

    // Handle manual refresh
    const handleRefresh = async () => {
        setIsRefreshing(true)
        await reportsRefetch()
        setIsRefreshing(false)
    }

    // Format numbers with commas
    const formatNumber = (num: number | undefined) => {
        if (num === undefined) return '0'
        return num.toLocaleString()
    }

    // Calculate display values
    const displayStats = {
        totalUsers: dataReady ? reportsData.stats.totalUsers : 0,
        totalActivities: dataReady ? reportsData.stats.totalActivities : 0,
        todayActivities: dataReady ? reportsData.stats.todayActivities : 0,
        activeSubscriptions: dataReady ? reportsData.stats.activeSubscriptions : 0,
        activeUsersForAccess: dataReady ? reportsData.stats.activeUsersForAccess : 0,
        inactiveUsers: dataReady ? reportsData.stats.inactiveUsers : 0,
    }

    const trends = reportsData?.trends || {
        userGrowth: 0,
        activityGrowth: 0,
    }

    if (isError && !reportsData) {
        return (
            <DashboardPageLayout
                heading="Analytics"
                description="Comprehensive system analytics and overview"
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
            description="Comprehensive system analytics and overview"
        >
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                    {/* Stats Cards - Matching Dashboard Style */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <MetricCard
                            title="All Users"
                            description="Total number of registered users"
                            value={formatNumber(displayStats.totalUsers)}
                            icon={<Users className="h-4 w-4 text-muted-foreground" />}
                            loading={!dataReady}
                            iconBgColor="bg-blue-500/20"
                            iconColor="text-blue-700"
                            borderColor="border-blue-200"
                            gradientColor="from-blue-500/10 to-cyan-500/10"
                            cardBgColor="bg-blue-50/50 dark:bg-blue-900/10"
                            delay={0.1}
                            trend={trends.userGrowth > 0 ? { value: trends.userGrowth, label: "from last month", positive: true } : undefined}
                        />
                        <MetricCard
                            title="Active Users"
                            description="Allowed to access the system"
                            value={formatNumber(displayStats.activeUsersForAccess)}
                            icon={<UserCheck className="h-4 w-4 text-muted-foreground" />}
                            loading={!dataReady}
                            iconBgColor="bg-green-500/20"
                            iconColor="text-green-700"
                            borderColor="border-green-200"
                            gradientColor="from-green-500/10 to-emerald-500/10"
                            cardBgColor="bg-green-50/50 dark:bg-green-900/10"
                            delay={0.2}
                        />
                        <MetricCard
                            title="Inactive Users"
                            description="Not allowed to access the system"
                            value={formatNumber(displayStats.inactiveUsers)}
                            icon={<UserX className="h-4 w-4 text-muted-foreground" />}
                            loading={!dataReady}
                            iconBgColor="bg-red-500/20"
                            iconColor="text-red-700"
                            borderColor="border-red-200"
                            gradientColor="from-red-500/10 to-red-500/10"
                            cardBgColor="bg-red-50/50 dark:bg-red-900/10"
                            delay={0.3}
                        />
                    </div>

                    {/* Main Content Section - Activity Charts */}
                    <div className="space-y-10 mt-10">
                        {/* Administrator Section Heading */}
                        <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">Administrative Performance</h3>
                                <p className="text-sm text-muted-foreground">Comprehensive tracking of system administration actions</p>
                            </div>
                        </div>

                        {/* Top Admin Activity Section - Full Width */}
                        <MetricCard
                            title="Top Admin Activity"
                            description="Activity breakdown by type for top 5 administrators"
                            className="shadow-lg h-full w-full"
                            disableHover={true}
                            delay={0.5}
                        >
                            <div className="mt-4">
                                {reportsData?.charts.adminActivity ? (
                                    <AdminActivityChart
                                        data={reportsData.charts.adminActivity}
                                        className="h-[350px]"
                                    />
                                ) : (
                                    <div className="h-[350px] flex items-center justify-center">
                                        <div className="text-muted-foreground">Loading admin activity...</div>
                                    </div>
                                )}
                            </div>
                        </MetricCard>


                        {/* Staff & Moderator Section Heading */}
                        <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">Role-Based Operations</h3>
                                <p className="text-sm text-muted-foreground">Detailed activity metrics for moderators and staff members</p>
                            </div>
                        </div>

                        {/* Top Moderator and Top Employee Activity - Row with Two Columns */}
                        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mb-15 ">
                            {/* Top Moderator Activity Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Activity className="h-4 w-4 text-purple-600" />
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Moderator Engagement</h4>
                                </div>
                                <MetricCard
                                    title="Moderator Activity"
                                    description="Top 5 most active moderators"
                                    className="shadow-lg h-full"
                                    disableHover={true}
                                    delay={0.6}
                                >
                                    <div className="mt-4">
                                        {reportsData?.charts.moderatorActivity ? (
                                            <AdminActivityChart
                                                data={reportsData.charts.moderatorActivity}
                                                className="h-[300px]"
                                                layout="horizontal"
                                            />
                                        ) : (
                                            <div className="h-[300px] flex items-center justify-center">
                                                <div className="text-muted-foreground">Loading moderator activity...</div>
                                            </div>
                                        )}
                                    </div>
                                </MetricCard>
                            </div>

                            {/* Top Employee Activity Section */}
                            <div className="space-y-4 ">
                                <div className="flex items-center gap-2 px-1">
                                    <User className="h-4 w-4 text-indigo-600" />
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Staff Performance</h4>
                                </div>
                                <MetricCard
                                    title="Employee Activity"
                                    description="Top 5 most active staff members"
                                    className="shadow-lg h-full"
                                    disableHover={true}
                                    delay={0.7}
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
                    </div>
                </TabsContent>
                <TabsContent value="analytics" className="space-y-4">
                    <AnalyticsTab />
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
        </DashboardPageLayout >
    )
}
