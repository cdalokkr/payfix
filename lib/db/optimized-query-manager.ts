// ============================================
// lib/db/optimized-query-manager.ts
// Performance-optimized database query manager with N+1 elimination
// Using Drizzle ORM for maximum performance
// ============================================
import { db } from '@/lib/db'
import { profiles, activities, analyticsMetrics, designations, attendance, officeSettings, officeClosures } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, or, ilike, count } from 'drizzle-orm'

// Performance monitoring for database queries
interface DatabaseMetrics {
  queryType: string
  executionTime: number
  rowCount: number
  cacheHit: boolean
  indexUsed: boolean
  timestamp: number
  hash?: string
}

// Query cache for frequently accessed data
interface QueryCache {
  data: any
  timestamp: number
  ttl: number
  queryHash: string
}

// Global query cache
const queryCache = new Map<string, QueryCache>()
const CACHE_TTL_DEFAULT = 30 * 1000 // 30 seconds
const MAX_CACHE_SIZE = 100

// Query metrics collection
const queryMetrics: DatabaseMetrics[] = []
const MAX_METRICS_ENTRIES = 1000

// Performance monitoring
function startQueryTiming(queryType: string): number {
  return performance.now()
}

function recordQueryMetrics(metrics: Omit<DatabaseMetrics, 'timestamp'>) {
  const entry: DatabaseMetrics = {
    ...metrics,
    timestamp: Date.now()
  }

  queryMetrics.push(entry)
  if (queryMetrics.length > MAX_METRICS_ENTRIES) {
    queryMetrics.shift()
  }

  // Log slow queries
  if (metrics.executionTime > 500) { // Lowered to 500ms for Drizzle
    console.warn(`[DB-PERF] Slow query ${metrics.queryType}: ${metrics.executionTime.toFixed(2)}ms`, {
      executionTime: metrics.executionTime,
      rowCount: metrics.rowCount,
      cacheHit: metrics.cacheHit,
      indexUsed: metrics.indexUsed,
      hash: metrics.hash
    })
  }
}

// Query hashing for caching
function hashQuery(query: string, params: any = {}): string {
  const queryString = JSON.stringify({ query, params })
  return Buffer.from(queryString).toString('base64')
}

// Cache management
function getCachedQuery<T>(queryHash: string): T | null {
  const cached = queryCache.get(queryHash)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }
  if (cached) {
    queryCache.delete(queryHash)
  }
  return null
}

