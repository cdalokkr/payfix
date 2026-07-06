'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAdminRealtimeDashboard } from '@/hooks/use-realtime-dashboard-data'
import { useDashboardPrefetch } from '@/hooks/use-dashboard-prefetch'
import { trpc } from '@/lib/trpc/client'
import dynamic from 'next/dynamic'
import { ActionButton } from '@/components/ui/action-button'
import { PageHeading } from '@/components/ui/page-heading'
import { cn } from '@/lib/utils'
import { format, isValid } from 'date-fns'
import { useProfile } from '@/lib/context/profile-context'

const ModernAddUserForm = dynamic(() => import('@/features/users/components/ModernAddUserForm').then(mod => mod.ModernAddUserForm), {
  loading: () => null,
  ssr: false
})

import {
  Users,
  Activity,
  TrendingUp,
  UserPlus,
  Settings,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Shield,
  Briefcase,
  ShieldUser,
  UserStar,
  SquareUser,
  LogIn,
  LogOut,
  Calendar,
  History,
  Clock,
  Ticket,
  Camera,
  User,
  Bell
} from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

import { MetricCard } from '@/components/dashboard/metric-card'
import { ActivityLogFeed } from '@/components/dashboard/activity-log-feed'
import { CardShell } from '@/features/attendance/CardShell'



