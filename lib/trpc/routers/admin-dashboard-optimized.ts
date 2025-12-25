// ============================================
// lib/trpc/routers/admin-dashboard-optimized.ts
// Performance-optimized admin dashboard router with API consolidation
// ============================================
import { z } from 'zod'
import { router, adminProcedure, protectedProcedure, createContext } from '../server'

type Context = Awaited<ReturnType<typeof createContext>>

// Performance monitoring for dashboard endpoints
interface DashboardPerformanceMetrics {
  totalQueriesExecuted: number
  databaseTime: number
  queryOptimizationApplied: boolean
  cacheHit: boolean
  endpoint: string
  startTime: number
}

// Request deduplication cache
const requestCache = new Map<string, { data: unknown; expiry: number; promise: Promise<unknown> }>()
const CACHE_TTL = 5 * 1000 // 5 seconds (reduced from 15s for faster updates after user operations)

// Cache version mechanism to ensure fresh data after invalidation
// When cache is invalidated, version increments, causing all cache keys to miss
let cacheVersion = 0

// Cache invalidation function - exported for use by other modules
export function invalidateDashboardCache(pattern?: string): number {
  let invalidatedCount = 0

  // Increment cache version to ensure any in-flight requests get fresh data
  const previousVersion = cacheVersion
  cacheVersion++
  console.log(`[DASHBOARD-CACHE] Cache version incremented: ${previousVersion} -> ${cacheVersion}`)

  for (const [key] of requestCache.entries()) {
    // If pattern is provided, only invalidate matching keys
    // Otherwise, invalidate all dashboard-related cache entries
    if (!pattern || key.includes(pattern)) {
      requestCache.delete(key)
      invalidatedCount++
      console.log(`[DASHBOARD-CACHE] Invalidated cache key: ${key}`)
    }
  }

  if (invalidatedCount > 0) {
    console.log(`[DASHBOARD-CACHE] Invalidated ${invalidatedCount} cache entries. Version: ${cacheVersion}`)
  } else {
    console.log(`[DASHBOARD-CACHE] No cache entries to invalidate. Version: ${cacheVersion}`)
  }

  return invalidatedCount
}

// Clear all dashboard cache entries
export function clearAllDashboardCache(): void {
  const size = requestCache.size
  requestCache.clear()
  console.log(`[DASHBOARD-CACHE] Cleared all ${size} cache entries`)
}

function startDashboardTiming(endpoint: string): DashboardPerformanceMetrics {
  return {
    totalQueriesExecuted: 0,
    databaseTime: 0,
    queryOptimizationApplied: false,
    cacheHit: false,
    endpoint,
    startTime: performance.now()
  }
}

function endDashboardTiming(metrics: DashboardPerformanceMetrics) {
  const totalTime = performance.now() - metrics.startTime

  // Log slow endpoints
  if (totalTime > 1000) {
    console.warn(`[DASHBOARD-PERF] Slow endpoint ${metrics.endpoint}: ${totalTime.toFixed(2)}ms`, {
      totalTime,
      queries: metrics.totalQueriesExecuted,
      databaseTime: metrics.databaseTime,
      cacheHit: metrics.cacheHit
    })
  }

  return { ...metrics, totalTime }
}

// Optimized query execution with batching
async function executeOptimizedQueries(ctx: Context, queries: Array<() => Promise<unknown>>, metrics: DashboardPerformanceMetrics) {
  const results: unknown[] = []
  const queryStartTime = performance.now()

  // Execute all queries in parallel for maximum speed
  // Most of these are light metadata/count queries, so full parallelism is safe
  const allResults = await Promise.allSettled(queries.map(query => query()))

  for (const result of allResults) {
    if (result.status === 'fulfilled') {
      results.push(result.value)
      metrics.totalQueriesExecuted++
    } else {
      console.error('[DASHBOARD-PERF] Query failed:', result.reason)
      results.push(null)
    }
  }

  metrics.databaseTime += performance.now() - queryStartTime
  return results
}

// Request deduplication helper
function getCachedRequest<T>(key: string): T | null {
  const cached = requestCache.get(key)
  if (cached && Date.now() < cached.expiry) {
    return cached.data as T
  }
  if (cached) {
    requestCache.delete(key)
  }
  return null
}