function setCachedQuery<T>(queryHash: string, data: T, ttl: number = CACHE_TTL_DEFAULT): void {
  queryCache.set(queryHash, {
    data,
    timestamp: Date.now(),
    ttl,
    queryHash
  })

  // Clean up cache to prevent memory leaks
  if (queryCache.size > MAX_CACHE_SIZE) {
    const now = Date.now()
    const entries = Array.from(queryCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp

    for (let i = 0; i < entries.length - MAX_CACHE_SIZE; i++) {
      queryCache.delete(entries[i][0])
    }
  }
}

// Optimized query execution manager
export class OptimizedQueryManager {
  /**
   * Warm up the database connection pool by executing a simple query.
   * Call this during login to pre-establish connections before dashboard data is needed.
   * This reduces cold start latency on the first dashboard load.
   */
  async warmupConnection(): Promise<void> {
    const startTime = performance.now()
    try {
      // Execute a minimal query to establish connection
      await db.execute(sql`SELECT 1`)
      const duration = performance.now() - startTime
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DB-PERF] Connection warmup: ${duration.toFixed(2)}ms`)
      }
    } catch (error) {
      console.warn('[DB-PERF] Connection warmup failed (non-critical):', error)
    }
  }

  // BATCH QUERY 1: Get all dashboard metrics in a single optimized execution
  async getDashboardMetricsUnified(options: {
    analyticsDays?: number
    activitiesLimit?: number
    useCache?: boolean
    profileId?: string
    localDate?: string
    priority?: 'speed' | 'freshness'
  } = {}): Promise<{
    critical: {
      totalUsers: number;
      activeUsers: number;
      employeeCount: number;
      moderatorCount: number;
      adminCount: number;
    }
    secondary: { totalActivities: number; todayActivities: number; analytics: any[] }
    detailed: { recentActivities: any[] }
    attendance?: {
      todayRecord: any
      pendingRecord: any
      settings: any
      closures: any
    }
  }> {
    const startTime = startQueryTiming('getDashboardMetricsUnified')
    const { analyticsDays = 7, activitiesLimit = 10, useCache = true, profileId, localDate, priority = 'speed' } = options
    const queryHash = hashQuery('dashboard_metrics_unified', { analyticsDays, activitiesLimit, profileId, localDate, priority })

    type DashboardMetricsResult = {
      critical: {
        totalUsers: number;
        activeUsers: number;
        employeeCount: number;
        moderatorCount: number;
        adminCount: number;
      }
      secondary: { totalActivities: number; todayActivities: number; analytics: any[] }
      detailed: { recentActivities: any[] }
      attendance?: {
        todayRecord: any
        pendingRecord: any
        settings: any
        closures: any
      }
    }

    try {
      // Check cache first
      const shouldUseCache = useCache;
      if (shouldUseCache) {
        const cached = getCachedQuery<DashboardMetricsResult>(queryHash)
        if (cached) {
          // For employee dashboards: merge cached global data with FRESH attendance
          if (profileId) {
            // Fetch only fresh attendance data
            const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
            const [attendanceData, settingsData, closuresData] = await Promise.all([
              (async () => {
                const [year, month, day] = (localDate || new Date().toISOString().split('T')[0]).split('-').map(Number);
                const yesterday = new Date(year, month - 1, day - 1);
                const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                return db.select().from(attendance)
                  .where(and(
                    eq(attendance.profile_id, profileId!),
                    gte(attendance.date, yesterdayStr)
                  ));
              })(),
              db.select().from(officeSettings).limit(1),
              db.select().from(officeClosures).where(gte(officeClosures.date, sql`CURRENT_DATE`))
            ])

            // Merge cached data with fresh attendance
            const serverLocalDate = (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            const targetDate = localDate || serverLocalDate;
            const normalizeDate = (d: any): string => {
              if (!d) return '';
              if (d instanceof Date) {
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              }
              const str = String(d);
              return str.split('T')[0];
            };
            const records = attendanceData as any[];

            return {
              ...cached,
              attendance: {
                todayRecord: records.find(r => normalizeDate(r.date) === targetDate) || null,
                pendingRecord: records.filter(r => !r.check_out).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null,
                settings: (settingsData as any[])[0] || null,
                closures: (closuresData as any[]) || []
              }
            }
          }

          // Admin dashboard - return full cached result
          recordQueryMetrics({
            queryType: 'getDashboardMetricsUnified',
            executionTime: performance.now() - startTime,
            rowCount: 0,
            cacheHit: true,
            indexUsed: true
          })
          return cached
        }
      }

      const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const analyticsDaysAgo = new Date(Date.now() - analyticsDays * 24 * 60 * 60 * 1000)

      // OPTIMIZED: Combined stats query - SKIP for specific profile requests (employees)
      // because they don't see these global metrics in their dashboard
      const shouldFetchGlobalStats = !profileId

      const combinedStatsQuery = shouldFetchGlobalStats
        ? db.execute(sql`
            SELECT 
              (SELECT count(*) FROM profiles WHERE role = 'employee'::user_role) as employee_count,
              (SELECT count(*) FROM profiles WHERE role = 'moderator'::user_role) as moderator_count,
              (SELECT count(*) FROM profiles WHERE role = 'admin'::user_role) as admin_count,
              (SELECT count(*) FROM activities) as total_activities,
              (SELECT count(*) FROM activities WHERE created_at >= ${todayStart.toISOString()}::timestamp) as today_activities,
              (SELECT count(DISTINCT user_id) FROM activities WHERE created_at >= ${sevenDaysAgo.toISOString()}::timestamp) as active_users
          `)
        : Promise.resolve([{
          employee_count: 0, moderator_count: 0, admin_count: 0,
          total_activities: 0, today_activities: 0, active_users: 0
        }] as any)

      // Only fetch attendance data if profileId is provided (employee viewing their own data)
      const shouldFetchAttendance = !!profileId

      const [
        combinedStats,
        analyticsData,
        recentActivities,
        attendanceData,
        settingsData,
        closuresData
      ] = await Promise.all([
        // 1. OPTIMIZED: Single combined stats query
        combinedStatsQuery,

        // 2. Analytics data (TimeSeries) - SKIP for specific profile requests
        shouldFetchGlobalStats
          ? db.query.analyticsMetrics.findMany({
            where: gte(analyticsMetrics.metric_date, analyticsDaysAgo.toISOString().split('T')[0]),
            orderBy: [desc(analyticsMetrics.metric_date)],
            limit: analyticsDays * 24
          })
          : Promise.resolve([]),

        // 3. Recent activities - Filtered for employee if profileId exists
        db.query.activities.findMany({
          where: profileId ? eq(activities.user_id, profileId) : undefined,
          with: {
            profile: {
              columns: {
                id: true,
                email: true,
                full_name: true,
                first_name: true,
                last_name: true,
                role: true,
                designation_id: true
              },
              with: {
                designation: {
                  columns: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: [desc(activities.created_at)],
          limit: activitiesLimit
        }),

        // 4. User-specific attendance data (only if needed)
        // CRITICAL: Use client's localDate to calculate date range for timezone consistency
        // This prevents issues where server UTC time differs from user's local date
        shouldFetchAttendance ? (() => {
          // Calculate yesterday based on client's local date, not server time
          const clientDate = localDate || new Date().toISOString().split('T')[0];
          const [year, month, day] = clientDate.split('-').map(Number);
          const yesterday = new Date(year, month - 1, day - 1);
          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

          return db.select().from(attendance)
            .where(and(
              eq(attendance.profile_id, profileId!),
              gte(attendance.date, yesterdayStr)
            ));
        })() : Promise.resolve([]),

        // 5. Office settings (only if needed)
        shouldFetchAttendance ? db.select().from(officeSettings).limit(1) : Promise.resolve([]),

        // 6. Office closures (only if needed)
        shouldFetchAttendance ? db.select().from(officeClosures).where(gte(officeClosures.date, sql`CURRENT_DATE`)) : Promise.resolve([])
      ])

      // Extract combined stats (result is array with single row)
      const stats = (combinedStats as any)?.[0] || {}
      const employeeCount = Number(stats.employee_count || 0)
      const moderatorCount = Number(stats.moderator_count || 0)
      const adminCount = Number(stats.admin_count || 0)
      const totalActivitiesCount = Number(stats.total_activities || 0)
      const todayActivitiesCount = Number(stats.today_activities || 0)
      const activeUsersCount = Number(stats.active_users || 0)



      const result: DashboardMetricsResult = {
        critical: {
          totalUsers: employeeCount + moderatorCount + adminCount,
          activeUsers: Number(activeUsersCount),
          employeeCount,
          moderatorCount,
          adminCount
        },
        secondary: {
          totalActivities: totalActivitiesCount,
          todayActivities: todayActivitiesCount,
          analytics: analyticsData
        },
        detailed: {
          recentActivities: recentActivities.map(a => ({
            ...a,
            profiles: a.profile // Map for compatibility
          }))
        },
        attendance: profileId ? (() => {
          // Normalize date comparison - Drizzle may return Date objects for date columns
          // CRITICAL: Use client's localDate for accurate timezone handling
          // Fallback computes local date (not UTC) to avoid timezone mismatches
          const serverLocalDate = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })();
          const targetDate = localDate || serverLocalDate;

          const normalizeDate = (d: any): string => {
            if (!d) return '';
            if (d instanceof Date) {
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            // Handle string dates that might have time component
            const str = String(d);
            return str.split('T')[0];  // Strip any time component
          };

          const records = attendanceData as any[];
          return {
            todayRecord: records.find(r => normalizeDate(r.date) === targetDate) || null,
            pendingRecord: records.filter(r => !r.check_out).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null,
            settings: (settingsData as any[])[0] || null,
            closures: (closuresData as any[]) || []
          };
        })() : undefined
      }

      // IMPROVED CACHING STRATEGY:
      // - Cache for 10 minutes (600s) instead of 60s for better performance
      // - Cache admin data (no profileId) aggressively
      // - Cache employee global data (stats, activities) but attendance is ALWAYS fresh
      // - Real-time invalidation via Supabase will clear stale cache
      if (useCache) {
        if (!profileId) {
          // Admin dashboard - cache everything for 10 minutes
          setCachedQuery<DashboardMetricsResult>(queryHash, result, 10 * 60 * 1000)
        } else {
          // Employee dashboard - cache global stats but attendance is fetched fresh
          // Clone result without attendance data for caching
          const cacheableResult = {
            ...result,
            attendance: undefined // Don't cache attendance - always fetch fresh
          }
          setCachedQuery<DashboardMetricsResult>(queryHash, cacheableResult, 10 * 60 * 1000)
        }
      }

      recordQueryMetrics({
        queryType: 'getDashboardMetricsUnified',
        executionTime: performance.now() - startTime,
        rowCount: recentActivities.length,
        cacheHit: false,
        indexUsed: true,
        hash: queryHash
      })

      return result

    } catch (error) {
      console.error('[DB-PERF] getDashboardMetricsUnified failed:', error)
      throw error
    }
  }

  // BATCH QUERY 2: Optimized user management queries
  async getUsersOptimized(options: {
    page?: number
    limit?: number
    role?: string
    search?: string
    useCache?: boolean
  } = {}): Promise<{
    users: any[]
    total: number
    hasMore: boolean
  }> {
    const startTime = startQueryTiming('getUsersOptimized')
    const { page = 1, limit = 20, role, search, useCache = true } = options
    const offset = (page - 1) * limit
    const queryHash = hashQuery('users_optimized', { page, limit, role, search })

    type UsersResult = {
      users: any[]
      total: number
      hasMore: boolean
    }

    try {
      // Check cache
      if (useCache && !search && !role) {
        const cached = getCachedQuery<UsersResult>(queryHash)
        if (cached) {
          recordQueryMetrics({
            queryType: 'getUsersOptimized',
            executionTime: performance.now() - startTime,
            rowCount: 0,
            cacheHit: true,
            indexUsed: true
          })
          return cached
        }
      }

      // Build where clause
      let whereClause = []
      if (role) whereClause.push(eq(profiles.role, role as any))
      if (search) {
        whereClause.push(
          or(
            ilike(profiles.email, `%${search}%`),
            ilike(profiles.first_name, `%${search}%`),
            ilike(profiles.last_name, `%${search}%`)
          )
        )
      }

      const [data, totalCount] = await Promise.all([
        db.query.profiles.findMany({
          where: whereClause.length > 0 ? and(...whereClause) : undefined,
          orderBy: [desc(profiles.created_at)],
          limit: limit,
          offset: offset,
          with: { designation: true }
        }),
        db.select({ value: count() })
          .from(profiles)
          .where(whereClause.length > 0 ? and(...whereClause) : undefined)
      ])

      const result: UsersResult = {
        users: data,
        total: totalCount[0]?.value || 0,
        hasMore: (totalCount[0]?.value || 0) > offset + limit
      }

      // Cache the result
      if (useCache && !search && !role) {
        setCachedQuery<UsersResult>(queryHash, result, 60 * 1000)
      }

      recordQueryMetrics({
        queryType: 'getUsersOptimized',
        executionTime: performance.now() - startTime,
        rowCount: result.users.length,
        cacheHit: false,
        indexUsed: true
      })

      return result

    } catch (error) {
      console.error('[DB-PERF] getUsersOptimized failed:', error)
      throw error
    }
  }

  // BATCH QUERY 3: Optimized activity queries with pagination
  async getActivitiesOptimized(options: {
    page?: number
    limit?: number
    userId?: string
    activityType?: string
    dateFrom?: string
    dateTo?: string
    useCache?: boolean
  } = {}): Promise<{
    activities: any[]
    total: number
    hasMore: boolean
  }> {
    const startTime = startQueryTiming('getActivitiesOptimized')
    const { page = 1, limit = 20, userId, activityType, dateFrom, dateTo, useCache = true } = options
    const offset = (page - 1) * limit
    const queryHash = hashQuery('activities_optimized', { page, limit, userId, activityType, dateFrom, dateTo })

    try {
      if (useCache && !userId && !activityType && !dateFrom && !dateTo) {
        const cached = getCachedQuery<any>(queryHash)
        if (cached) return cached
      }

      let whereClause = []
      if (userId) whereClause.push(eq(activities.user_id, userId))
      if (activityType) whereClause.push(eq(activities.activity_type, activityType as any))
      if (dateFrom) whereClause.push(gte(activities.created_at, new Date(dateFrom)))
      if (dateTo) whereClause.push(lte(activities.created_at, new Date(dateTo)))

      const [data, totalCount] = await Promise.all([
        db.query.activities.findMany({
          where: whereClause.length > 0 ? and(...whereClause) : undefined,
          orderBy: [desc(activities.created_at)],
          limit: limit,
          offset: offset,
          with: {
            profile: {
              columns: {
                email: true,
                full_name: true,
                first_name: true,
                last_name: true,
                role: true,
                designation_id: true
              },
              with: {
                designation: {
                  columns: {
                    name: true
                  }
                }
              }
            }
          }
        }),
        db.select({ value: count() })
          .from(activities)
          .where(whereClause.length > 0 ? and(...whereClause) : undefined)
      ])

      const result = {
        activities: data.map(a => ({ ...a, profiles: a.profile })),
        total: totalCount[0]?.value || 0,
        hasMore: (totalCount[0]?.value || 0) > offset + limit
      }

      if (useCache && !userId && !activityType && !dateFrom && !dateTo) {
        setCachedQuery(queryHash, result, 30 * 1000)
      }

      recordQueryMetrics({
        queryType: 'getActivitiesOptimized',
        executionTime: performance.now() - startTime,
        rowCount: result.activities.length,
        cacheHit: false,
        indexUsed: true
      })

      return result
    } catch (error) {
      console.error('[DB-PERF] getActivitiesOptimized failed:', error)
      throw error
    }
  }

  // BATCH QUERY 4: Single query for complex statistics
  async getComplexStatistics(options: {
    dateRange: { from: string; to: string }
    groupBy?: 'day' | 'week' | 'month'
    useCache?: boolean
  }): Promise<{
    userGrowth: any[]
    activityStats: any[]
    topUsers: any[]
  }> {
    const startTime = startQueryTiming('getComplexStatistics')
    const { dateRange, useCache = true } = options
    const queryHash = hashQuery('complex_statistics', { dateRange })

    try {
      if (useCache) {
        const cached = getCachedQuery<any>(queryHash)
        if (cached) return cached
      }

      const [userGrowth, activityStats, topUsers] = await Promise.all([
        db.select({
          date: sql`date_trunc('day', ${profiles.created_at})`,
          count: count()
        })
          .from(profiles)
          .where(and(gte(profiles.created_at, new Date(dateRange.from)), lte(profiles.created_at, new Date(dateRange.to))))
          .groupBy(sql`date_trunc('day', ${profiles.created_at})`)
          .orderBy(sql`date_trunc('day', ${profiles.created_at})`),

        db.select({
          type: activities.activity_type,
          count: count()
        })
          .from(activities)
          .where(and(gte(activities.created_at, new Date(dateRange.from)), lte(activities.created_at, new Date(dateRange.to))))
          .groupBy(activities.activity_type),

        db.select({
          userId: activities.user_id,
          count: count()
        })
          .from(activities)
          .where(and(gte(activities.created_at, new Date(dateRange.from)), lte(activities.created_at, new Date(dateRange.to))))
          .groupBy(activities.user_id)
          .orderBy(desc(count()))
          .limit(10)
      ])

      const result = { userGrowth, activityStats, topUsers }

      if (useCache) {
        setCachedQuery(queryHash, result, 5 * 60 * 1000)
      }

      recordQueryMetrics({
        queryType: 'getComplexStatistics',
        executionTime: performance.now() - startTime,
        rowCount: userGrowth.length + activityStats.length + topUsers.length,
        cacheHit: false,
        indexUsed: true
      })

      return result
    } catch (error) {
      console.error('[DB-PERF] getComplexStatistics failed:', error)
      throw error
    }
  }
}

// Performance monitoring utilities
export function getDatabasePerformanceStats() {
  const recentMetrics = queryMetrics.slice(-100)

  const avgQueryTime = recentMetrics.length > 0
    ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length
    : 0

  const cacheHitRate = recentMetrics.length > 0
    ? (recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length) * 100
    : 0

  const slowQueries = recentMetrics.filter(m => m.executionTime > 200).length // 200ms threshold for Drizzle

  return {
    totalQueries: queryMetrics.length,
    recentQueries: recentMetrics.length,
    averageQueryTime: avgQueryTime,
    cacheHitRate,
    slowQueries,
    cacheSize: queryCache.size,
    topSlowQueries: recentMetrics
      .filter(m => m.executionTime > 500)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 5)
      .map(m => ({ type: m.queryType, time: m.executionTime }))
  }
}

// Factory function
export function createOptimizedQueryManager(): OptimizedQueryManager {
  return new OptimizedQueryManager()
}

// Clear all caches
export function clearQueryCaches(): void {
  queryCache.clear()
  console.log('[DB-PERF] All query caches cleared')
}

// Singleton instance for use across the app
export const queryManager = new OptimizedQueryManager()