export function AdminOverview({
  onLoadingChange,
  initialData
}: {
  onLoadingChange?: (loading: boolean) => void,
  initialData?: any
}) {
  const [showAddUserSheet, setShowAddUserSheet] = useState(false)
  const pathname = usePathname()
  const previousPathnameRef = useRef<string | null>(null)

  const [isReturnVisit, setIsReturnVisit] = useState(false)

  const { profile } = useProfile()

  const { data: sessionInfo, isLoading: sessionLoading } = trpc.profile.getLastSession.useQuery(undefined, {
    staleTime: 60 * 1000,
  })

  const { data: unreadCount, isLoading: notificationsLoading } = trpc.notification.getUnreadCount.useQuery(undefined, {
    staleTime: 15000,
    refetchOnWindowFocus: false,
  })

  const { clearPrefetch } = useDashboardPrefetch()

  const {
    stats,
    recentActivities,
    analytics,
    activeUsers,
    isLoading,
    isError,
    error,
    refetch,
    magicCardsDataReady,
    recentActivityDataReady,
    showSkeleton
  } = useAdminRealtimeDashboard(profile?.id || '', initialData)

  const handleAddUserSuccess = useCallback(() => {
    refetch({ forceFresh: true })
  }, [refetch])

  const handleAddUserRefetch = useCallback(() => {
    refetch({ forceFresh: true })
  }, [refetch])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ADMIN-OVERVIEW] Hydrated. initialData: ${initialData ? 'PRESENT' : 'MISSING'}`)
    }
    const isDashboardRoute = pathname?.includes('/admin')
    const wasOnDifferentRoute = previousPathnameRef.current !== null &&
      previousPathnameRef.current !== pathname

    if (isDashboardRoute && wasOnDifferentRoute) {
      console.log('[ADMIN-OVERVIEW] Route changed to dashboard, marking as return visit')
      setIsReturnVisit(true)
      clearPrefetch()
    }

    previousPathnameRef.current = pathname
  }, [pathname, clearPrefetch])

  useEffect(() => {
    onLoadingChange?.(isLoading || showSkeleton || notificationsLoading || sessionLoading)
  }, [isLoading, showSkeleton, notificationsLoading, sessionLoading, onLoadingChange])

  if (isError && !stats.totalUsers && !stats.totalActivities && !stats.todayActivities) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 gesture-friendly">


      {/* Critical Metrics - Compact Grid at Very Top */}
      <div data-testid="critical-metrics" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users" className="block h-full">
          <MetricCard
            title="Total Users"
            value={magicCardsDataReady && !showSkeleton ? stats.totalUsers : 0}
            description="Registered system users"
            icon={<Users />}
            loading={showSkeleton || !magicCardsDataReady}
            iconBgColor="bg-blue-50/20"
            iconColor="text-blue-700 dark:text-blue-400"
            borderColor="border-blue-200/50 dark:border-blue-900/50"
            gradientColor="from-blue-500/10 to-blue-500/5"
            cardBgColor="bg-blue-50/50 dark:bg-blue-950/20"
            delay={0.2}
            padding="p-3 sm:p-3.5"
          />
        </Link>

        <MetricCard
          title="Administrators"
          value={magicCardsDataReady && !showSkeleton ? stats.adminCount : 0}
          description="System superusers"
          icon={<ShieldUser />}
          loading={showSkeleton || !magicCardsDataReady}
          iconBgColor="bg-amber-500/20"
          iconColor="text-amber-700 dark:text-amber-400"
          borderColor="border-amber-200/50 dark:border-amber-900/50"
          gradientColor="from-amber-500/10 to-amber-500/5"
          cardBgColor="bg-amber-50/50 dark:bg-amber-950/20"
          delay={0.3}
          padding="p-3 sm:p-3.5"
        />

        <MetricCard
          title="Moderators"
          value={magicCardsDataReady && !showSkeleton ? stats.moderatorCount : 0}
          description="Sub-administrators"
          icon={<UserStar />}
          loading={showSkeleton || !magicCardsDataReady}
          iconBgColor="bg-purple-500/20"
          iconColor="text-purple-700 dark:text-purple-400"
          borderColor="border-purple-200/50 dark:border-purple-900/50"
          gradientColor="from-purple-500/10 to-purple-500/5"
          cardBgColor="bg-purple-50/50 dark:bg-purple-950/20"
          delay={0.4}
          padding="p-3 sm:p-3.5"
        />

        {stats.employeeCount > 0 ? (
          <MetricCard
            title="Employees"
            value={magicCardsDataReady && !showSkeleton ? stats.employeeCount : 0}
            description="Staff members"
            icon={<SquareUser />}
            loading={showSkeleton || !magicCardsDataReady}
            iconBgColor="bg-emerald-500/20"
            iconColor="text-emerald-700 dark:text-emerald-400"
            borderColor="border-emerald-200/50 dark:border-emerald-900/50"
            gradientColor="from-emerald-500/10 to-emerald-500/5"
            cardBgColor="bg-emerald-50/50 dark:bg-emerald-950/20"
            delay={0.5}
            padding="p-3 sm:p-3.5"
          />
        ) : (
          <MetricCard
            title="Active Users"
            value={magicCardsDataReady && !showSkeleton ? activeUsers : 0}
            description="Active in last 7 days"
            icon={<TrendingUp />}
            loading={showSkeleton || !magicCardsDataReady}
            iconBgColor="bg-green-500/20"
            iconColor="text-green-700 dark:text-green-400"
            borderColor="border-green-200/50 dark:border-green-900/50"
            gradientColor="from-green-500/10 to-green-500/5"
            cardBgColor="bg-green-50/50 dark:bg-green-950/20"
            delay={0.5}
            padding="p-3 sm:p-3.5"
          />
        )}
      </div>

      {/* Expanded Quick Actions Grid (Cohesive Full-Width Layout) */}
      <div className="grid grid-cols-1 gap-6" data-testid="quick-actions-row">
        <MetricCard
          className="shadow-sm border-border/30"
          gradientColor="from-primary/5 to-transparent"
          delay={0.3}
          disableHover={true}
          borderColor="border-border/30"
          cardBgColor="bg-card/40"
        >
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-primary rounded-full" />
              <h3 className="text-lg font-bold font-display tracking-tight text-foreground select-none">Quick Actions</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
              {/* Add User Item */}
              <div
                onClick={() => setShowAddUserSheet(true)}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-blue-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">New User</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Create User</p>
                </div>
              </div>

              {/* Attendance Logs */}
              <Link
                href="/admin/payroll/attendance"
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-amber-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">Logs</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Attendance</p>
                </div>
              </Link>

              {/* Leave Requests */}
              <Link
                href="/admin/payroll/leaves"
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-purple-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">Approvals</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Leave Requests</p>
                </div>
              </Link>

              {/* Photo Approvals */}
              <Link
                href="/admin/photo-approvals"
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-emerald-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">Verification</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Photo Approvals</p>
                </div>
              </Link>

              {/* Support Helpdesk */}
              <Link
                href="/admin/tickets"
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-indigo-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <Ticket className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">Helpdesk</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Support Tickets</p>
                </div>
              </Link>

              {/* Client Manager */}
              <Link
                href="/admin/clients"
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-pink-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">Business</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Client Manager</p>
                </div>
              </Link>

              {/* Reports Item */}
              <Link
                href="/admin/reports"
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-orange-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">Reports</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Analytics Panel</p>
                </div>
              </Link>

              {/* Analytics Item */}
              <Link
                href="/admin/analytics"
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 hover:border-purple-500/20 active:scale-[0.98] transition-all duration-150 group/admin-action cursor-pointer shadow-xs"
              >
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover/admin-action:scale-105 transition-transform duration-200 flex-shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5 select-none">Statistics</p>
                  <p className="text-sm font-semibold font-display text-foreground group-hover/admin-action:text-primary transition-colors truncate">Insights & Trends</p>
                </div>
              </Link>
            </div>
          </div>
        </MetricCard>
      </div>



      {/* Recent Activities - Compact */}
      <div data-testid="detailed-content">
        <CardShell
          title="Recent Activities"
          description="Real-time update stream"
          icon={Activity}
          contentClassName="p-2.5 pt-1"
        >
          <div className="bg-background/30 rounded-2xl border border-primary/5 p-2.5">
            <ActivityLogFeed
              activities={recentActivities as any}
              isLoading={showSkeleton || !recentActivityDataReady}
              maxItems={10}
            />
          </div>
        </CardShell>
      </div>

      {/* Modern Add User Form with Built-in Sheet */}
      <ModernAddUserForm
        open={showAddUserSheet}
        onOpenChange={setShowAddUserSheet}
        useSheet={true}
        onSuccess={handleAddUserSuccess}
        title="Add New User"
        description="Create a new user account with proper access permissions"
        refetch={handleAddUserRefetch}
      />

    </div>
  )
}
