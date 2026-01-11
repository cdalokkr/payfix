// ============================================
// lib/trpc/routers/admin-dashboard-optimized.ts
// Performance-optimized admin dashboard router with API consolidation
// Using Drizzle ORM via OptimizedQueryManager
// ============================================
import { z } from 'zod'
import { router, adminProcedure, protectedProcedure, createContext } from '../server'
import { createOptimizedQueryManager, clearQueryCaches } from '@/lib/db/optimized-query-manager'
import { db } from '@/lib/db'

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
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes (aggressive caching for performance)

// Cache version mechanism
let cacheVersion = 0

// Static query manager instance
const queryManager = createOptimizedQueryManager()

// Cache invalidation function - exported for use by other modules
export function invalidateDashboardCache(pattern?: string): number {
  let invalidatedCount = 0

  // Increment cache version
  const previousVersion = cacheVersion
  cacheVersion++
  console.log(`[DASHBOARD-CACHE] Cache version incremented: ${previousVersion} -> ${cacheVersion}`)

  for (const [key] of requestCache.entries()) {
    if (!pattern || key.includes(pattern)) {
      requestCache.delete(key)
      invalidatedCount++
    }
  }

  // CRITICAL: Also clear the lower-level query cache in OptimizedQueryManager
  // This ensures fresh data is fetched from the database on the next request
  clearQueryCaches()
  console.log(`[DASHBOARD-CACHE] Cleared query caches for fresh data`)

  return invalidatedCount
}

// Clear all dashboard cache entries
export function clearAllDashboardCache(): void {
  requestCache.clear()
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
  if (totalTime > 500) { // Lowered to 500ms since we use Drizzle now
    console.warn(`[DASHBOARD-PERF] Slow endpoint ${metrics.endpoint}: ${totalTime.toFixed(2)}ms`, {
      totalTime,
      queries: metrics.totalQueriesExecuted,
      databaseTime: metrics.databaseTime,
      cacheHit: metrics.cacheHit
    })
  }

  return { ...metrics, totalTime }
}

export const adminDashboardRouter = router({
  // ULTRA-OPTIMIZED: Single endpoint that replaces all separate calls
  getUnifiedDashboardData: protectedProcedure
    .input(
      z.object({
        analyticsDays: z.number().default(7),
        activitiesLimit: z.number().default(10),
        enableCache: z.boolean().default(true),
        priority: z.enum(['speed', 'freshness']).default('speed'),
        localDate: z.string().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const metrics = startDashboardTiming('getUnifiedDashboardData')
      const cacheKey = `unified-dashboard-${ctx.user.id}-${input.analyticsDays}-${input.activitiesLimit}-${input.priority}-${input.localDate || 'no-date'}-v${cacheVersion}`

      try {
        // Check local request cache first
        if (input.enableCache && input.priority === 'speed') {
          const cachedData = requestCache.get(cacheKey)
          if (cachedData && Date.now() < cachedData.expiry) {
            metrics.cacheHit = true
            const timingMetrics = endDashboardTiming(metrics)
            return {
              ...cachedData.data as any,
              metadata: {
                ...(cachedData.data as any).metadata,
                performance: {
                  cacheHit: true,
                  totalTime: timingMetrics.totalTime
                }
              }
            }
          }
        }

        // Use OptimizedQueryManager (Drizzle-powered)
        const dbResult = await queryManager.getDashboardMetricsUnified({
          analyticsDays: input.analyticsDays,
          activitiesLimit: input.activitiesLimit,
          useCache: input.priority === 'speed' && input.enableCache,
          // Filter activities by profileId for non-admin users (moderators and employees)
          // Admin sees ALL activities, others see only their own
          profileId: ctx.profile.role !== 'admin' ? ctx.profile.id : undefined,
          localDate: input.localDate
        })

        const result = {
          ...dbResult,
          metadata: {
            consolidated: true,
            unified: true,
            fetchedAt: new Date().toISOString(),
            version: '4.0.0 (Drizzle)',
            priority: input.priority,
            performance: {
              cacheHit: false,
              totalTime: 0 // Will be updated by endDashboardTiming
            }
          }
        }

        const timingMetrics = endDashboardTiming(metrics)
        result.metadata.performance.totalTime = timingMetrics.totalTime

        // Cache the result locally
        if (input.enableCache) {
          requestCache.set(cacheKey, {
            data: result,
            expiry: Date.now() + CACHE_TTL,
            promise: Promise.resolve(result)
          })
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
      const data = await queryManager.getDashboardMetricsUnified({ useCache: true })
      const timing = endDashboardTiming(metrics)
      return {
        totalUsers: data.critical.totalUsers,
        activeUsers: data.critical.activeUsers,
        totalActivities: data.secondary.totalActivities,
        todayActivities: data.secondary.todayActivities,
        ...timing
      }
    } catch (error) {
      console.error('[DASHBOARD-PERF] getStats failed:', error)
      throw error
    }
  }),

  getRecentActivities: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const metrics = startDashboardTiming('getRecentActivities')
      try {
        const data = await queryManager.getActivitiesOptimized({ limit: input.limit })
        return {
          data: data.activities,
          ...endDashboardTiming(metrics)
        }
      } catch (error) {
        console.error('[DASHBOARD-PERF] getRecentActivities failed:', error)
        throw error
      }
    }),

  // Cache invalidation endpoint
  invalidateCache: protectedProcedure
    .input(
      z.object({
        pattern: z.string().optional(),
        reason: z.string().optional()
      }).optional()
    )
    .mutation(async ({ input }) => {
      const invalidatedCount = invalidateDashboardCache(input?.pattern)
      return {
        success: true,
        invalidatedCount,
        cacheVersion,
        timestamp: new Date().toISOString()
      }
    }),

  // Progressive loading endpoints
  getCriticalDashboardData: adminProcedure.query(async () => {
    const metrics = startDashboardTiming('getCriticalDashboardData')
    try {
      const data = await queryManager.getDashboardMetricsUnified({ useCache: true })
      return {
        totalUsers: data.critical.totalUsers,
        activeUsers: data.critical.activeUsers,
        ...endDashboardTiming(metrics)
      }
    } catch (error) {
      console.error('[DASHBOARD-PERF] getCriticalDashboardData failed:', error)
      throw error
    }
  }),

  getSecondaryDashboardData: adminProcedure
    .input(z.object({ analyticsDays: z.number().default(7) }))
    .query(async ({ input }) => {
      const metrics = startDashboardTiming('getSecondaryDashboardData')
      try {
        const data = await queryManager.getDashboardMetricsUnified({
          analyticsDays: input.analyticsDays,
          useCache: true
        })
        return {
          totalActivities: data.secondary.totalActivities,
          todayActivities: data.secondary.todayActivities,
          analytics: data.secondary.analytics,
          ...endDashboardTiming(metrics)
        }
      } catch (error) {
        console.error('[DASHBOARD-PERF] getSecondaryDashboardData failed:', error)
        throw error
      }
    }),

  getDetailedDashboardData: adminProcedure.query(async () => {
    const metrics = startDashboardTiming('getDetailedDashboardData')
    try {
      const data = await queryManager.getActivitiesOptimized({ limit: 50 })
      return {
        recentActivities: data.activities,
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
    cacheVersion
  }
}
