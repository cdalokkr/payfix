'use client'

import { trpc } from '@/lib/trpc/client'
import { useMemo, useEffect, useRef } from 'react'

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

export function useAdminDashboardDataWithLogging(): AdminDashboardDataState {
  const startTimeRef = useRef(Date.now());
  const startTime = startTimeRef.current;
  console.log('🚀 [AdminDashboard] Starting data fetch at:', new Date().toISOString());

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

  // Log individual query completions
  useEffect(() => {
    if (statsQuery.data && !statsQuery.isLoading) {
      console.log('✅ [AdminDashboard] Stats query completed at:', new Date().toISOString());
    }
  }, [statsQuery.data, statsQuery.isLoading]);

  useEffect(() => {
    if (analyticsQuery.data && !analyticsQuery.isLoading) {
      console.log('✅ [AdminDashboard] Analytics query completed at:', new Date().toISOString());
    }
  }, [analyticsQuery.data, analyticsQuery.isLoading]);

  useEffect(() => {
    if (activitiesQuery.data && !activitiesQuery.isLoading) {
      console.log('✅ [AdminDashboard] Activities query completed at:', new Date().toISOString());
    }
  }, [activitiesQuery.data, activitiesQuery.isLoading]);

  // Log individual query errors
  useEffect(() => {
    if (statsQuery.error) {
      console.error('❌ [AdminDashboard] Stats query failed:', statsQuery.error);
    }
  }, [statsQuery.error]);

  useEffect(() => {
    if (analyticsQuery.error) {
      console.error('❌ [AdminDashboard] Analytics query failed:', analyticsQuery.error);
    }
  }, [analyticsQuery.error]);

  useEffect(() => {
    if (activitiesQuery.error) {
      console.error('❌ [AdminDashboard] Activities query failed:', activitiesQuery.error);
    }
  }, [activitiesQuery.error]);

  // Track when all queries complete
  useEffect(() => {
    if (!statsQuery.isLoading && !analyticsQuery.isLoading && !activitiesQuery.isLoading) {
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      console.log(`🎉 [AdminDashboard] All queries completed in ${totalTime}ms`);

      // Check if queries were executed in parallel
      const allQueriesCompleted =
        statsQuery.data !== undefined &&
        analyticsQuery.data !== undefined &&
        activitiesQuery.data !== undefined;

      if (allQueriesCompleted) {
        console.log('✅ [AdminDashboard] All data loaded successfully');
        console.log('📊 [AdminDashboard] Data summary:', {
          stats: statsQuery.data ? 'loaded' : 'missing',
          analytics: analyticsQuery.data ? `${Array.isArray(analyticsQuery.data) ? analyticsQuery.data.length : 0} items` : 'missing',
          activities: activitiesQuery.data ? `${Array.isArray(activitiesQuery.data.data) ? activitiesQuery.data.data.length : 0} items` : 'missing'
        });
      }
    }
  }, [statsQuery.isLoading, analyticsQuery.isLoading, activitiesQuery.isLoading, statsQuery.data, analyticsQuery.data, activitiesQuery.data, startTime]);

  const isLoading = useMemo(() => {
    const loading = statsQuery.isLoading || analyticsQuery.isLoading || activitiesQuery.isLoading;
    if (loading) {
      console.log('⏳ [AdminDashboard] Still loading:', {
        stats: statsQuery.isLoading,
        analytics: analyticsQuery.isLoading,
        activities: activitiesQuery.isLoading
      });
    }
    return loading;
  }, [statsQuery.isLoading, analyticsQuery.isLoading, activitiesQuery.isLoading])

  const isError = useMemo(() => {
    const error = statsQuery.isError || analyticsQuery.isError || activitiesQuery.isError;
    if (error) {
      console.error('❌ [AdminDashboard] Errors detected:', {
        stats: statsQuery.isError,
        analytics: analyticsQuery.isError,
        activities: activitiesQuery.isError,
        errors: [statsQuery.error, analyticsQuery.error, activitiesQuery.error]
      });
    }
    return error;
  }, [statsQuery.isError, analyticsQuery.isError, activitiesQuery.isError, statsQuery.error, analyticsQuery.error, activitiesQuery.error])

  const isFetching = useMemo(() =>
    statsQuery.isFetching || analyticsQuery.isFetching || activitiesQuery.isFetching,
    [statsQuery.isFetching, analyticsQuery.isFetching, activitiesQuery.isFetching]
  )

  const errors = useMemo(() =>
    [statsQuery.error, analyticsQuery.error, activitiesQuery.error],
    [statsQuery.error, analyticsQuery.error, activitiesQuery.error]
  )

  const refetch = () => {
    console.log('🔄 [AdminDashboard] Manual refetch triggered');
    const refetchStartTime = Date.now();

    Promise.all([
      statsQuery.refetch(),
      analyticsQuery.refetch(),
      activitiesQuery.refetch()
    ]).then(() => {
      const refetchTime = Date.now() - refetchStartTime;
      console.log(`🔄 [AdminDashboard] Refetch completed in ${refetchTime}ms`);
    }).catch((error) => {
      console.error('❌ [AdminDashboard] Refetch failed:', error);
    });
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