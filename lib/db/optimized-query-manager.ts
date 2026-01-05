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
  // BATCH QUERY 1: Get all dashboard metrics in a single optimized execution
  async getDashboardMetricsUnified(options: {
    analyticsDays?: number
    activitiesLimit?: number
    useCache?: boolean
    profileId?: string
    localDate?: string
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
    const { analyticsDays = 7, activitiesLimit = 10, useCache = true, profileId, localDate } = options
    const queryHash = hashQuery('dashboard_metrics_unified', { analyticsDays, activitiesLimit, profileId, localDate })

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
      if (useCache) {
        const cached = getCachedQuery<DashboardMetricsResult>(queryHash)
        if (cached) {
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

      const [
        roleCountsResult,
        totalActivitiesResult,
        todayActivitiesResult,
        activeUsersCountResult,
        analyticsData,
        recentActivities,
        attendanceData,
        settingsData,
        closuresData
      ] = await Promise.all([
        // 1. Consolidated Role counts
        db.select({
          role: profiles.role,
          count: count()
        }).from(profiles).groupBy(profiles.role),

        // 2a. Total Activities - Minimal query
        db.select({ count: count(activities.id) }).from(activities),

        // 2b. Today Activities - Filtered count
        db.select({
          count: sql<number>`count(*) filter (where ${activities.created_at} >= ${todayStart.toISOString()}::timestamp)`
        }).from(activities),

        // 2c. Optimized Active User Count
        db.select({ count: sql<number>`count(distinct ${activities.user_id})` }).from(activities)
          .where(gte(activities.created_at, sevenDaysAgo)),

        // 3. Analytics data (TimeSeries)
        db.query.analyticsMetrics.findMany({
          where: gte(analyticsMetrics.metric_date, analyticsDaysAgo.toISOString().split('T')[0]),
          orderBy: [desc(analyticsMetrics.metric_date)],
          limit: analyticsDays * 24
        }),

        // 4. Recent activities
        db.query.activities.findMany({
          with: {
            profile: {
              columns: {
                id: true,
                email: true,
                full_name: true,
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: [desc(activities.created_at)],
          limit: activitiesLimit
        }),

        // 5. User-specific attendance data
        profileId ? db.select().from(attendance)
          .where(and(
            eq(attendance.profile_id, profileId),
            gte(attendance.date, sql`${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`)
          )) : Promise.resolve([]),

        // 6. Office settings and closures
        profileId ? db.select().from(officeSettings).limit(1) : Promise.resolve([]),
        profileId ? db.select().from(officeClosures).where(gte(officeClosures.date, sql`CURRENT_DATE`)) : Promise.resolve([])
      ])

      const totalActivitiesCount = Number((totalActivitiesResult as any)?.[0]?.count || 0)
      const todayActivitiesCount = Number((todayActivitiesResult as any)?.[0]?.count || 0)
      const activeUsersCount = Number((activeUsersCountResult as any)?.[0]?.count || 0)

      // Process role counts from the grouped result
      const employeeCount = Number(roleCountsResult.find(r => r.role === 'employee')?.count || 0)
      const moderatorCount = Number(roleCountsResult.find(r => r.role === 'moderator')?.count || 0)
      const adminCount = Number(roleCountsResult.find(r => r.role === 'admin')?.count || 0)

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
        attendance: profileId ? {
          todayRecord: (attendanceData as any[]).find(r => r.date === (localDate || new Date().toISOString().split('T')[0])),
          pendingRecord: (attendanceData as any[]).filter(r => !r.check_out).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0],
          settings: (settingsData as any[])[0] || null,
          closures: (closuresData as any[]) || []
        } : undefined
      }

      // Cache the result
      if (useCache) {
        setCachedQuery<DashboardMetricsResult>(queryHash, result, 15 * 1000) // 15 seconds cache
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
                last_name: true
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
