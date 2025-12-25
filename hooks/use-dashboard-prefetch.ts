'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import {
    isPrefetched,
    getPrefetchedData,
    markPrefetchStarted,
    markPrefetchCompleted,
    markPrefetchFailed,
    clearPrefetchStatus,
    getPrefetchPromise,
    MINIMUM_SKELETON_DISPLAY_TIME
} from '@/lib/prefetch-status'
import { DASHBOARD_QUERY_PARAMS, DASHBOARD_FRESH_PARAMS } from '@/lib/dashboard-config'

// ============================================
// DASHBOARD PREFETCH HOOK
// Centralized prefetching for dashboard data
// ============================================

/**
 * Dashboard data structure matching the unified endpoint response
 */
export interface UnifiedDashboardData {
    critical: {
        totalUsers: number
        activeUsers: number
        metadata: {
            tier: string
            fetchedAt: string
            cacheExpiry: number
        }
    }
    secondary: {
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
    detailed: {
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
    metadata: {
        consolidated: boolean
        unified: boolean
        fetchedAt: string
        version: string
        priority: 'speed' | 'freshness'
        performance: {
            totalQueries: number
            databaseTime: number
            cacheHit: boolean
            totalTime?: number
        }
    }
}

/**
 * Prefetch configuration options
 */
export interface PrefetchOptions {
    /** Maximum age in milliseconds before data is considered stale (default: 30000) */
    maxAge?: number
    /** Whether to force a fresh fetch even if cached data exists */
    forceFresh?: boolean
    /** Whether to block and wait for prefetch to complete */
    blocking?: boolean
}

/**
 * Return type for the useDashboardPrefetch hook
 */
export interface UseDashboardPrefetchReturn {
    /** Trigger a prefetch of dashboard data (non-blocking by default) */
    prefetch: (options?: PrefetchOptions) => Promise<void>
    /** Check if dashboard data has been prefetched and is still valid */
    isPrefetched: boolean
    /** Get the prefetched data if available */
    prefetchedData: UnifiedDashboardData | null
    /** Clear the prefetch status (useful after consuming the data) */
    clearPrefetch: () => void
    /** Whether a prefetch is currently in progress */
    isPrefetching: boolean
}

const PREFETCH_KEY = 'unified-dashboard-data'
const DEFAULT_MAX_AGE = 30000 // 30 seconds

/**
 * Centralized hook for dashboard data prefetching
 * 
 * Features:
 * - Non-blocking prefetch (fire and forget) by default
 * - Tracks prefetch status via prefetch-status.ts
 * - Integrates with tRPC utils for cache population
 * - Supports configurable TTL for staleness check
 * - Prevents duplicate prefetch requests
 * 
 * @example
 * ```tsx
 * // In a component that navigates to dashboard
 * const { prefetch } = useDashboardPrefetch()
 * 
 * const handleNavigate = () => {
 *   prefetch() // Fire and forget - doesn't block navigation
 *   router.push('/admin')
 * }
 * ```
 */
export function useDashboardPrefetch(): UseDashboardPrefetchReturn {
    const utils = trpc.useUtils()
    const isPrefetchingRef = useRef(false)

    // Memoize the status check - only check once on mount using lazy initialization
    const [prefetchedStatus, setPrefetchedStatus] = useState(() =>
        isPrefetched(PREFETCH_KEY, { maxAge: DEFAULT_MAX_AGE })
    )
    const [prefetchedData, setPrefetchedData] = useState<UnifiedDashboardData | null>(() =>
        getPrefetchedData<UnifiedDashboardData>(PREFETCH_KEY, { maxAge: DEFAULT_MAX_AGE })
    )

    // Update status after prefetch completes
    const updatePrefetchStatus = useCallback(() => {
        setPrefetchedStatus(isPrefetched(PREFETCH_KEY, { maxAge: DEFAULT_MAX_AGE }))
        setPrefetchedData(getPrefetchedData<UnifiedDashboardData>(PREFETCH_KEY, { maxAge: DEFAULT_MAX_AGE }))
    }, [])

    /**
     * Prefetch dashboard data
     * By default, this is non-blocking (fire and forget)
     */
    const prefetch = useCallback(async (options: PrefetchOptions = {}) => {
        const { maxAge = DEFAULT_MAX_AGE, forceFresh = false, blocking = false } = options

        // Check if we already have valid prefetched data (use current state first, then check fresh)
        if (!forceFresh && prefetchedStatus) {
            console.log('[DASHBOARD-PREFETCH] Data already prefetched and valid (from state), skipping')
            return
        }

        // Double-check with fresh status in case state is stale
        if (!forceFresh && isPrefetched(PREFETCH_KEY, { maxAge })) {
            console.log('[DASHBOARD-PREFETCH] Data already prefetched and valid (fresh check), skipping')
            updatePrefetchStatus()
            return
        }

        // Check if a prefetch is already in progress
        const existingPromise = getPrefetchPromise<UnifiedDashboardData>(PREFETCH_KEY)
        if (existingPromise) {
            console.log('[DASHBOARD-PREFETCH] Prefetch already in progress, waiting for existing promise')
            if (blocking) {
                await existingPromise
            }
            return
        }

        // Prevent concurrent prefetch attempts
        if (isPrefetchingRef.current) {
            console.log('[DASHBOARD-PREFETCH] Prefetch already in progress (ref check), skipping')
            return
        }

        isPrefetchingRef.current = true
        console.log('[DASHBOARD-PREFETCH] Starting dashboard data prefetch...')

        // Create the prefetch promise
        const prefetchPromise = (async () => {
            try {
                // Use shared config to ensure cache key consistency with useQuery
                // IMPORTANT: Use DASHBOARD_QUERY_PARAMS for normal prefetch to match useQuery cache key
                // Only use DASHBOARD_FRESH_PARAMS for manual refresh scenarios (forceFresh=true)
                const queryParams = forceFresh ? DASHBOARD_FRESH_PARAMS : DASHBOARD_QUERY_PARAMS

                // Use tRPC prefetch to populate the query cache
                // This makes the data available to useQuery hooks immediately
                await utils.admin.dashboard.getUnifiedDashboardData.prefetch(queryParams)

                // Get the data from the cache to store in prefetch status
                const cachedData = utils.admin.dashboard.getUnifiedDashboardData.getData(queryParams)

                if (cachedData) {
                    markPrefetchCompleted(PREFETCH_KEY, cachedData as unknown as UnifiedDashboardData)
                    console.log('[DASHBOARD-PREFETCH] ✅ Dashboard data prefetched successfully')
                    // Update the state after successful prefetch
                    updatePrefetchStatus()
                    return cachedData as unknown as UnifiedDashboardData
                } else {
                    throw new Error('Prefetch completed but no data in cache')
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                markPrefetchFailed(PREFETCH_KEY, errorMessage)
                console.warn('[DASHBOARD-PREFETCH] ⚠️ Dashboard prefetch failed:', errorMessage)
                throw error
            } finally {
                isPrefetchingRef.current = false
            }
        })()

        // Mark prefetch as started with the promise
        markPrefetchStarted(PREFETCH_KEY, prefetchPromise)

        // If blocking, wait for the prefetch to complete
        if (blocking) {
            await prefetchPromise
        }
    }, [utils, prefetchedStatus, updatePrefetchStatus])

    /**
     * Clear the prefetch status
     */
    const clearPrefetch = useCallback(() => {
        clearPrefetchStatus(PREFETCH_KEY)
        // Also reset the state
        setPrefetchedStatus(false)
        setPrefetchedData(null)
        console.log('[DASHBOARD-PREFETCH] Prefetch status cleared')
    }, [])

    return {
        prefetch,
        isPrefetched: prefetchedStatus,
        prefetchedData,
        clearPrefetch,
        isPrefetching: isPrefetchingRef.current
    }
}

/**
 * Hook to prefetch dashboard data on component mount
 * Useful for pages that will navigate to the dashboard
 * 
 * @example
 * ```tsx
 * // In a page that will navigate to dashboard
 * function UserManagementPage() {
 *   useDashboardPrefetchOnMount()
 *   // ... rest of component
 * }
 * ```
 */
export function useDashboardPrefetchOnMount(options: PrefetchOptions = {}): void {
    const { prefetch } = useDashboardPrefetch()

    useEffect(() => {
        // Small delay to not interfere with initial page render
        const timer = setTimeout(() => {
            prefetch(options)
        }, 100)

        return () => clearTimeout(timer)
    }, [prefetch, options])
}

/**
 * Hook to get the minimum skeleton display time
 * Ensures skeleton shows for at least 300ms to prevent flash
 * 
 * @returns Object with startTime ref and shouldShowSkeleton function
 */
export function useMinimumSkeletonTime() {
    const skeletonStartTimeRef = useRef<number | null>(null)

    const startSkeletonTimer = useCallback(() => {
        if (skeletonStartTimeRef.current === null) {
            skeletonStartTimeRef.current = Date.now()
        }
    }, [])

    const shouldShowSkeleton = useCallback((isLoading: boolean): boolean => {
        if (!isLoading) {
            // Check if minimum time has passed
            if (skeletonStartTimeRef.current !== null) {
                const elapsed = Date.now() - skeletonStartTimeRef.current
                if (elapsed < MINIMUM_SKELETON_DISPLAY_TIME) {
                    return true // Keep showing skeleton until minimum time passes
                }
                // Reset for next loading cycle
                skeletonStartTimeRef.current = null
            }
            return false
        }

        // Start timer when loading begins
        startSkeletonTimer()
        return true
    }, [startSkeletonTimer])

    const resetSkeletonTimer = useCallback(() => {
        skeletonStartTimeRef.current = null
    }, [])

    return {
        startSkeletonTimer,
        shouldShowSkeleton,
        resetSkeletonTimer,
        skeletonStartTime: skeletonStartTimeRef.current
    }
}

export default useDashboardPrefetch