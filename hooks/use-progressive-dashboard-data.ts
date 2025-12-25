'use client'

import { trpc } from '@/lib/trpc/client'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { smartCacheManager } from '@/lib/cache/smart-cache-manager'
import { cacheInvalidation } from '@/lib/cache/cache-invalidation'
import { backgroundRefresher } from '@/lib/cache/background-refresher'
import { adaptiveTTLEngine } from '@/lib/cache/adaptive-ttl-engine'
import { dashboardPrefetcher } from '@/lib/dashboard-prefetch'

interface CriticalData {
  totalUsers: number
  activeUsers: number
  metadata: {
    tier: string
    fetchedAt: string
    cacheExpiry: number
  }
}

interface SecondaryData {
  totalActivities: number
  todayActivities: number
  analytics: Array<{
    id: string
    metric_name: string
    metric_value: number
    metric_date: string
  }>
  metadata: {
    tier: string
    fetchedAt: string
    cacheExpiry: number
  }
}

interface DetailedData {
  recentActivities: Array<{
    id: string
    description: string
    created_at: string
    profiles?: {
      email: string
      full_name: string
    }
  }>
  metadata: {
    tier: string
    fetchedAt: string
    cacheExpiry: number
  }
}

interface ProgressiveDashboardDataState {
  criticalData: CriticalData | null
  secondaryData: SecondaryData | null
  detailedData: DetailedData | null
  isLoading: {
    critical: boolean
    secondary: boolean
    detailed: boolean
  }
  isError: {
    critical: boolean
    secondary: boolean
    detailed: boolean
  }
  errors: {
    critical: unknown
    secondary: unknown
    detailed: unknown
  }
  refetch: {
    critical: () => void
    secondary: () => void
    detailed: () => void
    all: () => void
    comprehensive: () => void
  }
  cacheStatus: {
    critical: { hit: boolean; loading: boolean }
    secondary: { hit: boolean; loading: boolean }
    detailed: { hit: boolean; loading: boolean }
  }
  comprehensiveData?: {
    critical: CriticalData
    secondary: SecondaryData
    detailed: DetailedData
    stats: any
    analytics: any[]
    recentActivities: any[]
    metadata: any
  }
}

