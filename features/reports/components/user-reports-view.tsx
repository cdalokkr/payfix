"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardPageLayout } from "@/components/dashboard/dashboard-page-layout"
import { ActivityBarChart, UserGrowthChart } from "./reports-charts"
import { Activity, Clock, FileText, Star, RefreshCw, AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CalendarDateRangePicker } from "@/components/dashboard/date-range-picker"
import { trpc } from "@/lib/trpc/client"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DateRange } from "react-day-picker"
import { MetricCard } from "@/components/dashboard/metric-card"


export function UserReportsView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch user reports data
  const { data: reportsData, isLoading, error, refetch } = trpc.admin.reports.getUserReportsData.useQuery(
    {
      days: (dateRange?.from && dateRange?.to)
        ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        : 30,
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString(),
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds for realtime feel
    }
  )

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  // Format last login time
  const formatLastLogin = (date: Date | null) => {
    if (!date) return "Never"
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  if (error) {
    return (
      <DashboardPageLayout
        heading="My Reports"
        description="Personal usage reports and analytics"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load reports data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
        <Button onClick={handleRefresh} variant="outline" className="mt-4">
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Retry
        </Button>
      </DashboardPageLayout>
    )
  }

  const dataReady = !isLoading && reportsData

  return (
    <DashboardPageLayout
      heading="My Reports"
      description="Personal usage reports and analytics"
      headerAction={
        <div className="flex items-center space-x-2">
          <CalendarDateRangePicker
            date={dateRange}
            onDateChange={setDateRange}
          />
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button size="icon" variant="outline" title="Download PDF">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          {/* Stats Cards - Matching Dashboard Style */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Logins"
              value={dataReady ? reportsData.stats.totalLogins : 0}
              description={dataReady && reportsData.lastLogin ? `Last: ${formatLastLogin(new Date(reportsData.lastLogin))}` : "No login data"}
              icon={<Clock />}
              loading={!dataReady}
              iconBgColor="bg-blue-500/20"
              iconColor="text-blue-700 dark:text-blue-400"
              borderColor="border-blue-200/50 dark:border-blue-900/50"
              gradientColor="from-blue-500/10 to-cyan-500/10"
              cardBgColor="bg-blue-50/50 dark:bg-blue-950/20"
              delay={0.1}
            />
            <MetricCard
              title="Actions"
              value={dataReady ? reportsData.stats.totalActions : 0}
              description="System actions"
              icon={<Activity />}
              loading={!dataReady}
              iconBgColor="bg-emerald-500/20"
              iconColor="text-emerald-700 dark:text-emerald-400"
              borderColor="border-emerald-200/50 dark:border-emerald-900/50"
              gradientColor="from-emerald-500/10 to-teal-500/10"
              cardBgColor="bg-emerald-50/50 dark:bg-emerald-950/20"
              delay={0.2}
              trend={reportsData?.trends.activityTrend ? {
                value: reportsData.trends.activityTrend,
                label: "vs last week",
                positive: reportsData.trends.activityTrend > 0
              } : undefined}
            />
            <MetricCard
              title="Reports"
              value={dataReady ? reportsData.stats.reportsGenerated : 0}
              description="Generated files"
              icon={<FileText />}
              loading={!dataReady}
              iconBgColor="bg-purple-500/20"
              iconColor="text-purple-700 dark:text-purple-400"
              borderColor="border-purple-200/50 dark:border-purple-900/50"
              gradientColor="from-purple-500/10 to-pink-500/10"
              cardBgColor="bg-purple-50/50 dark:bg-purple-950/20"
              delay={0.3}
            />
            <MetricCard
              title="Avg Session"
              value={dataReady ? reportsData.stats.averageSession : "0m"}
              description="Time per session"
              icon={<Star />}
              loading={!dataReady}
              iconBgColor="bg-amber-500/20"
              iconColor="text-amber-700 dark:text-amber-400"
              borderColor="border-amber-200/50 dark:border-amber-900/50"
              gradientColor="from-amber-500/10 to-orange-500/10"
              cardBgColor="bg-amber-50/50 dark:bg-amber-950/20"
              delay={0.4}
              trend={reportsData?.trends.sessionTrend ? {
                value: Math.abs(reportsData.trends.sessionTrend),
                label: "vs last week",
                positive: reportsData.trends.sessionTrend > 0
              } : undefined}
            />
          </div>

          {/* Charts Section */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 shadow-lg">
              <CardHeader>
                <CardTitle>My Activity</CardTitle>
                <CardDescription>
                  Your daily activity over the last week.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                {reportsData?.charts.activity ? (
                  <ActivityBarChart data={reportsData.charts.activity} className="h-[350px]" />
                ) : (
                  <div className="h-[350px] flex items-center justify-center">
                    <div className="text-muted-foreground">Loading chart data...</div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="col-span-3 shadow-lg">
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
                <CardDescription>
                  Your usage volume over time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportsData?.charts.usage ? (
                  <UserGrowthChart data={reportsData.charts.usage} className="h-[350px]" />
                ) : (
                  <div className="h-[350px] flex items-center justify-center">
                    <div className="text-muted-foreground">Loading chart data...</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="activity" className="space-y-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Activity Details</CardTitle>
              <CardDescription>Detailed activity breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Activity details coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="usage" className="space-y-4">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
              <CardDescription>Detailed usage statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Usage statistics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardPageLayout>
  )
}
