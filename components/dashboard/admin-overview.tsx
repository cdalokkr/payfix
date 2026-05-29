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
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

import { MetricCard } from '@/components/dashboard/metric-card'
import { ActivityLogFeed } from '@/components/dashboard/activity-log-feed'



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
      <div data-testid="critical-metrics" className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
          />
        )}
      </div>

      {/* Expanded Quick Actions Grid (Cohesive Full-Width Layout) */}
      <div className="grid grid-cols-1 gap-6" data-testid="quick-actions-row">
        <MetricCard
          className="shadow-xl border-border/40"
          gradientColor="from-primary/10 to-transparent"
          delay={0.3}
          disableHover={true}
          borderColor="border-primary/10"
          cardBgColor="bg-card/50"
        >
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 bg-primary rounded-full" />
              <h3 className="text-xl font-bold tracking-tight">Quick Actions</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-2">
              {/* Add User Item */}
              <div
                onClick={() => setShowAddUserSheet(true)}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-blue-200/40 bg-blue-50/30 dark:bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 group-hover/admin-action:scale-115 group-hover/admin-action:rotate-3 transition-all">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">New User</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Create User</p>
                </div>
              </div>

              {/* Attendance Logs */}
              <Link
                href="/admin/payroll/attendance"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200/40 bg-amber-50/30 dark:bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 group-hover/admin-action:scale-115 group-hover/admin-action:rotate-3 transition-all">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Logs</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Attendance</p>
                </div>
              </Link>

              {/* Leave Requests */}
              <Link
                href="/admin/payroll/leaves"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-200/40 bg-purple-50/30 dark:bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 group-hover/admin-action:scale-115 group-hover/admin-action:-rotate-3 transition-all">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Approvals</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Leave Requests</p>
                </div>
              </Link>

              {/* Photo Approvals */}
              <Link
                href="/admin/photo-approvals"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-emerald-200/40 bg-emerald-50/30 dark:bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group-hover/admin-action:scale-115 group-hover/admin-action:rotate-3 transition-all">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Verification</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Photo Approvals</p>
                </div>
              </Link>

              {/* Support Helpdesk */}
              <Link
                href="/admin/tickets"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200/40 bg-indigo-50/30 dark:bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 group-hover/admin-action:scale-115 group-hover/admin-action:-rotate-3 transition-all">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Helpdesk</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Support Tickets</p>
                </div>
              </Link>

              {/* Client Manager */}
              <Link
                href="/admin/clients"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-pink-200/40 bg-pink-50/30 dark:bg-pink-500/5 hover:bg-pink-500/10 hover:border-pink-500/40 hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400 group-hover/admin-action:scale-115 group-hover/admin-action:rotate-3 transition-all">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Business</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Client Manager</p>
                </div>
              </Link>

              {/* Reports Item */}
              <Link
                href="/admin/reports"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-orange-200/40 bg-orange-50/30 dark:bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-400 group-hover/admin-action:scale-115 group-hover/admin-action:-rotate-3 transition-all">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Reports</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Analytics Panel</p>
                </div>
              </Link>

              {/* Analytics Item */}
              <Link
                href="/admin/analytics"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-200/40 bg-purple-50/30 dark:bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group/admin-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 group-hover/admin-action:scale-115 group-hover/admin-action:rotate-3 transition-all">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Statistics</p>
                  <p className="text-sm font-black group-hover/admin-action:text-primary transition-colors">Insights & Trends</p>
                </div>
              </Link>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Critical Metrics - Compact Grid */}
      <div data-testid="critical-metrics" className="hidden">
        <Link href="/admin/users" className="block h-full">
          <MetricCard
            title="Total Users"
            value={magicCardsDataReady && !showSkeleton ? stats.totalUsers : 0}
            description="Registered system users"
            icon={<Users />}
            loading={showSkeleton || !magicCardsDataReady}
            iconBgColor="bg-blue-500/20"
            iconColor="text-blue-700 dark:text-blue-400"
            borderColor="border-blue-200/50 dark:border-blue-900/50"
            gradientColor="from-blue-500/10 to-blue-500/5"
            cardBgColor="bg-blue-50/50 dark:bg-blue-950/20"
            delay={0.2}
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
          />
        )}
      </div>

      {/* Recent Activities - Compact */}
      <div data-testid="detailed-content">
        <MetricCard
          className="shadow-xl"
          gradientColor="from-primary/5 to-transparent"
          delay={0.6}
          disableHover={true}
          borderColor="border-primary/10"
          cardBgColor="bg-card/50"
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Recent Activities</h3>
                <p className="text-sm text-muted-foreground">Real-time update stream</p>
              </div>
            </div>
            <div className="bg-background/30 rounded-2xl border border-primary/5 p-4">
              <ActivityLogFeed
                activities={recentActivities as any}
                isLoading={showSkeleton || !recentActivityDataReady}
                maxItems={10}
              />
            </div>
          </div>
        </MetricCard>
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