export function useProgressiveDashboardData(): ProgressiveDashboardDataState {
  const [cacheStatus, setCacheStatus] = useState({
    critical: { hit: false, loading: false },
    secondary: { hit: false, loading: false },
    detailed: { hit: false, loading: false }
  })

  // Request deduplication flag for comprehensive queries
  const comprehensiveQueryInProgress = useRef(false)
  const prefetchPromiseRef = useRef<Promise<any> | null>(null)

  // State to track prefetch completion for reactivity
  // State to manage magic cards loading states for UI coordination
  const [magicCardsDataReady, setMagicCardsDataReady] = useState(true)
  const [recentActivityDataReady, setRecentActivityDataReady] = useState(true)


  const [prefetchCompleted, setPrefetchCompleted] = useState(dashboardPrefetcher.hasPrefetchCompleted())

  // Create TTL calculation context
  const getTTLContext = useCallback((dataType: string) => ({
    dataType,
    timeOfDay: new Date(),
    dayOfWeek: new Date().getDay(),
    systemLoad: 'medium' as const,
    userProfile: {
      isActive: true,
      lastActivity: new Date(),
      role: 'admin'
    }
  }), [])


  // Set up automatic refresh for cached data using tRPC queries
  useEffect(() => {
    const setupAutomaticRefresh = () => {
      // Register automatic refresh tasks using tRPC queries
      backgroundRefresher.registerRefreshTask({
        key: 'dashboard:critical-dashboard-data',
        namespace: 'dashboard',
        dataType: 'critical-dashboard-data',
        priority: 'critical',
        refreshFunction: async () => {
          // Use direct fetch for automatic refresh to avoid React Query issues
          const response = await fetch('/api/trpc/admin.dashboard.getCriticalDashboardData', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch critical data: ${response.status}`)
          }

          const data = await response.json()
          const result = data.result.data

          await smartCacheManager.set('critical-dashboard-data', result, {
            namespace: 'dashboard',
            dataType: 'critical-dashboard-data',
            context: getTTLContext('critical-dashboard-data'),
            metadata: { tier: 'critical' }
          })
          return result
        },
        maxRetries: 3,
        backoffMultiplier: 2,
        context: getTTLContext('critical-dashboard-data')
      })

      backgroundRefresher.registerRefreshTask({
        key: 'dashboard:secondary-dashboard-data',
        namespace: 'dashboard',
        dataType: 'secondary-dashboard-data',
        priority: 'important',
        refreshFunction: async () => {
          // Use direct fetch for automatic refresh to avoid React Query issues
          const response = await fetch('/api/trpc/admin.dashboard.getSecondaryDashboardData?input=%7B%22analyticsDays%22%3A7%7D', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch secondary data: ${response.status}`)
          }

          const data = await response.json()
          const result = data.result.data

          await smartCacheManager.set('secondary-dashboard-data', result, {
            namespace: 'dashboard',
            dataType: 'secondary-dashboard-data',
            context: getTTLContext('secondary-dashboard-data'),
            metadata: { tier: 'secondary' }
          })
          return result
        },
        maxRetries: 3,
        backoffMultiplier: 2,
        context: getTTLContext('secondary-dashboard-data')
      })

      backgroundRefresher.registerRefreshTask({
        key: 'dashboard:detailed-dashboard-data',
        namespace: 'dashboard',
        dataType: 'detailed-dashboard-data',
        priority: 'normal',
        refreshFunction: async () => {
          // Use direct fetch for automatic refresh to avoid React Query issues
          const response = await fetch('/api/trpc/admin.dashboard.getDetailedDashboardData', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch detailed data: ${response.status}`)
          }

          const data = await response.json()
          const result = data.result.data

          await smartCacheManager.set('detailed-dashboard-data', result, {
            namespace: 'dashboard',
            dataType: 'detailed-dashboard-data',
            context: getTTLContext('detailed-dashboard-data'),
            metadata: { tier: 'detailed' }
          })
          return result
        },
        maxRetries: 3,
        backoffMultiplier: 2,
        context: getTTLContext('detailed-dashboard-data')
      })
    }

    setupAutomaticRefresh()

    return () => {
      // Cleanup automatic refresh tasks on unmount
      backgroundRefresher.unregisterRefreshTask('dashboard:critical-dashboard-data')
      backgroundRefresher.unregisterRefreshTask('dashboard:secondary-dashboard-data')
      backgroundRefresher.unregisterRefreshTask('dashboard:detailed-dashboard-data')
    }
  }, [getTTLContext])

  // Set up cache invalidation listeners and prefetch completion tracking
  useEffect(() => {
    const handleInvalidation = (event: { key?: string; namespace?: string }) => {
      console.log('🎯 Dashboard cache invalidation triggered:', event)
      if (event.key?.includes('dashboard') || event.namespace === 'dashboard') {
        // Invalidate relevant cache entries
        if (event.key?.includes('critical')) {
          smartCacheManager.delete('critical-dashboard-data', 'dashboard')
        } else if (event.key?.includes('secondary')) {
          smartCacheManager.delete('secondary-dashboard-data', 'dashboard')
        } else if (event.key?.includes('detailed')) {
          smartCacheManager.delete('detailed-dashboard-data', 'dashboard')
        } else {
          // Invalidate all dashboard data
          smartCacheManager.invalidateNamespace('dashboard')
        }
      }
    }

    // Listen for prefetch completion
    const handlePrefetchComplete = () => {
      setPrefetchCompleted(true)
    }

    cacheInvalidation.addEventListener('user-action', handleInvalidation)
    cacheInvalidation.addEventListener('data-change', handleInvalidation)
    cacheInvalidation.addEventListener('cross-tab', handleInvalidation)
    
    // NEW: Listen for comprehensive refresh events (logout/login mechanism)
    window.addEventListener('user-operation-complete', (event: any) => {
      console.log('🔄 USER OPERATION COMPLETE EVENT:', event.detail)

      // For user creation events, use smart invalidation to preserve prefetched data
      if (event.detail?.operation === 'user-creation' && event.detail?.refreshDashboard && event.detail?.smartInvalidation) {
        console.log('👤 USER CREATION: Smart invalidation mode - updating all magic cards simultaneously')

        // Only invalidate user-related metrics, preserve comprehensive-dashboard-data
        smartCacheManager.delete('critical-dashboard-data', 'dashboard')
        smartCacheManager.delete('stats', 'dashboard')

        // Reset magic cards loading state to trigger simultaneous update
        setMagicCardsDataReady(false)
        setRecentActivityDataReady(false)

        // Force refetch of all queries to ensure consistent state
        setTimeout(() => {
          Promise.all([
            Promise.resolve(criticalQuery.refetch()),
            Promise.resolve(secondaryQuery.refetch()),
            Promise.resolve(detailedQuery.refetch())
          ]).then(() => {
            // After all queries complete, re-enable magic cards
            setTimeout(() => {
              setMagicCardsDataReady(true)
            }, 100)
          })
        }, 50) // Small delay to ensure cache clearing completes

      } else if (event.detail?.smartInvalidation) {
        console.log('🎯 SMART INVALIDATION MODE: Preserving prefetched data, updating user metrics only')

        // Only invalidate user-related metrics, preserve comprehensive-dashboard-data
        smartCacheManager.delete('critical-dashboard-data', 'dashboard')
        smartCacheManager.delete('stats', 'dashboard')

        // Reset magic cards loading state to trigger simultaneous update
        setMagicCardsDataReady(false)

        // Force refetch of critical data only (user counts, etc.)
        if (event.detail?.refreshDashboard) {
          setTimeout(() => {
            Promise.resolve(criticalQuery.refetch()).then(() => {
              setTimeout(() => {
                setMagicCardsDataReady(true)
              }, 100)
            })
          }, 100)
        }

      } else if (event.detail?.refreshDashboard) {
        console.log('🔄 COMPREHENSIVE REFRESH MODE: Clearing all caches (logout/login behavior)')

        // Traditional comprehensive invalidation - clear everything
        smartCacheManager.invalidateNamespace('dashboard')

        // Reset magic cards loading state
        setMagicCardsDataReady(false)
        setRecentActivityDataReady(false)

        // Force immediate refetch of all data using enhanced mechanism
        setTimeout(() => {
          // Call enhanced refetchAll directly
          enhancedRefetchAll().then(() => {
            setTimeout(() => {
              setMagicCardsDataReady(true)
            }, 100)
          })
        }, 100) // Small delay to ensure cache clearing completes
      }
    })

    // Listen for prefetch completion events
    dashboardPrefetcher.prefetchDashboardData().then(() => {
      setPrefetchCompleted(true)
    }).catch(() => {
      // Prefetch failed, but that's okay - we'll fall back to queries
    })

    return () => {
      cacheInvalidation.removeEventListener('user-action', handleInvalidation)
      cacheInvalidation.removeEventListener('data-change', handleInvalidation)
      cacheInvalidation.removeEventListener('cross-tab', handleInvalidation)
      // Note: Anonymous event listener - no cleanup needed for inline handlers
    }
  }, [])

  // State to manage cached data retrieval
  const [cachedComprehensiveData, setCachedComprehensiveData] = useState<any>(null)
  const [isCacheLoading, setIsCacheLoading] = useState(false)

  // Check if prefetch has completed and coordinate with prefetch timing
  const shouldSkipComprehensiveQuery = useMemo(() => {
    if (prefetchCompleted) {
      // Check if comprehensive data is already cached from prefetch
      const hasCachedData = smartCacheManager.has('comprehensive-dashboard-data', 'dashboard')
      console.log('Prefetch completed, checking cache:', hasCachedData)
      return hasCachedData
    }
    return false
  }, [prefetchCompleted])

  // Retrieve cached comprehensive data when prefetch has completed
  useEffect(() => {
    const fetchCachedData = async () => {
      if (prefetchCompleted && !cachedComprehensiveData && !isCacheLoading) {
        setIsCacheLoading(true)
        try {
          const cached = await smartCacheManager.get('comprehensive-dashboard-data', 'dashboard')
          console.log('Retrieved cached comprehensive data:', cached)
          setCachedComprehensiveData(cached)
        } catch (error) {
          console.error('Failed to retrieve cached comprehensive data:', error)
          setCachedComprehensiveData(null)
        } finally {
          setIsCacheLoading(false)
        }
      }
    }

    fetchCachedData()
  }, [prefetchCompleted, cachedComprehensiveData, isCacheLoading])

  // Use the new comprehensive endpoint for optimal performance
  const comprehensiveQuery = trpc.admin.dashboard.getComprehensiveDashboardData.useQuery(
    { analyticsDays: 7, activitiesLimit: 10 },
    {
      staleTime: 15 * 1000, // 15 seconds
      refetchOnWindowFocus: false,
      enabled: !shouldSkipComprehensiveQuery && !comprehensiveQueryInProgress.current,
      queryFn: async () => {
        // Wait for prefetch to complete if it's running
        if (dashboardPrefetcher.isCurrentlyPrefetching()) {
          try {
            await dashboardPrefetcher.prefetchDashboardData()
          } catch (error) {
            console.warn('Prefetch wait failed:', error)
          }
        }

        if (comprehensiveQueryInProgress.current) {
          throw new Error('Comprehensive query already in progress')
        }

        comprehensiveQueryInProgress.current = true

        try {
          // Check cache first (including prefetched data)
          const cachedData = await smartCacheManager.get('comprehensive-dashboard-data', 'dashboard')
          console.log('Comprehensive query - cached data found:', !!cachedData)
          if (cachedData) {
            console.log('Using cached comprehensive data:', cachedData)
            return cachedData
          }

          // Use direct fetch for comprehensive query to avoid React Query issues
          const response = await fetch('/api/trpc/admin.dashboard.getComprehensiveDashboardData?input=%7B%22analyticsDays%22%3A7%2C%22activitiesLimit%22%3A10%7D', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch comprehensive dashboard data: ${response.status}`)
          }

          const data = await response.json()
          const result = data.result.data

          // Store in cache with adaptive TTL
          await smartCacheManager.set('comprehensive-dashboard-data', result, {
            namespace: 'dashboard',
            dataType: 'comprehensive-dashboard-data',
            context: getTTLContext('comprehensive-dashboard-data'),
            metadata: { consolidated: true }
          })

          return result
        } finally {
          comprehensiveQueryInProgress.current = false
        }
      },
    }
  )

  // Fallback queries for progressive loading if comprehensive query fails
  const criticalQuery = trpc.admin.dashboard.getCriticalDashboardData.useQuery(undefined, {
    staleTime: 15 * 1000, // 15 seconds
    refetchOnWindowFocus: false,
    enabled: !comprehensiveQuery.data && !shouldSkipComprehensiveQuery, // Only run if comprehensive query hasn't returned data and prefetch not completed
    queryFn: async () => {
      // Check cache first for critical data
      const cachedData = await smartCacheManager.get('critical-dashboard-data', 'dashboard')
      console.log('Critical query - cached data found:', !!cachedData)
      if (cachedData) {
        console.log('Using cached critical data:', cachedData)
        return cachedData
      }

      // Use direct fetch for critical query to avoid React Query issues
      const response = await fetch('/api/trpc/admin.dashboard.getCriticalDashboardData', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch critical dashboard data: ${response.status}`)
      }

      const data = await response.json()
      const result = data.result.data

      // Store in cache with adaptive TTL
      await smartCacheManager.set('critical-dashboard-data', result, {
        namespace: 'dashboard',
        dataType: 'critical-dashboard-data',
        context: getTTLContext('critical-dashboard-data'),
        metadata: { tier: 'critical' }
      })

      return result
    }
  })

  const secondaryQuery = trpc.admin.dashboard.getSecondaryDashboardData.useQuery(
    { analyticsDays: 7 },
    {
      enabled: !!comprehensiveQuery.data || !!criticalQuery.data,
      staleTime: 30 * 1000, // 30 seconds
      refetchOnWindowFocus: false,
      queryFn: async () => {
        // Check cache first for secondary data
        const cachedData = await smartCacheManager.get('secondary-dashboard-data', 'dashboard')
        console.log('Secondary query - cached data found:', !!cachedData)
        if (cachedData) {
          console.log('Using cached secondary data:', cachedData)
          return cachedData
        }

        // Use direct fetch for secondary query to avoid React Query issues
        const response = await fetch('/api/trpc/admin.dashboard.getSecondaryDashboardData?input=%7B%22analyticsDays%22%3A7%7D', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch secondary dashboard data: ${response.status}`)
        }

        const data = await response.json()
        const result = data.result.data

        // Store in cache with adaptive TTL
        await smartCacheManager.set('secondary-dashboard-data', result, {
          namespace: 'dashboard',
          dataType: 'secondary-dashboard-data',
          context: getTTLContext('secondary-dashboard-data'),
          metadata: { tier: 'secondary' }
        })

        return result
      }
    }
  )

  const detailedQuery = trpc.admin.dashboard.getDetailedDashboardData.useQuery(undefined, {
    enabled: !!comprehensiveQuery.data || !!secondaryQuery.data,
    staleTime: 60 * 1000, // 60 seconds
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Check cache first for detailed data
      const cachedData = await smartCacheManager.get('detailed-dashboard-data', 'dashboard')
      console.log('Detailed query - cached data found:', !!cachedData)
      if (cachedData) {
        console.log('Using cached detailed data:', cachedData)
        return cachedData
      }

      // Use direct fetch for detailed query to avoid React Query issues
      const response = await fetch('/api/trpc/admin.dashboard.getDetailedDashboardData', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch detailed dashboard data: ${response.status}`)
      }

      const data = await response.json()
      const result = data.result.data

      // Store in cache with adaptive TTL
      await smartCacheManager.set('detailed-dashboard-data', result, {
        namespace: 'dashboard',
        dataType: 'detailed-dashboard-data',
        context: getTTLContext('detailed-dashboard-data'),
        metadata: { tier: 'detailed' }
      })

      return result
    }
  })

  // Debounced refetch functions to prevent rapid successive calls
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedRefetch = useCallback((refetchFn: () => void, delay: number = 500) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      refetchFn()
      debounceRef.current = null
    }, delay)
  }, [])

  // Enhanced refetch functions with cache invalidation and debouncing
  const refetchCritical = useCallback(() => {
    debouncedRefetch(() => {
      smartCacheManager.delete('critical-dashboard-data', 'dashboard')
      criticalQuery.refetch()
    })
  }, [criticalQuery, debouncedRefetch])

  const refetchSecondary = useCallback(() => {
    if (comprehensiveQuery.data || criticalQuery.data) {
      debouncedRefetch(() => {
        smartCacheManager.delete('secondary-dashboard-data', 'dashboard')
        secondaryQuery.refetch()
      })
    }
  }, [comprehensiveQuery.data, criticalQuery.data, secondaryQuery, debouncedRefetch])

  const refetchDetailed = useCallback(() => {
    if (comprehensiveQuery.data || secondaryQuery.data) {
      debouncedRefetch(() => {
        smartCacheManager.delete('detailed-dashboard-data', 'dashboard')
        detailedQuery.refetch()
      })
    }
  }, [comprehensiveQuery.data, secondaryQuery.data, detailedQuery, debouncedRefetch])

  const refetchComprehensive = useCallback(() => {
    debouncedRefetch(() => {
      smartCacheManager.delete('comprehensive-dashboard-data', 'dashboard')
      comprehensiveQuery.refetch()
    })
  }, [comprehensiveQuery, debouncedRefetch])

  const refetchAll = useCallback(() => {
    debouncedRefetch(() => {
      smartCacheManager.invalidateNamespace('dashboard')
      refetchComprehensive()
      refetchCritical()
    })
  }, [refetchCritical, refetchComprehensive, debouncedRefetch])

  // NEW: Comprehensive refresh function that simulates logout/login behavior
  const triggerComprehensiveRefresh = useCallback(() => {
    console.log('🔄 TRIGGERING COMPREHENSIVE REFRESH: Exact logout/login full page refresh simulation')
    
    // STEP 1: Clear ALL cache entries (mimicking full page refresh)
    smartCacheManager.delete('critical-dashboard-data', 'dashboard')
    smartCacheManager.delete('secondary-dashboard-data', 'dashboard')
    smartCacheManager.delete('detailed-dashboard-data', 'dashboard')
    smartCacheManager.delete('comprehensive-dashboard-data', 'dashboard')
    smartCacheManager.delete('stats', 'dashboard')
    
    // STEP 2: Invalidate entire dashboard namespace (equivalent to clearing all browser data)
    smartCacheManager.invalidateNamespace('dashboard')
    
    // STEP 3: Clear localStorage and sessionStorage (full browser refresh effect)
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch (error) {
      console.warn('Error clearing storage during refresh:', error)
    }
    
    // STEP 4: Force refetch all queries with small delays to ensure proper sequencing
    // This mimics what happens when React Query resets after page refresh
    setTimeout(() => criticalQuery.refetch(), 50)
    setTimeout(() => secondaryQuery.refetch(), 100)
    setTimeout(() => detailedQuery.refetch(), 150)
    setTimeout(() => comprehensiveQuery.refetch(), 200)
  }, [criticalQuery, secondaryQuery, detailedQuery, comprehensiveQuery])
  
  // Use this comprehensive refresh for user creation and other major operations
  const enhancedRefetchAll = useCallback(() => {
    return new Promise<void>((resolve) => {
      debouncedRefetch(() => {
        triggerComprehensiveRefresh()
        // Resolve after a small delay to allow the refresh to start
        setTimeout(() => resolve(), 100)
      })
    })
  }, [triggerComprehensiveRefresh, debouncedRefetch])

  // Memoize the state to prevent unnecessary re-renders
  const state = useMemo(() => {
    console.log('Building dashboard state:', {
      comprehensiveData: !!comprehensiveQuery.data,
      criticalData: !!criticalQuery.data,
      secondaryData: !!secondaryQuery.data,
      detailedData: !!detailedQuery.data,
      shouldSkipQuery: shouldSkipComprehensiveQuery,
      cachedComprehensiveData: !!cachedComprehensiveData,
      comprehensiveDataContent: comprehensiveQuery.data ? {
        critical: (comprehensiveQuery.data as any)?.critical,
        secondary: (comprehensiveQuery.data as any)?.secondary,
        detailed: (comprehensiveQuery.data as any)?.detailed
      } : null,
      cachedComprehensiveDataContent: cachedComprehensiveData ? {
        critical: (cachedComprehensiveData as any)?.critical,
        secondary: (cachedComprehensiveData as any)?.secondary,
        detailed: (cachedComprehensiveData as any)?.detailed
      } : null,
      criticalQueryData: criticalQuery.data,
      secondaryQueryData: secondaryQuery.data,
      detailedQueryData: detailedQuery.data
    })

    // Use cached data from prefetch if available, otherwise fall back to query data
    const finalCriticalData = (cachedComprehensiveData as any)?.critical || (comprehensiveQuery.data as any)?.critical || criticalQuery.data || null
    const finalSecondaryData = (cachedComprehensiveData as any)?.secondary || (comprehensiveQuery.data as any)?.secondary || secondaryQuery.data || null
    const finalDetailedData = (cachedComprehensiveData as any)?.detailed || (comprehensiveQuery.data as any)?.detailed || detailedQuery.data || null

    console.log('Final data being returned:', {
      criticalData: finalCriticalData,
      secondaryData: finalSecondaryData,
      detailedData: finalDetailedData,
      source: cachedComprehensiveData ? 'cache' : comprehensiveQuery.data ? 'query' : 'fallback'
    })

    return {
      criticalData: finalCriticalData,
      secondaryData: finalSecondaryData,
      detailedData: finalDetailedData,
      isLoading: {
        critical: comprehensiveQuery.isLoading || criticalQuery.isLoading || cacheStatus.critical.loading,
        secondary: comprehensiveQuery.isLoading || secondaryQuery.isLoading || cacheStatus.secondary.loading,
        detailed: comprehensiveQuery.isLoading || detailedQuery.isLoading || cacheStatus.detailed.loading,
      },
      isError: {
        critical: comprehensiveQuery.isError && criticalQuery.isError,
        secondary: comprehensiveQuery.isError && secondaryQuery.isError,
        detailed: comprehensiveQuery.isError && detailedQuery.isError,
      },
      errors: {
        critical: comprehensiveQuery.error || criticalQuery.error,
        secondary: comprehensiveQuery.error || secondaryQuery.error,
        detailed: comprehensiveQuery.error || detailedQuery.error,
      },
      refetch: {
        critical: refetchCritical,
        secondary: refetchSecondary,
        detailed: refetchDetailed,
        all: refetchAll,
        comprehensive: comprehensiveQuery.refetch,
        // NEW: Add comprehensive refresh function that simulates logout/login
        comprehensiveRefresh: enhancedRefetchAll,
      },
      cacheStatus,
      // Include comprehensive data for components that can use it
      comprehensiveData: cachedComprehensiveData || comprehensiveQuery.data,
    }
  }, [
    comprehensiveQuery.data,
    comprehensiveQuery.isLoading,
    comprehensiveQuery.isError,
    comprehensiveQuery.error,
    comprehensiveQuery.refetch,
    criticalQuery.data,
    criticalQuery.isLoading,
    criticalQuery.isError,
    criticalQuery.error,
    secondaryQuery.data,
    secondaryQuery.isLoading,
    secondaryQuery.isError,
    secondaryQuery.error,
    detailedQuery.data,
    detailedQuery.isLoading,
    detailedQuery.isError,
    detailedQuery.error,
    refetchCritical,
    refetchSecondary,
    refetchDetailed,
    refetchAll,
    cacheStatus,
    cachedComprehensiveData,
    isCacheLoading
  ])

  return state
}