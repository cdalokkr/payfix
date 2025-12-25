'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  MetricCardSkeleton, 
  MetricCardGridSkeleton,
  ActivitySkeleton, 
  ChartSkeleton,
  NavigationSkeleton,
  TableSkeleton,
  StatsSkeleton
} from './index'

interface DashboardSkeletonProps {
  variant?: 'admin' | 'user' | 'overview' | 'detailed'
  showNavigation?: boolean
  showSidebar?: boolean
  showBreadcrumbs?: boolean
  sections?: string[]
  animationDelay?: number
}

export function DashboardSkeleton({
  variant = 'admin',
  showNavigation = true,
  showSidebar = true,
  showBreadcrumbs = true,
  sections = ['metrics', 'charts', 'tables', 'activities'],
  animationDelay = 0
}: DashboardSkeletonProps) {
  
  if (variant === 'admin') {
    return (
      <div 
        className="min-h-screen bg-background"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Top Navigation */}
        {showNavigation && (
          <div className="border-b border-border/50">
            <NavigationSkeleton 
              variant="topbar"
              showSearch={true}
              showNotifications={true}
              showProfile={true}
              animationDelay={animationDelay}
            />
          </div>
        )}

        <div className="flex h-[calc(100vh-73px)]">
          {/* Sidebar */}
          {showSidebar && (
            <div className="w-64 flex-shrink-0">
              <NavigationSkeleton 
                variant="sidebar"
                itemCount={8}
                showProfile={true}
                animationDelay={animationDelay + 100}
              />
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Breadcrumbs */}
              {showBreadcrumbs && (
                <div className="mb-6">
                  <NavigationSkeleton 
                    variant="breadcrumbs"
                    animationDelay={animationDelay + 200}
                  />
                </div>
              )}

              {/* Page Header */}
              <div className="space-y-2" style={{ animationDelay: `${animationDelay + 300}ms` }}>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>

              {/* Quick Actions */}
              <Card style={{ animationDelay: `${animationDelay + 400}ms` }}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton 
                        key={i} 
                        className="h-10 w-28"
                        style={{ animationDelay: `${animationDelay + 400 + (i * 100)}ms` }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Grid */}
              {sections.includes('metrics') && (
                <div style={{ animationDelay: `${animationDelay + 500}ms` }}>
                  <MetricCardGridSkeleton count={4} />
                </div>
              )}

              {/* Charts Section */}
              {sections.includes('charts') && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ animationDelay: `${animationDelay + 600}ms` }}>
                  <ChartSkeleton />
                  <StatsSkeleton type="chart" showHeader={true} />
                </div>
              )}

              {/* Tables Section */}
              {sections.includes('tables') && (
                <div style={{ animationDelay: `${animationDelay + 700}ms` }}>
                  <TableSkeleton 
                    rows={6}
                    columns={4}
                    showHeader={true}
                    showPagination={true}
                    animationDelay={animationDelay + 700}
                  />
                </div>
              )}

              {/* Activities Section */}
              {sections.includes('activities') && (
                <div style={{ animationDelay: `${animationDelay + 800}ms` }}>
                  <ActivitySkeleton count={8} showHeader={true} />
                </div>
              )}

              {/* Additional Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ animationDelay: `${animationDelay + 900}ms` }}>
                <StatsSkeleton type="progress" count={3} />
                <StatsSkeleton type="timeline" count={4} />
                <StatsSkeleton type="comparison" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'user') {
    return (
      <div 
        className="min-h-screen bg-background"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Top Navigation */}
        {showNavigation && (
          <div className="border-b border-border/50">
            <NavigationSkeleton 
              variant="topbar"
              showSearch={false}
              showNotifications={true}
              showProfile={true}
              animationDelay={animationDelay}
            />
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* User Dashboard Header */}
          <div className="space-y-2" style={{ animationDelay: `${animationDelay + 100}ms` }}>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>

          {/* User Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ animationDelay: `${animationDelay + 200}ms` }}>
            <MetricCardSkeleton title="Points" description="Total points earned" />
            <MetricCardSkeleton title="Streak" description="Current activity streak" />
            <MetricCardSkeleton title="Level" description="Current user level" />
            <MetricCardSkeleton title="Badges" description="Earned badges" />
          </div>

          {/* User Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ animationDelay: `${animationDelay + 300}ms` }}>
            <ActivitySkeleton count={5} showHeader={true} />
            <StatsSkeleton type="progress" count={4} />
          </div>

          {/* User Chart */}
          <div style={{ animationDelay: `${animationDelay + 400}ms` }}>
            <ChartSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'overview') {
    return (
      <div 
        className="p-6 space-y-6"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Overview Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Overview Metrics */}
        <MetricCardGridSkeleton count={6} />

        {/* Overview Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <StatsSkeleton type="chart" showHeader={true} />
        </div>

        {/* Overview Activities */}
        <ActivitySkeleton count={10} showHeader={true} />
      </div>
    )
  }

  // Default: detailed variant
  return (
    <div 
      className="p-6 space-y-6"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Detailed Header */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="h-8 w-20"
              style={{ animationDelay: `${animationDelay + (i * 50)}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton title="Total Revenue" description="This month" />
        <MetricCardSkeleton title="Active Users" description="Currently online" />
        <MetricCardSkeleton title="Conversion Rate" description="This week" />
        <MetricCardSkeleton title="Page Views" description="Today" />
      </div>

      {/* Detailed Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
        <StatsSkeleton type="chart" showHeader={true} />
      </div>

      {/* Detailed Tables */}
      <TableSkeleton rows={8} columns={5} showHeader={true} showPagination={true} />

      {/* Detailed Activities */}
      <ActivitySkeleton count={12} showHeader={true} />

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatsSkeleton type="timeline" count={6} />
        <StatsSkeleton type="progress" count={5} />
      </div>
    </div>
  )
}

// Specialized dashboard skeletons
export function AdminDashboardSkeleton(props: DashboardSkeletonProps) {
  return <DashboardSkeleton {...props} variant="admin" />
}

export function UserDashboardSkeleton(props: DashboardSkeletonProps) {
  return <DashboardSkeleton {...props} variant="user" />
}

export function OverviewDashboardSkeleton(props: DashboardSkeletonProps) {
  return <DashboardSkeleton {...props} variant="overview" />
}

export function DetailedDashboardSkeleton(props: DashboardSkeletonProps) {
  return <DashboardSkeleton {...props} variant="detailed" />
}

// Mobile-responsive dashboard skeleton
export function MobileDashboardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Mobile Header */}
      <NavigationSkeleton 
        variant="topbar"
        showSearch={true}
        showNotifications={true}
        showProfile={true}
      />

      {/* Mobile Metrics */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 gap-3">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      </div>

      {/* Mobile Chart */}
      <ChartSkeleton />

      {/* Mobile Activity */}
      <ActivitySkeleton count={3} showHeader={true} />
    </div>
  )
}

// Full page loading skeleton with progress indication
export function FullPageDashboardSkeleton({
  progress = 0,
  message = "Loading dashboard...",
  ...props
}: DashboardSkeletonProps & {
  progress?: number
  message?: string
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md mx-auto text-center space-y-4">
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Main skeleton content */}
        <div className="space-y-6">
          <DashboardSkeleton {...props} />
        </div>
      </div>
    </div>
  )
}