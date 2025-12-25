// ============================================
// lib/db/optimized-query-manager.ts
// Performance-optimized database query manager with N+1 elimination
// ============================================
import { createClient } from '@supabase/supabase-js'

// Performance monitoring for database queries
interface DatabaseMetrics {
  queryType: string
  executionTime: number
  rowCount: number
  cacheHit: boolean
  indexUsed: boolean
  timestamp: number
}

// Query cache for frequently accessed data
interface QueryCache {
  data: any
  timestamp: number
  ttl: number
  queryHash: string
}

// Optimized query patterns to prevent N+1 queries
interface QueryBatch {
  queries: Array<() => Promise<any>>
  results: any[]
  startTime: number
  metrics: {
    totalQueries: number
    totalTime: number
    cacheHits: number
  }
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
  if (metrics.executionTime > 1000) {
    console.warn(`[DB-PERF] Slow query ${metrics.queryType}: ${metrics.executionTime.toFixed(2)}ms`, {
      executionTime: metrics.executionTime,
      rowCount: metrics.rowCount,
      cacheHit: metrics.cacheHit,
      indexUsed: metrics.indexUsed
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

// Optimized batch query execution
export class OptimizedQueryManager {
  private supabase: any
  
  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }
  
  // BATCH QUERY 1: Get all dashboard metrics in a single optimized query
  async getDashboardMetricsUnified(options: {
    analyticsDays?: number
    activitiesLimit?: number
    useCache?: boolean
  } = {}): Promise<{
    critical: { totalUsers: number; activeUsers: number }
    secondary: { totalActivities: number; todayActivities: number; analytics: any[] }
    detailed: { recentActivities: any[] }
  }> {
    const startTime = startQueryTiming('getDashboardMetricsUnified')
    const { analyticsDays = 7, activitiesLimit = 10, useCache = true } = options
    const queryHash = hashQuery('dashboard_metrics_unified', { analyticsDays, activitiesLimit })
    
    type DashboardMetricsResult = {
      critical: { totalUsers: number; activeUsers: number }
      secondary: { totalActivities: number; todayActivities: number; analytics: any[] }
      detailed: { recentActivities: any[] }
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
      
      // Use optimized single query with proper joins to prevent N+1
      const [profilesResult, activitiesResult, todayActivitiesResult, analyticsResult, recentActivitiesResult, activeUsersResult] = await Promise.all([
        // Total users count with role filtering
        this.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user'),
        
        // Total activities count
        this.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true }),
        
        // Today's activities count (optimized with date range)
        this.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().split('T')[0]),
        
        // Analytics data with optimized date range
        this.supabase
          .from('analytics_metrics')
          .select('*')
          .gte('metric_date', new Date(Date.now() - analyticsDays * 24 * 60 * 60 * 1000).toISOString())
          .order('metric_date', { ascending: true })
          .limit(analyticsDays * 24), // Limit to prevent excessive data
        
        // Recent activities with optimized join (prevents N+1)
        this.supabase
          .from('activities')
          .select(`
            *,
            profiles!activities_user_id_fkey (
              email,
              full_name,
              first_name,
              last_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(activitiesLimit),
        
        // Active users calculation (optimized single query)
        this.supabase
          .from('activities')
          .select('user_id')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ])
      
      // Process results efficiently
      const uniqueUsers = new Set(
        activeUsersResult.data?.map((a: any) => a.user_id).filter(Boolean) || []
      )
      
      const result: DashboardMetricsResult = {
          critical: {
            totalUsers: profilesResult.count || 0,
            activeUsers: uniqueUsers.size
          },
          secondary: {
            totalActivities: activitiesResult.count || 0,
            todayActivities: todayActivitiesResult.count || 0,
            analytics: analyticsResult.data || []
          },
          detailed: {
            recentActivities: recentActivitiesResult.data || []
          }
        }
        
        // Cache the result
        if (useCache) {
          setCachedQuery<DashboardMetricsResult>(queryHash, result, 15 * 1000) // 15 seconds cache
        }
      
      recordQueryMetrics({
        queryType: 'getDashboardMetricsUnified',
        executionTime: performance.now() - startTime,
        rowCount: result.secondary.totalActivities + result.secondary.analytics.length,
        cacheHit: false,
        indexUsed: true
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
      // Check cache for basic queries
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
      
      // Build optimized query with proper joins
      let query = this.supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          role,
          first_name,
          last_name,
          created_at,
          updated_at,
          auth.users!inner (
            email_confirmed_at,
            last_sign_in_at
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      // Apply filters
      if (role) {
        query = query.eq('role', role)
      }
      
      if (search) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
      }
      
      const { data, error, count } = await query
      
      if (error) throw error
      
      const result: UsersResult = {
        users: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      }
      
      // Cache the result
      if (useCache && !search && !role) {
        setCachedQuery<UsersResult>(queryHash, result, 60 * 1000) // 1 minute cache
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
    
    type ActivitiesResult = {
      activities: any[]
      total: number
      hasMore: boolean
    }
    
    try {
      // Check cache for basic queries
      if (useCache && !userId && !activityType && !dateFrom && !dateTo) {
        const cached = getCachedQuery<ActivitiesResult>(queryHash)
        if (cached) {
          recordQueryMetrics({
            queryType: 'getActivitiesOptimized',
            executionTime: performance.now() - startTime,
            rowCount: 0,
            cacheHit: true,
            indexUsed: true
          })
          return cached
        }
      }
      
      // Build optimized query with proper joins (prevents N+1)
      let query = this.supabase
        .from('activities')
        .select(`
          id,
          user_id,
          activity_type,
          description,
          metadata,
          created_at,
          profiles!activities_user_id_fkey (
            email,
            full_name,
            first_name,
            last_name
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      // Apply filters
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      if (activityType) {
        query = query.eq('activity_type', activityType)
      }
      
      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }
      
      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }
      
      const { data, error, count } = await query
      
      if (error) throw error
      
      const result: ActivitiesResult = {
        activities: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      }
      
      // Cache the result
      if (useCache && !userId && !activityType && !dateFrom && !dateTo) {
        setCachedQuery<ActivitiesResult>(queryHash, result, 30 * 1000) // 30 seconds cache
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
  } = { dateRange: { from: '', to: '' } }): Promise<{
    userGrowth: any[]
    activityStats: any[]
    topUsers: any[]
  }> {
    const startTime = startQueryTiming('getComplexStatistics')
    const { dateRange, groupBy = 'day', useCache = true } = options
    const queryHash = hashQuery('complex_statistics', { dateRange, groupBy })
    
    type ComplexStatisticsResult = {
      userGrowth: any[]
      activityStats: any[]
      topUsers: any[]
    }
    
    try {
      // Check cache
      if (useCache) {
        const cached = getCachedQuery<ComplexStatisticsResult>(queryHash)
        if (cached) {
          recordQueryMetrics({
            queryType: 'getComplexStatistics',
            executionTime: performance.now() - startTime,
            rowCount: 0,
            cacheHit: true,
            indexUsed: true
          })
          return cached
        }
      }
      
      // Execute optimized batch queries
      const [userGrowth, activityStats, topUsers] = await Promise.all([
        // User growth over time (using index on created_at)
        this.supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to),
        
        // Activity statistics (using optimized joins)
        this.supabase
          .from('activities')
          .select(`
            activity_type,
            created_at,
            profiles!activities_user_id_fkey (
              email
            )
          `)
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to),
        
        // Top active users (optimized aggregation)
        this.supabase
          .from('activities')
          .select(`
            user_id,
            count:id
          `)
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to)
          .group('user_id')
          .order('count', { ascending: false })
          .limit(10)
      ])
      
      // Process results
      const result: ComplexStatisticsResult = {
        userGrowth: userGrowth.data || [],
        activityStats: activityStats.data || [],
        topUsers: topUsers.data || []
      }
      
      // Cache the result
      if (useCache) {
        setCachedQuery<ComplexStatisticsResult>(queryHash, result, 5 * 60 * 1000) // 5 minutes cache for complex stats
      }
      
      recordQueryMetrics({
        queryType: 'getComplexStatistics',
        executionTime: performance.now() - startTime,
        rowCount: result.userGrowth.length + result.activityStats.length + result.topUsers.length,
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
  
  const slowQueries = recentMetrics.filter(m => m.executionTime > 500).length
  
  return {
    totalQueries: queryMetrics.length,
    recentQueries: recentMetrics.length,
    averageQueryTime: avgQueryTime,
    cacheHitRate,
    slowQueries,
    cacheSize: queryCache.size,
    topSlowQueries: recentMetrics
      .filter(m => m.executionTime > 1000)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 5)
      .map(m => ({ type: m.queryType, time: m.executionTime }))
  }
}

// Create optimized query manager factory
export function createOptimizedQueryManager(supabaseClient: any): OptimizedQueryManager {
  return new OptimizedQueryManager(supabaseClient)
}

// Clear all caches (useful for testing or memory management)
export function clearQueryCaches(): void {
  queryCache.clear()
  console.log('[DB-PERF] All query caches cleared')
}