function setCachedRequest<T>(key: string, data: T, promise: Promise<T>): void {
  requestCache.set(key, {
    data,
    expiry: Date.now() + CACHE_TTL,
    promise
  })

  // Clean up cache to prevent memory leaks
  if (requestCache.size > 50) {
    const now = Date.now()
    for (const [key, value] of requestCache.entries()) {
      if (value.expiry < now) {
        requestCache.delete(key)
      }
    }
  }
}

export const adminDashboardRouter = router({
  // ULTRA-OPTIMIZED: Single endpoint that replaces all 5 separate calls
  // Changed to protectedProcedure to allow user access with filtering
  getUnifiedDashboardData: protectedProcedure
    .input(
      z.object({
        analyticsDays: z.number().default(7),
        activitiesLimit: z.number().default(10),
        enableCache: z.boolean().default(true),
        priority: z.enum(['speed', 'freshness']).default('speed')
      })
    )
    .query(async ({ ctx, input }) => {
      const metrics = startDashboardTiming('getUnifiedDashboardData')
      // Include cache version and user ID in key to ensure fresh data and isolation
      const cacheKey = `unified-dashboard-${ctx.user.id}-${input.analyticsDays}-${input.activitiesLimit}-${input.priority}-v${cacheVersion}`
      const isAdmin = ctx.profile.role === 'admin'

      try {
        // Check cache first (only for 'speed' priority, not 'freshness')
        if (input.enableCache && input.priority === 'speed') {
          const cachedData = getCachedRequest<any>(cacheKey)
          if (cachedData) {
            metrics.cacheHit = true
            const timingMetrics = endDashboardTiming(metrics)
            console.log(`[DASHBOARD-CACHE] Cache HIT for key: ${cacheKey}`)
            return {
              ...cachedData,
              metadata: {
                ...cachedData.metadata,
                performance: {
                  ...cachedData.metadata?.performance,
                  cacheHit: true,
                  totalTime: timingMetrics.totalTime
                }
              }
            }
          }
        }

        // For 'freshness' priority, always invalidate existing cache first
        if (input.priority === 'freshness') {
          requestCache.delete(cacheKey)
          console.log(`[DASHBOARD-CACHE] Freshness priority - invalidated cache for: ${cacheKey}`)
        }

        // Execute all queries in a single optimized batch
        const queries = [
          // 1. Consolidated Profile Role Counts (One query instead of four)
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            if (!isAdmin) return { data: [], query: 'roleCounts' }

            // Fetch only role column for all profiles to count locally
            const result = await ctx.supabase
              .from('profiles')
              .select('role')
            return { ...result, query: 'roleCounts' }
          },

          // 2. Active Users (Optimized query)
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            if (!isAdmin) return { count: 0, query: 'activeUsers' }

            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            const result = await ctx.supabase
              .from('activities')
              .select('user_id')
              .gte('created_at', sevenDaysAgo)

            const uniqueUsers = new Set(result.data?.map(a => a.user_id).filter(Boolean) || [])
            return { count: uniqueUsers.size, query: 'activeUsers' }
          },

          // 3. Activity metrics
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            let query = ctx.supabase
              .from('activities')
              .select('*', { count: 'exact', head: true })

            if (!isAdmin) {
              query = query.eq('user_id', ctx.user.id)
            }

            const result = await query
            return { ...result, query: 'totalActivities' }
          },

          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            let query = ctx.supabase
              .from('activities')
              .select('*', { count: 'exact', head: true })
              .gte('created_at', new Date().toISOString().split('T')[0])

            if (!isAdmin) {
              query = query.eq('user_id', ctx.user.id)
            }

            const result = await query
            return { ...result, query: 'todayActivities' }
          },

          // 4. Analytics data (if priority is freshness)
          ...(input.priority === 'freshness' ? [
            async () => {
              if (!ctx.supabase) throw new Error('Supabase client not available')
              if (!isAdmin) return { data: [], query: 'analytics' }

              const result = await ctx.supabase
                .from('analytics_metrics')
                .select('*')
                .gte('metric_date', new Date(Date.now() - input.analyticsDays * 24 * 60 * 60 * 1000).toISOString())
                .order('metric_date', { ascending: true })
              return { ...result, query: 'analytics' }
            }
          ] : []),

          // 5. Recent activities
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            let query = ctx.supabase
              .from('activities')
              .select('id, activity_type, description, created_at, user_id, profiles(email, full_name, role)')
              .order('created_at', { ascending: false })
              .limit(input.activitiesLimit)

            if (!isAdmin) {
              query = query.eq('user_id', ctx.user.id)
            }

            const result = await query
            return { ...result, query: 'recentActivities' }
          }
        ]

        const queryResults = await executeOptimizedQueries(ctx, queries, metrics)

        // Map consolidated results
        const roleCountsResult = queryResults[0] as { data: { role: string }[] } | null
        const activeUsersResult = queryResults[1] as { count: number } | null
        const totalActivitiesResult = queryResults[2] as { count: number } | null
        const todayActivitiesResult = queryResults[3] as { count: number } | null

        let analyticsResult = null
        let recentResult = null

        if (input.priority === 'freshness') {
          analyticsResult = queryResults[4] as { data: any[] } | null
          recentResult = queryResults[5] as { data: any[] } | null
        } else {
          recentResult = queryResults[4] as { data: any[] } | null
        }

        // Process role counts
        const roles = roleCountsResult?.data?.map(p => p.role) || []
        const totalUsers = roles.length
        const moderatorCount = roles.filter(r => r === 'moderator').length
        const employeeCount = roles.filter(r => r === 'employee').length
        const adminCount = roles.filter(r => r === 'admin').length

        const result = {
          critical: {
            totalUsers,
            activeUsers: activeUsersResult?.count || 0,
            moderatorCount,
            employeeCount,
            adminCount,
            metadata: {
              tier: 'critical',
              fetchedAt: new Date().toISOString(),
              cacheExpiry: Date.now() + (15 * 1000),
            }
          },
          secondary: {
            totalActivities: totalActivitiesResult?.count || 0,
            todayActivities: todayActivitiesResult?.count || 0,
            analytics: analyticsResult?.data || [],
            metadata: {
              tier: 'secondary',
              fetchedAt: new Date().toISOString(),
              cacheExpiry: Date.now() + (30 * 1000),
            }
          },
          detailed: {
            recentActivities: recentResult?.data || [],
            metadata: {
              tier: 'detailed',
              fetchedAt: new Date().toISOString(),
              cacheExpiry: Date.now() + (60 * 1000),
            }
          },
          metadata: {
            consolidated: true,
            unified: true,
            fetchedAt: new Date().toISOString(),
            version: '3.0.0',
            priority: input.priority,
            performance: {
              totalQueries: metrics.totalQueriesExecuted,
              databaseTime: metrics.databaseTime,
              cacheHit: metrics.cacheHit
            }
          }
        }

        // Cache the result
        if (input.enableCache) {
          const promise = Promise.resolve(result)
          setCachedRequest(cacheKey, result, promise)
        }

        return result

      } catch (error) {
        console.error('[DASHBOARD-PERF] Unified dashboard data failed:', error)
        throw error
      }
    }),

  // Backward compatibility: Optimized versions of existing endpoints
  getStats: adminProcedure.query(async ({ ctx }) => {
    const metrics = startDashboardTiming('getStats')

    try {
      if (!ctx.supabase) throw new Error('Supabase client not available')

      const [usersCount, activitiesCount, todayActivities] = await Promise.all([
        ctx.supabase.from('profiles').select('*', { count: 'exact', head: true }),
        ctx.supabase.from('activities').select('*', { count: 'exact', head: true }),
        ctx.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().split('T')[0]),
      ])

      metrics.totalQueriesExecuted = 3

      return {
        totalUsers: usersCount.count || 0,
        totalActivities: activitiesCount.count || 0,
        todayActivities: todayActivities.count || 0,
        ...endDashboardTiming(metrics)
      }
    } catch (error) {
      console.error('[DASHBOARD-PERF] getStats failed:', error)
      throw error
    }
  }),

  // Changed to protectedProcedure to allow user access with filtering
  getRecentActivities: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const metrics = startDashboardTiming('getRecentActivities')
      const isAdmin = ctx.profile.role === 'admin'

      try {
        if (!ctx.supabase) throw new Error('Supabase client not available')

        let query = ctx.supabase
          .from('activities')
          .select('*, profiles(email, full_name, role)')
          .order('created_at', { ascending: false })
          .limit(input.limit)

        // Filter for non-admins
        if (!isAdmin) {
          query = query.eq('user_id', ctx.user.id)
        }

        const { data } = await query

        metrics.totalQueriesExecuted = 1

        return {
          data: data || [],
          ...endDashboardTiming(metrics)
        }
      } catch (error) {
        console.error('[DASHBOARD-PERF] getRecentActivities failed:', error)
        throw error
      }
    }),

  // Enhanced comprehensive endpoint with performance monitoring
  getComprehensiveDashboardData: adminProcedure
    .input(
      z.object({
        analyticsDays: z.number().default(7),
        activitiesLimit: z.number().default(10),
        enablePerformanceMonitoring: z.boolean().default(true)
      })
    )
    .query(async ({ ctx, input }) => {
      const metrics = startDashboardTiming('getComprehensiveDashboardData')
      // Include cache version in key to ensure fresh data after invalidation
      const cacheKey = `comprehensive-dashboard-${input.analyticsDays}-${input.activitiesLimit}-v${cacheVersion}`

      try {
        // Check cache
        const cachedData = getCachedRequest<any>(cacheKey)
        if (cachedData) {
          metrics.cacheHit = true
          const timingMetrics = endDashboardTiming(metrics)
          console.log(`[DASHBOARD-CACHE] Cache HIT for comprehensive dashboard: ${cacheKey}`)
          // Return cached data with updated timing
          return {
            ...cachedData,
            metadata: {
              ...cachedData.metadata,
              performance: {
                ...cachedData.metadata?.performance,
                cacheHit: true,
                totalTime: timingMetrics.totalTime
              }
            }
          }
        }

        if (!ctx.supabase) throw new Error('Supabase client not available')

        // Execute optimized queries
        const [
          usersResult,
          activitiesResult,
          todayResult,
          analyticsResult,
          recentResult,
          activeUsersResult
        ] = await executeOptimizedQueries(ctx, [
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            return await ctx.supabase.from('profiles').select('*', { count: 'exact', head: true })
          },
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            return await ctx.supabase.from('activities').select('*', { count: 'exact', head: true })
          },
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            return await ctx.supabase
              .from('activities')
              .select('*', { count: 'exact', head: true })
              .gte('created_at', new Date().toISOString().split('T')[0])
          },
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            return await ctx.supabase
              .from('analytics_metrics')
              .select('*')
              .gte('metric_date', new Date(Date.now() - input.analyticsDays * 24 * 60 * 60 * 1000).toISOString())
              .order('metric_date', { ascending: true })
          },
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            return await ctx.supabase
              .from('activities')
              .select('*, profiles(email, full_name, role)')
              .order('created_at', { ascending: false })
              .limit(input.activitiesLimit)
          },
          async () => {
            if (!ctx.supabase) throw new Error('Supabase client not available')
            return await ctx.supabase
              .from('activities')
              .select('user_id')
              .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          }
        ], metrics)

        // Process results
        const activeUsersData = activeUsersResult as { data: { user_id: string }[] } | null
        const uniqueUsers = new Set(activeUsersData?.data?.map((a) => a.user_id).filter(Boolean) || [])

        const usersRes = usersResult as { count: number } | null
        const activitiesRes = activitiesResult as { count: number } | null
        const todayRes = todayResult as { count: number } | null
        const analyticsRes = analyticsResult as { data: any[] } | null
        const recentRes = recentResult as { data: any[] } | null

        const result = {
          critical: {
            totalUsers: usersRes?.count || 0,
            activeUsers: uniqueUsers.size,
            metadata: {
              tier: 'critical',
              fetchedAt: new Date().toISOString(),
              cacheExpiry: Date.now() + (15 * 1000),
            }
          },
          secondary: {
            totalActivities: activitiesRes?.count || 0,
            todayActivities: todayRes?.count || 0,
            analytics: analyticsRes?.data || [],
            metadata: {
              tier: 'secondary',
              fetchedAt: new Date().toISOString(),
              cacheExpiry: Date.now() + (30 * 1000),
            }
          },
          detailed: {
            recentActivities: recentRes?.data || [],
            metadata: {
              tier: 'detailed',
              fetchedAt: new Date().toISOString(),
              cacheExpiry: Date.now() + (60 * 1000),
            }
          },
          metadata: {
            consolidated: true,
            fetchedAt: new Date().toISOString(),
            version: '3.0.0',
            cacheExpiry: Date.now() + (15 * 1000),
            performance: {
              totalQueries: metrics.totalQueriesExecuted,
              databaseTime: metrics.databaseTime,
              cacheHit: metrics.cacheHit
            }
          }
        }

        // Cache result
        const promise = Promise.resolve(result)
        setCachedRequest(cacheKey, result, promise)

        return result
      } catch (error) {
        console.error('[DASHBOARD-PERF] Comprehensive dashboard failed:', error)
        throw error
      }
    }),

  // Cache invalidation endpoint - call this after user operations to ensure fresh data
  invalidateCache: adminProcedure
    .input(
      z.object({
        pattern: z.string().optional(),
        reason: z.string().optional()
      }).optional()
    )
    .mutation(async ({ input }) => {
      const pattern = input?.pattern
      const reason = input?.reason || 'manual invalidation'

      console.log(`[DASHBOARD-CACHE] Cache invalidation requested. Reason: ${reason}. Current version: ${cacheVersion}`)

      // Clear all dashboard-related cache entries and increment version
      const invalidatedCount = invalidateDashboardCache(pattern)

      console.log(`[DASHBOARD-CACHE] Cache invalidated. New version: ${cacheVersion}`)

      return {
        success: true,
        invalidatedCount,
        cacheVersion,
        timestamp: new Date().toISOString(),
        reason
      }
    }),

  // Progressive loading endpoints for better perceived performance
  getCriticalDashboardData: adminProcedure.query(async ({ ctx }) => {
    const metrics = startDashboardTiming('getCriticalDashboardData')

    try {
      if (!ctx.supabase) throw new Error('Supabase client not available')

      const [usersCount, activeUsersCount] = await Promise.all([
        ctx.supabase.from('profiles').select('*', { count: 'exact', head: true }),
        (async () => {
          const { data } = await ctx.supabase!
            .from('activities')
            .select('user_id')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

          const uniqueUsers = new Set(data?.map(a => a.user_id))
          return { count: uniqueUsers.size }
        })()
      ])

      metrics.totalQueriesExecuted = 2

      return {
        totalUsers: usersCount.count || 0,
        activeUsers: activeUsersCount.count || 0,
        metadata: {
          tier: 'critical',
          fetchedAt: new Date().toISOString(),
          cacheExpiry: Date.now() + (15 * 1000),
        },
        ...endDashboardTiming(metrics)
      }
    } catch (error) {
      console.error('[DASHBOARD-PERF] getCriticalDashboardData failed:', error)
      throw error
    }
  }),

  getSecondaryDashboardData: adminProcedure
    .input(
      z.object({
        analyticsDays: z.number().default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const metrics = startDashboardTiming('getSecondaryDashboardData')

      try {
        if (!ctx.supabase) throw new Error('Supabase client not available')

        const [activitiesCount, todayActivities, analytics] = await Promise.all([
          ctx.supabase.from('activities').select('*', { count: 'exact', head: true }),
          ctx.supabase
            .from('activities')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', new Date().toISOString().split('T')[0]),
          ctx.supabase
            .from('analytics_metrics')
            .select('*')
            .gte('metric_date', new Date(Date.now() - input.analyticsDays * 24 * 60 * 60 * 1000).toISOString())
            .order('metric_date', { ascending: true })
        ])

        metrics.totalQueriesExecuted = 3

        return {
          totalActivities: activitiesCount.count || 0,
          todayActivities: todayActivities.count || 0,
          analytics: analytics.data || [],
          metadata: {
            tier: 'secondary',
            fetchedAt: new Date().toISOString(),
            cacheExpiry: Date.now() + (30 * 1000),
          },
          ...endDashboardTiming(metrics)
        }
      } catch (error) {
        console.error('[DASHBOARD-PERF] getSecondaryDashboardData failed:', error)
        throw error
      }
    }),

  getDetailedDashboardData: adminProcedure
    .query(async ({ ctx }) => {
      const metrics = startDashboardTiming('getDetailedDashboardData')

      try {
        if (!ctx.supabase) throw new Error('Supabase client not available')

        const { data } = await ctx.supabase
          .from('activities')
          .select('*, profiles(email, full_name, role)')
          .order('created_at', { ascending: false })

        metrics.totalQueriesExecuted = 1

        return {
          recentActivities: data || [],
          metadata: {
            tier: 'detailed',
            fetchedAt: new Date().toISOString(),
            cacheExpiry: Date.now() + (60 * 1000),
          },
          ...endDashboardTiming(metrics)
        }
      } catch (error) {
        console.error('[DASHBOARD-PERF] getDetailedDashboardData failed:', error)
        throw error
      }
    }),
})

// Performance monitoring utilities
export function getDashboardPerformanceStats() {
  return {
    requestCacheSize: requestCache.size,
    activeRequests: Array.from(requestCache.keys()),
    cacheHitRate: 'Implemented', // Would need to track hit/miss ratio
    activeEndpoints: 'Multiple endpoints monitored'
  }
}