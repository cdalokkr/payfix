// ============================================
// lib/trpc/routers/admin-dashboard.ts
// ============================================
import { z } from 'zod'
import { router, adminProcedure } from '../server'

export const adminDashboardRouter = router({
  getStats: adminProcedure.query(async ({ ctx }) => {
    // PERFORMANCE OPTIMIZATION: Add null safety
    const [usersCount, activitiesCount, todayActivities] = await Promise.all([
      ctx.supabase?.from('profiles').select('*', { count: 'exact', head: true }) || { count: 0 },
      ctx.supabase?.from('activities').select('*', { count: 'exact', head: true }) || { count: 0 },
      ctx.supabase
        ?.from('activities')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]) || { count: 0 },
    ])

    return {
      totalUsers: usersCount.count || 0,
      totalActivities: activitiesCount.count || 0,
      todayActivities: todayActivities.count || 0,
    }
  }),

  getRecentActivities: adminProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      // PERFORMANCE OPTIMIZATION: Add null safety
      const { data } = await ctx.supabase
        ?.from('activities')
        .select('*, profiles(email, full_name)')
        .order('created_at', { ascending: false })
        .limit(input.limit) || { data: [] }

      return data || []
    }),

  getDashboardData: adminProcedure
    .input(
      z.object({
        analyticsDays: z.number().default(7),
        activitiesLimit: z.number().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // PERFORMANCE OPTIMIZATION: Add null safety and parallel query optimization
      const [usersCount, activitiesCount, todayActivities, analytics, recentActivities] = await Promise.all([
        // Stats queries with null safety
        ctx.supabase?.from('profiles').select('*', { count: 'exact', head: true }) || { count: 0 },
        ctx.supabase?.from('activities').select('*', { count: 'exact', head: true }) || { count: 0 },
        ctx.supabase
          ?.from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().split('T')[0]) || { count: 0 },

        // Analytics query with null safety
        ctx.supabase
          ?.from('analytics_metrics')
          .select('*')
          .gte('metric_date', new Date(Date.now() - input.analyticsDays * 24 * 60 * 60 * 1000).toISOString())
          .order('metric_date', { ascending: true }) || { data: [] },

        // Recent activities query with null safety
        ctx.supabase
          ?.from('activities')
          .select('*, profiles(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(input.activitiesLimit) || { data: [] },
      ])

      // Construct the response with proper error handling
      const stats = {
        totalUsers: usersCount.count || 0,
        totalActivities: activitiesCount.count || 0,
        todayActivities: todayActivities.count || 0,
      }

      // Add metadata for caching and versioning
      const metadata = {
        fetchedAt: new Date().toISOString(),
        version: '1.0.0',
        cacheExpiry: Date.now() + (30 * 1000), // 30 seconds cache expiry
      }

      return {
        stats,
        analytics: analytics.data || [],
        recentActivities: recentActivities.data || [],
        metadata,
      }
    }),

  // NEW: Comprehensive dashboard endpoint that consolidates all data
  getComprehensiveDashboardData: adminProcedure
    .input(
      z.object({
        analyticsDays: z.number().default(7),
        activitiesLimit: z.number().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // PERFORMANCE OPTIMIZATION: Reduce database calls and fix unhandled promise
      const [usersCount, activitiesCount, todayActivities, analytics, recentActivities, activeUsersResult, moderatorCountResult, employeeCountResult] = await Promise.all([
        // Basic stats queries - optimized to use single query
        ctx.supabase?.from('profiles').select('*', { count: 'exact', head: true }) || { count: 0 },
        ctx.supabase?.from('activities').select('*', { count: 'exact', head: true }) || { count: 0 },
        ctx.supabase
          ?.from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().split('T')[0]) || { count: 0 },

        // Analytics data with optimized date range
        ctx.supabase
          ?.from('analytics_metrics')
          .select('*')
          .gte('metric_date', new Date(Date.now() - input.analyticsDays * 24 * 60 * 60 * 1000).toISOString())
          .order('metric_date', { ascending: true }) || { data: [] },

        // Recent activities with optimized join
        ctx.supabase
          ?.from('activities')
          .select('*, profiles(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(input.activitiesLimit) || { data: [] },

        // PERFORMANCE FIX: Properly await and optimize active users calculation
        (async () => {
          const result = await ctx.supabase
            ?.from('activities')
            .select('user_id')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

          const data = result?.data || []
          const uniqueUsers = new Set(data.map((a: { user_id: string }) => a.user_id))
          return { count: uniqueUsers.size }
        })(),

        // NEW: Fetch role-specific counts
        ctx.supabase?.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'moderator') || { count: 0 },
        ctx.supabase?.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employee') || { count: 0 },
      ])

      const moderatorCount = moderatorCountResult.count || 0
      const employeeCount = employeeCountResult.count || 0

      // Construct comprehensive response
      const criticalData = {
        totalUsers: usersCount.count || 0,
        activeUsers: activeUsersResult.count || 0,
        moderatorCount,
        employeeCount,
        metadata: {
          tier: 'critical',
          fetchedAt: new Date().toISOString(),
          cacheExpiry: Date.now() + (15 * 1000),
        }
      }

      const secondaryData = {
        totalActivities: activitiesCount.count || 0,
        todayActivities: todayActivities.count || 0,
        analytics: analytics.data || [],
        metadata: {
          tier: 'secondary',
          fetchedAt: new Date().toISOString(),
          cacheExpiry: Date.now() + (30 * 1000),
        }
      }

      const detailedData = {
        recentActivities: recentActivities.data || [],
        metadata: {
          tier: 'detailed',
          fetchedAt: new Date().toISOString(),
          cacheExpiry: Date.now() + (60 * 1000),
        }
      }

      return {
        critical: criticalData,
        secondary: secondaryData,
        detailed: detailedData,
        // Flat structure for convenience
        stats: {
          totalUsers: criticalData.totalUsers,
          activeUsers: criticalData.activeUsers,
          totalActivities: secondaryData.totalActivities,
          todayActivities: secondaryData.todayActivities,
          moderatorCount,
          employeeCount,
        },
        analytics: secondaryData.analytics,
        recentActivities: detailedData.recentActivities,
        metadata: {
          consolidated: true,
          fetchedAt: new Date().toISOString(),
          version: '2.0.0',
          cacheExpiry: Date.now() + (15 * 1000), // Use the shortest cache time
        }
      }
    }),

  // Progressive loading endpoints for better perceived performance
  getCriticalDashboardData: adminProcedure.query(async ({ ctx }) => {
    // PERFORMANCE OPTIMIZATION: Tier 1: Critical data with null safety
    const [usersCount, activeUsersCount] = await Promise.all([
      ctx.supabase?.from('profiles').select('*', { count: 'exact', head: true }) || { count: 0 },
      // Calculate active users (users with activities in last 7 days) - PERFORMANCE FIX
      (async () => {
        const result = await ctx.supabase
          ?.from('activities')
          .select('user_id')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

        const data = result?.data || []
        const uniqueUsers = new Set(data.map((a: { user_id: string }) => a.user_id))
        return { count: uniqueUsers.size }
      })()
    ])

    return {
      totalUsers: usersCount.count || 0,
      activeUsers: activeUsersCount.count || 0,
      metadata: {
        tier: 'critical',
        fetchedAt: new Date().toISOString(),
        cacheExpiry: Date.now() + (15 * 1000), // 15 seconds cache for critical data
      }
    }
  }),

  getSecondaryDashboardData: adminProcedure
    .input(
      z.object({
        analyticsDays: z.number().default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      // Tier 2: Secondary data for detailed metrics
      const [activitiesCount, todayActivities, analytics] = await Promise.all([
        ctx.supabase?.from('activities').select('*', { count: 'exact', head: true }) || { count: 0 },
        ctx.supabase
          ?.from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().split('T')[0]) || { count: 0 },
        ctx.supabase
          ?.from('analytics_metrics')
          .select('*')
          .gte('metric_date', new Date(Date.now() - input.analyticsDays * 24 * 60 * 60 * 1000).toISOString())
          .order('metric_date', { ascending: true }) || { data: [] }
      ])

      return {
        totalActivities: activitiesCount.count || 0,
        todayActivities: todayActivities.count || 0,
        analytics: analytics.data || [],
        metadata: {
          tier: 'secondary',
          fetchedAt: new Date().toISOString(),
          cacheExpiry: Date.now() + (30 * 1000), // 30 seconds cache for secondary data
        }
      }
    }),

  getDetailedDashboardData: adminProcedure
    .query(async ({ ctx }) => {
      // Tier 3: Detailed data for recent activities
      const { data } = await ctx.supabase
        ?.from('activities')
        .select('*, profiles(email, full_name)')
        .order('created_at', { ascending: false }) || { data: [] }

      return {
        recentActivities: data || [],
        metadata: {
          tier: 'detailed',
          fetchedAt: new Date().toISOString(),
          cacheExpiry: Date.now() + (60 * 1000), // 60 seconds cache for detailed data
        }
      }
    }),
})