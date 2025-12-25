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
import { format } from 'date-fns'

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
  History
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

  // Track if this is a return visit to the dashboard
  const [isReturnVisit, setIsReturnVisit] = useState(false)

  // Get current user's profile to obtain userId for role-based real-time subscriptions
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Get last session info
  const { data: sessionInfo, isLoading: sessionLoading } = trpc.profile.getLastSession.useQuery(undefined, {
    staleTime: 60 * 1000, // Cache for 1 minute
  })

  // Use the dashboard prefetch hook
  const { clearPrefetch } = useDashboardPrefetch()

  // Use the admin-specific real-time dashboard hook with the user's ID
  // This ensures admins receive updates for:
  // - New user registrations (profiles table)
  // - All activity changes (activities table)
  // - Analytics metrics changes (analytics_metrics table)
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
  } = useAdminRealtimeDashboard(profile?.user_id || '', initialData)

  // Detect route changes to reset skeleton state
  useEffect(() => {
    const isDashboardRoute = pathname?.includes('/admin')
    const wasOnDifferentRoute = previousPathnameRef.current !== null &&
      previousPathnameRef.current !== pathname

    if (isDashboardRoute && wasOnDifferentRoute) {
      console.log('[ADMIN-OVERVIEW] Route changed to dashboard, marking as return visit')
      setIsReturnVisit(true)
      // Clear prefetch status to ensure fresh skeleton display
      clearPrefetch()
    }

    previousPathnameRef.current = pathname
  }, [pathname, clearPrefetch])

  // Track overall loading state for parent component
  // Use showSkeleton to ensure skeleton shows on every visit
  useEffect(() => {
    onLoadingChange?.(isLoading || showSkeleton)
  }, [isLoading, showSkeleton, onLoadingChange])

  // Overall error state
  if (isError && !stats.totalUsers && !stats.totalActivities && !stats.todayActivities) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
        <Button onClick={refetch} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 gesture-friendly">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <PageHeading
          heading="Admin Dashboard"
          description="Overview of your application metrics and activities"
          variant="gradient"
        />
      </div>

      {/* Quick Actions & Session Row - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="quick-actions-row">
        {/* Quick Actions Column */}
        <MetricCard
          className="shadow-lg hover:border-primary/30 transition-colors duration-300"
          gradientColor="from-gray-500/5 to-gray-500/5"
          delay={0.1}
          disableHover={true}
        >
          <div className="flex flex-col gap-2 h-full">
            <div>
              <h3 className="text-lg font-bold">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
              {/* Add User Item */}
              <div
                onClick={() => setShowAddUserSheet(true)}
                className="flex items-center gap-3 p-3 rounded-xl border border-blue-200/50 bg-blue-50/30 dark:bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all duration-300 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">New User</p>
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">Create User</p>
                </div>
              </div>

              {/* Reports Item */}
              <Link
                href="/admin/reports"
                className="flex items-center gap-3 p-3 rounded-xl border border-orange-200/50 bg-orange-50/30 dark:bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all duration-300 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-400 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">Get Reports</p>
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">Reports</p>
                </div>
              </Link>

              {/* Analytics Item */}
              <Link
                href="/admin/analytics"
                className="flex items-center gap-3 p-3 rounded-xl border border-purple-200/50 bg-purple-50/30 dark:bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">View Stats</p>
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">Analytics</p>
                </div>
              </Link>
            </div>
          </div>
        </MetricCard>

        {/* Session & Activity Summary Column */}
        <MetricCard
          className="shadow-lg hover:border-primary/30 transition-colors duration-300"
          gradientColor="from-indigo-500/5 to-purple-500/5"
          delay={0.15}
          disableHover={true}
        >
          <div className="flex flex-col gap-2 h-full">
            <div>
              <h3 className="text-lg font-bold">Account Overview</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
              {/* Total Activity Item */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: magicCardsDataReady ? 1 : 0, y: magicCardsDataReady ? 0 : 10 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-indigo-200/50 bg-indigo-50/30 dark:bg-indigo-500/5 hover:border-indigo-500/50 transition-all duration-300 group cursor-default"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">Total Activity</p>
                  <p className="text-sm font-bold">
                    {showSkeleton || !magicCardsDataReady ? (
                      <span className="h-4 w-12 bg-muted animate-pulse rounded block" />
                    ) : (
                      stats.totalActivities
                    )}
                  </p>
                </div>
              </motion.div>

              {/* Last Logout Item */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: magicCardsDataReady ? 1 : 0, y: magicCardsDataReady ? 0 : 10 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-pink-200/50 bg-pink-50/30 dark:bg-pink-500/5 hover:border-pink-500/50 transition-all duration-300 group cursor-default"
              >
                <div className="p-2 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400 group-hover:scale-110 transition-transform">
                  <LogOut className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">Last Logout</p>
                  <p className="text-sm font-semibold">
                    {sessionLoading || !magicCardsDataReady ? (
                      <span className="h-4 w-24 bg-muted animate-pulse rounded block" />
                    ) : (
                      sessionInfo?.lastLogout ? format(new Date(sessionInfo.lastLogout), "MMM dd, HH:mm") : "None"
                    )}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Critical Metrics - Compact Grid */}
      {/* Use showSkeleton to ensure skeleton shows on every page visit, not just initial load */}
      <div data-testid="critical-metrics" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users" className="block h-full">
          <MetricCard
            title="Total Users"
            value={magicCardsDataReady && !showSkeleton ? stats.totalUsers : 0}
            description="Registered users"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            loading={showSkeleton || !magicCardsDataReady}
            iconBgColor="bg-blue-500/20"
            iconColor="text-blue-700"
            borderColor="border-blue-200"
            gradientColor="from-blue-500/10 to-blue-500/5"
            cardBgColor="bg-blue-50/50 dark:bg-blue-900/10"
            delay={0.2}
          />
        </Link>

        <MetricCard
          title="Total Admin role"
          value={magicCardsDataReady && !showSkeleton ? stats.adminCount : 0}
          description="System administrators"
          icon={<ShieldUser className="h-4 w-4 text-muted-foreground" />}
          loading={showSkeleton || !magicCardsDataReady}
          iconBgColor="bg-orange-500/20"
          iconColor="text-orange-700"
          borderColor="border-orange-200"
          gradientColor="from-orange-500/10 to-orange-500/5"
          cardBgColor="bg-orange-50/50 dark:bg-orange-900/10"
          delay={0.3}
        />

        <MetricCard
          title="Total Moderator role"
          value={magicCardsDataReady && !showSkeleton ? stats.moderatorCount : 0}
          description="System moderators"
          icon={<UserStar className="h-4 w-4 text-muted-foreground" />}
          loading={showSkeleton || !magicCardsDataReady}
          iconBgColor="bg-purple-500/20"
          iconColor="text-purple-700"
          borderColor="border-purple-200"
          gradientColor="from-purple-500/10 to-purple-500/5"
          cardBgColor="bg-purple-50/50 dark:bg-purple-900/10"
          delay={0.4}
        />

        {stats.employeeCount > 0 ? (
          <MetricCard
            title="Total Employee role"
            value={magicCardsDataReady && !showSkeleton ? stats.employeeCount : 0}
            description="Staff members"
            icon={<SquareUser className="h-4 w-4 text-muted-foreground" />}
            loading={showSkeleton || !magicCardsDataReady}
            iconBgColor="bg-green-500/20"
            iconColor="text-green-700"
            borderColor="border-green-200"
            gradientColor="from-green-500/10 to-green-500/5"
            cardBgColor="bg-green-50/50 dark:bg-green-900/10"
            delay={0.5}
          />
        ) : (
          <MetricCard
            title="Active Users"
            value={magicCardsDataReady && !showSkeleton ? activeUsers : 0}
            description="Active in last 7 days"
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            loading={showSkeleton || !magicCardsDataReady}
            iconBgColor="bg-green-500/20"
            iconColor="text-green-700"
            borderColor="border-green-200"
            gradientColor="from-green-500/10 to-green-500/5"
            cardBgColor="bg-green-50/50 dark:bg-green-900/10"
            delay={0.5}
          />
        )}
      </div>

      {/* Recent Activities - Compact */}
      {/* Use showSkeleton to ensure skeleton shows on every page visit */}
      <div data-testid="detailed-content">
        <MetricCard
          className="shadow-lg"
          gradientColor="from-gray-500/5 to-gray-500/5"
          delay={0.6}
          disableHover={true}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-lg font-bold">Recent Activities</h3>
                <p className="text-sm text-muted-foreground">Latest user activities</p>
              </div>
            </div>
            <div>
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
        onSuccess={() => {
          // Real-time dashboard will automatically refresh via event listeners
          refetch()
        }}
        title="Add New User"
        description="Create a new user account with proper access permissions"
        refetch={refetch}
      />

    </div>
  )
}
