// ============================================
// lib/trpc/routers/admin-dashboard-optimized.ts
// Performance-optimized admin dashboard router with API consolidation
// Using Drizzle ORM via OptimizedQueryManager
// ============================================
import { z } from 'zod'
import { router, adminProcedure, protectedProcedure, createContext } from '../server'
import { createOptimizedQueryManager, clearQueryCaches } from '@/lib/db/optimized-query-manager'
import { db } from '@/lib/db'
import { tenantStorage } from '@/lib/tenant/store'

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
const CACHE_TTL = 60 * 1000 // Keep dashboard cache short; auth and realtime own freshness.

// Cache version mechanism
let cacheVersion = 0

// Static query manager instance
const queryManager = createOptimizedQueryManager()

// Cache invalidation function - exported for use by other modules
export function invalidateDashboardCache(pattern?: string, tenantKey = tenantStorage.getStore()?.tenantSchema): number {
  if (!tenantKey) {
    console.warn('[DASHBOARD-CACHE] Refusing unscoped cache invalidation')
    return 0
  }

  let invalidatedCount = 0

  // Increment cache version
  const previousVersion = cacheVersion
  cacheVersion++
  console.log(`[DASHBOARD-CACHE] Cache version incremented: ${previousVersion} -> ${cacheVersion}`)

  for (const [key] of requestCache.entries()) {
    const belongsToTenant = key.includes(`-${tenantKey}-`)
    if (belongsToTenant && (!pattern || key.includes(pattern))) {
      requestCache.delete(key)
      invalidatedCount++
    }
  }

  // CRITICAL: Also clear the lower-level query cache in OptimizedQueryManager
  // This ensures fresh data is fetched from the database on the next request
  clearQueryCaches(tenantKey ?? undefined)
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
        analyticsDays: z.number().int().min(1).max(90).default(7),
        activitiesLimit: z.number().int().min(1).max(50).default(10),
        enableCache: z.boolean().default(true),
        priority: z.enum(['speed', 'freshness']).default('speed'),
        localDate: z.string().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const metrics = startDashboardTiming('getUnifiedDashboardData')
      const tenantKey = ctx.tenant?.tenantSchema || 'default'
      const cacheKey = `unified-dashboard-${tenantKey}-${ctx.user.id}-${input.analyticsDays}-${input.activitiesLimit}-${input.priority}-${input.localDate || 'no-date'}-v${cacheVersion}`

      try {
        // Check local request cache first (including concurrent in-progress promises)
        if (input.enableCache && input.priority === 'speed') {
          const cached = requestCache.get(cacheKey)
          if (cached && (cached.data === null || Date.now() < cached.expiry)) {
            metrics.cacheHit = true
            
            // Wait for in-progress promise or reuse cached data
            const dbResult = await cached.promise
            
            const timingMetrics = endDashboardTiming(metrics)
            
            // Map the resolved result with updated cache-hit metrics
            return {
              ...dbResult as any,
              metadata: {
                ...(dbResult as any).metadata,
                performance: {
                  cacheHit: true,
                  totalTime: timingMetrics.totalTime
                }
              }
            }
          }
        }

        // Use a deferred promise pattern to deduplicate concurrent requests
        const queryPromise = (async () => {
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

          return {
            ...dbResult,
            metadata: {
              consolidated: true,
              unified: true,
              fetchedAt: new Date().toISOString(),
              version: '4.0.0 (Drizzle)',
              priority: input.priority,
              performance: {
                cacheHit: false,
                totalTime: 0 // Will be updated by resolver
              }
            }
          }
        })()

        // Cache the promise immediately so concurrent requests hit the in-progress promise
        if (input.enableCache) {
          requestCache.set(cacheKey, {
            data: null,
            expiry: Date.now() + CACHE_TTL,
            promise: queryPromise
          })
        }

        const result = await queryPromise
        const timingMetrics = endDashboardTiming(metrics)
        result.metadata.performance.totalTime = timingMetrics.totalTime

        // Update cache entry with the resolved data
        if (input.enableCache) {
          requestCache.set(cacheKey, {
            data: result,
            expiry: Date.now() + CACHE_TTL,
            promise: Promise.resolve(result)
          })
        }

        return result

      } catch (error) {
        // Never retain a rejected query promise. A transient database/schema
        // failure would otherwise poison this user's dashboard cache for the
        // lifetime of the warm server process, making Retry fail repeatedly
        // even after the underlying issue has been repaired.
        requestCache.delete(cacheKey)
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
    .input(z.object({
       limit: z.number().int().min(1).max(50).default(10),
      userId: z.string().optional() // Filter activities by user ID (for employee/moderator dashboards)
    }))
    .query(async ({ ctx, input }) => {
      const metrics = startDashboardTiming('getRecentActivities')
      try {
        // If userId is provided, filter by that user
        // If not provided AND user is admin, show all activities
        // If not provided AND user is NOT admin, show only their own activities
        const effectiveUserId = input.userId ?? (ctx.profile.role !== 'admin' ? ctx.profile.id : undefined)

        const data = await queryManager.getActivitiesOptimized({
          limit: input.limit,
          userId: effectiveUserId
        })
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
        pattern: z.string().max(100).optional(),
        reason: z.string().max(200).optional()
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const tenantKey = ctx.tenant?.tenantSchema
      const invalidatedCount = invalidateDashboardCache(input?.pattern, tenantKey)
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
