'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardPageLayout } from '@/components/dashboard/dashboard-page-layout'
import { MetricCard } from '@/components/dashboard/metric-card'
import { PageHeading } from '@/components/ui/page-heading'
import { trpc } from '@/lib/trpc/client'
import { useUserRealtimeDashboard } from '@/hooks/use-realtime-dashboard-data'
import { Profile } from '@/types'
import { useEffect, useMemo } from 'react'
import { ActivityLogFeed, type UserActivity } from '@/components/dashboard/activity-log-feed'
import { motion } from 'framer-motion'
import { format, isValid } from 'date-fns'
import {
  LogOut,
  Calendar,
  History,
  User,
  Activity,
  Bell,
  BarChart3,
  TrendingUp,
  Clock,
  Briefcase,
  Ticket,
  Camera,
  ShieldAlert
} from 'lucide-react'
import Link from 'next/link'



interface ActivitiesCardProps {
  activities: UserActivity[]
  loading: boolean
}

function ActivitiesCard({ activities, loading }: ActivitiesCardProps) {
  return (
    <MetricCard
      className="shadow-xl border-border/40"
      gradientColor="from-purple-500/10 to-transparent"
      delay={0.4}
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
            <p className="text-sm text-muted-foreground">Real-time update logs</p>
          </div>
        </div>
        <div className="bg-background/30 rounded-2xl border border-primary/5 p-4">
          <ActivityLogFeed activities={activities} isLoading={loading} />
        </div>
      </div>
    </MetricCard>
  )
}

export function UserOverview({
  profile,
  onLoadingChange,
  initialData
}: {
  profile?: Profile | null | undefined
  onLoadingChange: (loading: boolean) => void
  initialData?: any
}) {
  const {
    recentActivities: realtimeActivities,
    isLoading: realtimeLoading,
    magicCardsDataReady,
    recentActivityDataReady,
  } = useUserRealtimeDashboard(profile?.id || '', initialData, profile?.role || 'moderator')

  const { data: unreadCount, isLoading: notificationsLoading } = trpc.notification.getUnreadCount.useQuery(undefined, {
    staleTime: 15000,
    refetchOnWindowFocus: false,
  })

  const { data: sessionInfo, isLoading: sessionLoading } = trpc.profile.getLastSession.useQuery(undefined, {
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Combine loading flags safely
  const isDataReady = (magicCardsDataReady || !!initialData) && !sessionLoading
  const isLoading = notificationsLoading || sessionLoading || (!recentActivityDataReady && !initialData)

  useEffect(() => {
    onLoadingChange(isLoading)
  }, [isLoading, onLoadingChange])

  return (
    <div className="space-y-6 gesture-friendly">

      


      {/* Expanded Quick Actions Grid (Cohesive Full-Width Layout) */}
      <div className="grid grid-cols-1 gap-6">
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
              {/* Attendance Logs */}
              <Link
                href="/moderator/payroll/attendance"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-blue-200/40 bg-blue-50/30 dark:bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 group-hover/mod-action:scale-115 group-hover/mod-action:rotate-3 transition-all">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Logs</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">Attendance</p>
                </div>
              </Link>

              {/* Leave Requests */}
              <Link
                href="/moderator/payroll/leaves"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-200/40 bg-purple-50/30 dark:bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 group-hover/mod-action:scale-115 group-hover/mod-action:-rotate-3 transition-all">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Approvals</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">Leave requests</p>
                </div>
              </Link>

              {/* Photo Approvals */}
              <Link
                href="/moderator/photo-approvals"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-emerald-200/40 bg-emerald-50/30 dark:bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group-hover/mod-action:scale-115 group-hover/mod-action:rotate-3 transition-all">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Verification</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">Photo Approvals</p>
                </div>
              </Link>

              {/* Support Helpdesk */}
              <Link
                href="/moderator/tickets"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200/40 bg-amber-50/30 dark:bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 group-hover/mod-action:scale-115 group-hover/mod-action:-rotate-3 transition-all">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Helpdesk</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">Support Tickets</p>
                </div>
              </Link>

              {/* Client Manager */}
              <Link
                href="/moderator/clients"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-pink-200/40 bg-pink-50/30 dark:bg-pink-500/5 hover:bg-pink-500/10 hover:border-pink-500/40 hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-400 group-hover/mod-action:scale-115 group-hover/mod-action:rotate-3 transition-all">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Business</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">Client Manager</p>
                </div>
              </Link>

              {/* Settings Profile */}
              <Link
                href="/moderator/profile"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200/40 bg-indigo-50/30 dark:bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 group-hover/mod-action:scale-115 group-hover/mod-action:-rotate-3 transition-all">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Settings</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">My Profile</p>
                </div>
              </Link>

              {/* Analytics Insights */}
              <Link
                href="/moderator/reports"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-orange-200/40 bg-orange-50/30 dark:bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-400 group-hover/mod-action:scale-115 group-hover/mod-action:rotate-3 transition-all">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Reports</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">Analytics Panel</p>
                </div>
              </Link>

              {/* Statistics Panel */}
              <Link
                href="/moderator/analytics"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-teal-200/40 bg-teal-50/30 dark:bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300 group/mod-action cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 group-hover/mod-action:scale-115 group-hover/mod-action:-rotate-3 transition-all">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Statistics</p>
                  <p className="text-sm font-semibold group-hover/mod-action:font-black group-hover/mod-action:text-primary transition-all duration-300">Insights & Trends</p>
                </div>
              </Link>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Recent Activities */}
      <ActivitiesCard activities={realtimeActivities as any} loading={!recentActivityDataReady && !initialData} />

    </div>
  )
}