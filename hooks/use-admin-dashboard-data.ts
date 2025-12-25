'use client'

import { trpc } from '@/lib/trpc/client'
import { useMemo, useEffect } from 'react'

interface AdminDashboardData {
  stats: {
    totalUsers: number
    totalActivities: number
    todayActivities: number
  } | null
  analytics: Array<{
    id: string
    metric_name: string
    metric_value: number
    metric_date: string
  }> | null
  recentActivities: Array<{
    id: string
    description: string
    created_at: string
    profiles?: {
      email: string
      full_name: string
    }
  }> | null
}

interface AdminDashboardDataState {
  data: AdminDashboardData
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  errors: Array<unknown>
  refetch: () => void
}

export function useAdminDashboardData(): AdminDashboardDataState {
  // Use tRPC hooks with custom stale times for parallel execution
  const statsQuery = trpc.admin.dashboard.getStats.useQuery(undefined, {
    staleTime: 30 * 1000, // 30 seconds
  })

  const analyticsQuery = trpc.admin.analytics.getAnalytics.useQuery({ days: 7 }, {
    staleTime: 60 * 1000, // 60 seconds
  })

  const activitiesQuery = trpc.admin.dashboard.getRecentActivities.useQuery({ limit: 5 }, {
    staleTime: 15 * 1000, // 15 seconds
  })

  const isLoading = useMemo(() =>
    statsQuery.isLoading || analyticsQuery.isLoading || activitiesQuery.isLoading,
    [statsQuery.isLoading, analyticsQuery.isLoading, activitiesQuery.isLoading]
  )

  const isError = useMemo(() =>
    statsQuery.isError || analyticsQuery.isError || activitiesQuery.isError,
    [statsQuery.isError, analyticsQuery.isError, activitiesQuery.isError]
  )

  const isFetching = useMemo(() =>
    statsQuery.isFetching || analyticsQuery.isFetching || activitiesQuery.isFetching,
    [statsQuery.isFetching, analyticsQuery.isFetching, activitiesQuery.isFetching]
  )

  const errors = useMemo(() =>
    [statsQuery.error, analyticsQuery.error, activitiesQuery.error],
    [statsQuery.error, analyticsQuery.error, activitiesQuery.error]
  )

  const refetch = () => {
    statsQuery.refetch()
    analyticsQuery.refetch()
    activitiesQuery.refetch()
  }

  const data: AdminDashboardData = useMemo(() => ({
    stats: statsQuery.data ? {
      totalUsers: statsQuery.data.totalUsers,
      totalActivities: statsQuery.data.totalActivities,
      todayActivities: statsQuery.data.todayActivities,
    } : null,
    analytics: analyticsQuery.data || null,
    recentActivities: activitiesQuery.data?.data || null,
  }), [statsQuery.data, analyticsQuery.data, activitiesQuery.data])

  return {
    data,
    isLoading,
    isError,
    isFetching,
    errors,
    refetch,
  }
}