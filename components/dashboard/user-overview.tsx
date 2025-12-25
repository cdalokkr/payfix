'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { MetricCard } from '@/components/dashboard/metric-card'
import { PageHeading } from '@/components/ui/page-heading'
import { trpc } from '@/lib/trpc/client'
import { useUserRealtimeDashboard } from '@/hooks/use-realtime-dashboard-data'
import { Profile, Activity as ActivityType } from '@/types'
import { useEffect } from 'react'
import { ActivityLogFeed, type UserActivity } from '@/components/dashboard/activity-log-feed'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { LogIn, LogOut, Calendar, History, Edit, User, Activity, Bell, BarChart3, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface ProfileCardProps {
  profile: Profile | null
  loading: boolean
}

function ProfileCard({ profile, loading }: ProfileCardProps) {
  return (
    <MetricCard
      className="shadow-lg"
      gradientColor="from-blue-500/10 to-cyan-500/10"
      delay={0.1}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-700" />
          <h3 className="text-lg font-bold">Personal Profile</h3>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : profile ? (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Name:</span> {profile.full_name || 'Not set'}
            </p>
            <p className="text-sm">
              <span className="font-medium">Email:</span> {profile.email}
            </p>
            <p className="text-sm">
              <span className="font-medium">Role:</span> {profile.role}
            </p>
            {profile.mobile_no && (
              <p className="text-sm">
                <span className="font-medium">Mobile:</span> {profile.mobile_no}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Profile not found</p>
        )}
      </div>
    </MetricCard>
  )
}

interface ActivitiesCardProps {
  activities: UserActivity[]
  loading: boolean
}

function ActivitiesCard({ activities, loading }: ActivitiesCardProps) {
  return (
    <MetricCard
      className="shadow-lg"
      gradientColor="from-gray-500/5 to-gray-500/5"
      delay={0.3}
      disableHover={true}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-700" />
          <div>
            <h3 className="text-lg font-bold">Recent Activities</h3>
            <p className="text-sm text-muted-foreground">Your latest actions</p>
          </div>
        </div>
        <ActivityLogFeed activities={activities} isLoading={loading} />
      </div>
    </MetricCard>
  )
}

interface NotificationsCardProps {
  count: number
  loading: boolean
}

function NotificationsCard({ count, loading }: NotificationsCardProps) {
  return (
    <MetricCard
      title="Unread Notifications"
      value={loading ? 0 : count}
      description="Pending notifications"
      icon={<Bell className="h-4 w-4 text-muted-foreground" />}
      loading={loading}
      iconBgColor="bg-orange-500/20"
      iconColor="text-orange-700"
      borderColor="border-orange-200"
      gradientColor="from-orange-500/10 to-red-500/10"
      cardBgColor="bg-orange-50/50 dark:bg-orange-900/10"
      delay={0.2}
    />
  )
}

export function UserOverview({
  profile,
  onLoadingChange,
  initialData
}: {
  profile?: Profile | null | undefined;
  onLoadingChange: (loading: boolean) => void;
  initialData?: any;
}) {
  const {
    recentActivities: realtimeActivities,
    isLoading: realtimeLoading,
    magicCardsDataReady,
    recentActivityDataReady,
    refetch: refetchRealtime
  } = useUserRealtimeDashboard(profile?.user_id || '', initialData, profile?.role || 'moderator')

  const { data: unreadCount, isLoading: notificationsLoading } = trpc.notification.getUnreadCount.useQuery()

  const { data: sessionInfo, isLoading: sessionLoading } = trpc.profile.getLastSession.useQuery(undefined, {
    staleTime: 60 * 1000,
  })

  // Determine if core data is ready using the progressive loading flags from the hook
  const isDataReady = (magicCardsDataReady || !!initialData) && !sessionLoading

  // Combat loading states
  const isLoading = notificationsLoading || sessionLoading || (!recentActivityDataReady && !initialData)

  useEffect(() => {
    onLoadingChange(isLoading)
  }, [isLoading, onLoadingChange])

  return (
    <div className="space-y-6 gesture-friendly">
      {/* Header */}
      <PageHeading
        heading="Moderator Dashboard"
        description="Overview of your profile and recent activities"
        variant="gradient"
      />

      {/* Quick Actions & Session Row - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions Column */}
        <MetricCard
          className="shadow-lg hover:border-primary/30 transition-colors duration-300"
          gradientColor="from-gray-500/5 to-gray-500/5"
          delay={0.3}
          disableHover={true}
        >
          <div className="flex flex-col gap-4 h-full">
            <div>
              <h3 className="text-lg font-bold">Quick Actions</h3>
              <p className="text-sm text-muted-foreground">Quick navigation</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
              {/* Edit Profile Item */}
              <Link
                href="/moderator/profile"
                className="flex items-center gap-3 p-3 rounded-xl border border-blue-200/50 bg-blue-50/30 dark:bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all duration-300 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">Settings</p>
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">Edit Profile</p>
                </div>
              </Link>

              {/* Reports Item */}
              <Link
                href="/moderator/reports"
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
                href="/moderator/analytics"
                className="flex items-center gap-3 p-3 rounded-xl border border-green-200/50 bg-green-50/30 dark:bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/50 transition-all duration-300 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 group-hover:scale-110 transition-transform">
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
          delay={0.35}
          disableHover={true}
        >
          <div className="flex flex-col gap-4 h-full">
            <div>
              <h3 className="text-lg font-bold">Account Overview</h3>
              <p className="text-sm text-muted-foreground">Session and activity details</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
              {/* Total Activities */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: isDataReady ? 1 : 0, scale: isDataReady ? 1 : 0.95 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-purple-200/50 bg-purple-50/30 dark:bg-purple-500/5 transition-all duration-300 group cursor-default"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">Activities</p>
                  <div className="mt-1">
                    {sessionLoading ? (
                      <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-sm font-bold">{sessionInfo?.totalActivities || 0}</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Last Logged Out */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: isDataReady ? 1 : 0, scale: isDataReady ? 1 : 0.95 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-pink-200/50 bg-pink-50/30 dark:bg-pink-500/5 transition-all duration-300 group cursor-default"
              >
                <div className="p-2 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400 group-hover:scale-110 transition-transform">
                  <LogOut className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">Last Logout</p>
                  <div className="mt-1">
                    {sessionLoading ? (
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-xs font-semibold truncate">
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

      {/* Recent Activities - Compact */}
      <ActivitiesCard activities={realtimeActivities as any} loading={!recentActivityDataReady && !initialData} />


    </div>
  )
}