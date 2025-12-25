'use client'

import { trpc } from '@/lib/trpc/client'
import { useMemo } from 'react'
import type { DashboardData } from '@/types'

interface AdminDashboardDataState {
  data: DashboardData | null
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  error: unknown
  refetch: () => void
}

export function useAdminDashboardDataCombined(
  analyticsDays: number = 7,
  activitiesLimit: number = 10
): AdminDashboardDataState {
  // Use the new combined endpoint
  const dashboardQuery = trpc.admin.dashboard.getUnifiedDashboardData.useQuery(
    {
      analyticsDays,
      activitiesLimit
    },
    {
      staleTime: 30 * 1000, // 30 seconds cache
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    }
  )

  // Transform the data to match the existing interface for backward compatibility
  const data: DashboardData | null = useMemo(() => {
    if (!dashboardQuery.data) return null

    const unified = dashboardQuery.data

    // Transform unified dashboard data to DashboardData format
    return {
      stats: {
        totalUsers: unified.critical.totalUsers,
        totalActivities: unified.secondary.totalActivities,
        todayActivities: unified.secondary.todayActivities,
      },
      analytics: unified.secondary.analytics || [],
      recentActivities: unified.detailed.recentActivities || [],
      metadata: {
        fetchedAt: unified.metadata.fetchedAt,
        version: unified.metadata.version,
        cacheExpiry: unified.critical.metadata.cacheExpiry,
      }
    }
  }, [dashboardQuery.data])

  return {
    data,
    isLoading: dashboardQuery.isLoading,
    isError: dashboardQuery.isError,
    isFetching: dashboardQuery.isFetching,
    error: dashboardQuery.error,
    refetch: dashboardQuery.refetch,
  }
}