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

// MetricCard component matching dashboard style
interface MetricCardProps {
  title?: string
  value?: string | number
  description?: string
  icon?: React.ReactNode
  loading?: boolean
  iconBgColor?: string
  iconColor?: string
  borderColor?: string
  gradientColor?: string
  cardBgColor?: string
  delay?: number
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  className?: string
}

function MetricCardSkeleton({ title, description, icon, iconBgColor, iconColor, borderColor, gradientColor, cardBgColor }: {
  title?: string
  description?: string
  icon?: React.ReactNode
  iconBgColor?: string
  iconColor?: string
  borderColor?: string
  gradientColor?: string
  cardBgColor?: string
}) {
  return (
    <div className={`h-full relative overflow-hidden rounded-xl border ${borderColor || 'border-transparent'} p-4 ${cardBgColor || 'bg-background/60'} backdrop-blur-xl`}>
      <div className="flex flex-col h-full justify-between gap-2">
        <div className="flex justify-between items-start">
          <h3 className="text-base font-semibold tracking-wide text-foreground">{title}</h3>
          <div className={`p-2 rounded-md ${iconBgColor || 'bg-gray-100'} opacity-50`}>
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
              className: `h-6 w-6 ${iconColor || 'text-muted-foreground'}`,
              'aria-hidden': true,
              strokeWidth: 2.5
            }) : icon}
          </div>
        </div>
        <div>
          <div className="h-8 w-24 bg-muted/50 rounded-md animate-pulse mb-1" />
          <p className="text-xs text-muted-foreground/50">{description}</p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon,
  loading,
  iconBgColor,
  iconColor,
  borderColor,
  gradientColor = "from-blue-500/20 to-purple-500/20",
  cardBgColor,
  delay = 0,
  trend,
  className
}: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={{ scale: 1 }}
      className="h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "relative overflow-hidden h-full transition-all duration-300",
          "rounded-xl border border-border/50 bg-background/60 backdrop-blur-xl",
          "hover:shadow-xl hover:border-primary/20",
          "group",
          borderColor || 'border-transparent',
          cardBgColor || 'bg-background/60',
          className
        )}
      >
        {/* Gradient Background Effect */}
        <div
          className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br pointer-events-none",
            gradientColor
          )}
        />

        {/* Content Wrapper */}
        <div className="relative z-10 h-full p-4">
          <div className="flex flex-col h-full justify-between gap-1">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-semibold tracking-wide text-foreground">{title}</h3>
              <motion.div
                className={`p-2 rounded-md ${iconBgColor || 'bg-gray-100'} transition-all duration-300`}
                animate={isHovered ? { rotate: 10 } : { rotate: 0 }}
              >
                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
                  className: `h-6 w-6 ${iconColor || 'text-muted-foreground'}`,
                  'aria-hidden': true,
                  strokeWidth: 2.5
                }) : icon}
              </motion.div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-foreground min-h-[2rem] flex items-center relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="skeleton"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="h-8 w-24 bg-muted/50 rounded-md animate-pulse" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="value"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {value}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                {trend && (
                  <span
                    className={cn(
                      "flex items-center font-medium",
                      trend.positive ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {trend.positive ? "+" : ""}
                    {trend.value.toFixed(1)}%
                  </span>
                )}
                {description && <span>{description}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

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
              description={dataReady && reportsData.lastLogin ? `Last login: ${formatLastLogin(new Date(reportsData.lastLogin))}` : "No login data"}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
              loading={!dataReady}
              iconBgColor="bg-blue-500/20"
              iconColor="text-blue-700"
              borderColor="border-blue-200"
              gradientColor="from-blue-500/10 to-cyan-500/10"
              cardBgColor="bg-blue-50/50 dark:bg-blue-900/10"
              delay={0.1}
            />
            <MetricCard
              title="Actions Performed"
              value={dataReady ? reportsData.stats.totalActions : 0}
              description={reportsData?.trends.activityTrend ? `${reportsData.trends.activityTrend > 0 ? '+' : ''}${reportsData.trends.activityTrend.toFixed(1)}% from last week` : "No change"}
              icon={<Activity className="h-4 w-4 text-muted-foreground" />}
              loading={!dataReady}
              iconBgColor="bg-green-500/20"
              iconColor="text-green-700"
              borderColor="border-green-200"
              gradientColor="from-green-500/10 to-emerald-500/10"
              cardBgColor="bg-green-50/50 dark:bg-green-900/10"
              delay={0.2}
              trend={reportsData?.trends.activityTrend ? {
                value: reportsData.trends.activityTrend,
                label: "from last week",
                positive: reportsData.trends.activityTrend > 0
              } : undefined}
            />
            <MetricCard
              title="Reports Generated"
              value={dataReady ? reportsData.stats.reportsGenerated : 0}
              description="3 this week"
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
              loading={!dataReady}
              iconBgColor="bg-purple-500/20"
              iconColor="text-purple-700"
              borderColor="border-purple-200"
              gradientColor="from-purple-500/10 to-pink-500/10"
              cardBgColor="bg-purple-50/50 dark:bg-purple-900/10"
              delay={0.3}
            />
            <MetricCard
              title="Average Session"
              value={dataReady ? reportsData.stats.averageSession : "0m"}
              description={reportsData?.trends.sessionTrend ? `${reportsData.trends.sessionTrend > 0 ? '+' : ''}${reportsData.trends.sessionTrend.toFixed(1)}% from last week` : "No change"}
              icon={<Star className="h-4 w-4 text-muted-foreground" />}
              loading={!dataReady}
              iconBgColor="bg-orange-500/20"
              iconColor="text-orange-700"
              borderColor="border-orange-200"
              gradientColor="from-orange-500/10 to-red-500/10"
              cardBgColor="bg-orange-50/50 dark:bg-orange-900/10"
              delay={0.4}
              trend={reportsData?.trends.sessionTrend ? {
                value: Math.abs(reportsData.trends.sessionTrend),
                label: "from last week",
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
