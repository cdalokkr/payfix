// ============================================
// lib/trpc/routers/admin-reports.ts
// Reports and Analytics Router for Admin
// ============================================
import { z } from 'zod'
import { router, adminProcedure, protectedProcedure } from '../server'

export const adminReportsRouter = router({
  // Get comprehensive reports data for admin
  // Get comprehensive reports data for admin
  getReportsData: adminProcedure
    .input(
      z.object({
        days: z.number().default(30),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      const now = new Date()
      const startDate = input.startDate
        ? new Date(input.startDate)
        : new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
      const endDate = input.endDate ? new Date(input.endDate) : now

      // Fetch all required data
      const [
        totalUsersResult,
        activeUsersResult,
        activitiesResult,
        todayActivitiesResult,
        activitiesInPeriodResult,
        profilesResult,
        adminCountResult,
        moderatorCountResult,
        employeeCountResult,
        activeProfilesCountResult,
        inactiveProfilesCountResult,
      ] = await Promise.all([
        // Total users count
        ctx.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true }),

        // Active users (last 7 days) - Fixed: select user_id to get data for Set
        ctx.supabase
          .from('activities')
          .select('user_id')
          .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Total activities
        ctx.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true }),

        // Today's activities
        ctx.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

        // Activities in selected period for aggregation
        ctx.supabase
          .from('activities')
          .select('activity_type, user_id')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),

        // User profiles (fetch id, user_id, role, name details)
        ctx.supabase
          .from('profiles')
          .select('id, user_id, role, first_name, last_name, email, avatar_url'),

        // Total Admins Count
        ctx.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin'),

        // Total Employees Count
        ctx.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'employee'),

        // Total Moderators Count
        ctx.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'moderator'),

        // Total Active Users for Access (from profiles table)
        ctx.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),

        // Total Inactive Users for Access (from profiles table)
        ctx.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'deactive'),
      ])

      // Check for errors in critical queries
      if (activitiesInPeriodResult.error) throw new Error(`Activities query failed: ${activitiesInPeriodResult.error.message}`)
      if (profilesResult.error) throw new Error(`Profiles query failed: ${profilesResult.error.message}`)

      // Process Activity by User
      const userActivityCounts = new Map<string, number>()

      if (activitiesInPeriodResult.data) {
        activitiesInPeriodResult.data.forEach((activity: any) => {
          if (activity.user_id) {
            userActivityCounts.set(activity.user_id, (userActivityCounts.get(activity.user_id) || 0) + 1)
          }
        })
      }

      const adminUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []
      const moderatorUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []
      const employeeUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []

      if (profilesResult.data) {
        profilesResult.data.forEach((profile: any) => {
          const count = userActivityCounts.get(profile.id) || 0
          if (count > 0) {
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
            const userData = {
              user_id: profile.id, // Using profile.id which activities.user_id references
              name,
              count,
              email: profile.email,
              avatar_url: profile.avatar_url
            }

            if (profile.role === 'admin') {
              adminUsers.push(userData)
            } else if (profile.role === 'moderator') {
              moderatorUsers.push(userData)
            } else {
              employeeUsers.push(userData)
            }
          }
        })
      }

      // Sort and substring top 5
      const topAdmins = adminUsers.sort((a, b) => b.count - a.count).slice(0, 5)
      const topModerators = moderatorUsers.sort((a, b) => b.count - a.count).slice(0, 5)
      const topEmployees = employeeUsers.sort((a, b) => b.count - a.count).slice(0, 5)

      // Helper function to prepare chart data for activity breakdown
      const prepareBreakdownChartData = (topUsers: any[], showBreakdown: boolean = true) => {
        const topUserIds = new Set(topUsers.map(u => u.user_id))

        if (showBreakdown) {
          const activityTypesMap = new Map<string, Map<string, number>>() // user_id -> map(activity_type -> count)
          const allActivityTypes = new Set<string>()

          if (activitiesInPeriodResult.data) {
            activitiesInPeriodResult.data.forEach((activity: any) => {
              if (activity.user_id && topUserIds.has(activity.user_id)) {
                const type = activity.activity_type || 'unknown'
                allActivityTypes.add(type)

                if (!activityTypesMap.has(activity.user_id)) {
                  activityTypesMap.set(activity.user_id, new Map<string, number>())
                }
                const userTypes = activityTypesMap.get(activity.user_id)!
                userTypes.set(type, (userTypes.get(type) || 0) + 1)
              }
            })
          }

          const chartLabels = Array.from(allActivityTypes).sort()
          const chartDatasets = topUsers.map((user, index) => {
            const userTypes = activityTypesMap.get(user.user_id) || new Map<string, number>()
            const data = chartLabels.map(label => userTypes.get(label) || 0)

            const colors = [
              'rgba(255, 99, 132, 0.5)',   // Red
              'rgba(54, 162, 235, 0.5)',   // Blue
              'rgba(255, 206, 86, 0.5)',   // Yellow
              'rgba(75, 192, 192, 0.5)',   // Teal
              'rgba(153, 102, 255, 0.5)',  // Purple
            ]
            const borderColors = [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
            ]

            return {
              label: user.name,
              data,
              backgroundColor: colors[index % colors.length],
              borderColor: borderColors[index % borderColors.length],
              borderWidth: 2
            }
          })

          return {
            labels: chartLabels,
            datasets: chartDatasets
          }
        } else {
          // Total count only (as requested for moderators/staff)
          const chartLabels = ['Total Activities']
          const chartDatasets = topUsers.map((user, index) => {
            const colors = [
              'rgba(255, 99, 132, 0.5)',   // Red
              'rgba(54, 162, 235, 0.5)',   // Blue
              'rgba(255, 206, 86, 0.5)',   // Yellow
              'rgba(75, 192, 192, 0.5)',   // Teal
              'rgba(153, 102, 255, 0.5)',  // Purple
            ]
            const borderColors = [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
            ]

            return {
              label: user.name,
              data: [user.count],
              backgroundColor: colors[index % colors.length],
              borderColor: borderColors[index % borderColors.length],
              borderWidth: 2
            }
          })

          return {
            labels: chartLabels,
            datasets: chartDatasets
          }
        }
      }

      const adminActivityChartData = prepareBreakdownChartData(topAdmins, true)
      const moderatorActivityChartData = prepareBreakdownChartData(topModerators, false)
      const employeeActivityChartData = prepareBreakdownChartData(topEmployees, false)

      // Process Activity By Role Data (Keep existing logic for now if needed, or remove if unused)
      const roleMap = new Map<string, string>()
      if (profilesResult.data) {
        profilesResult.data.forEach((user: any) => {
          if (user.id) roleMap.set(user.id, user.role)
        })
      }

      const activityRoleCounts = new Map<string, { admin: number, employee: number }>()

      if (activitiesInPeriodResult.data) {
        activitiesInPeriodResult.data.forEach((activity: any) => {
          const type = activity.activity_type || 'unknown'
          const userId = activity.user_id
          const role = roleMap.get(userId) || 'employee' // Default to employee if unknown

          if (!activityRoleCounts.has(type)) {
            activityRoleCounts.set(type, { admin: 0, employee: 0 })
          }

          const counts = activityRoleCounts.get(type)!
          if (role === 'admin') {
            counts.admin++
          } else {
            counts.employee++
          }
        })
      }

      const activityByRoleChartData = Array.from(activityRoleCounts.entries()).map(([type, counts]) => ({
        name: type,
        admin: counts.admin,
        employee: counts.employee
      }))

      // Calculate unique active users
      const uniqueActiveUserIds = new Set(
        activeUsersResult.data?.map((a: any) => a.user_id) || []
      )
      const activeUsersCount = uniqueActiveUserIds.size

      // Calculate trends (compare with previous period)
      const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
      const [previousTotalUsers, previousTodayActivities] = await Promise.all([
        ctx.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .lt('created_at', startDate.toISOString()),
        ctx.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(previousStartDate.setHours(0, 0, 0, 0)).toISOString())
          .lt('created_at', startDate.toISOString()),
      ])

      const totalUsers = totalUsersResult.count || 0
      const previousTotalUsersCount = previousTotalUsers.count || 0
      const userGrowthPercent = previousTotalUsersCount > 0
        ? ((totalUsers - previousTotalUsersCount) / previousTotalUsersCount) * 100
        : 0

      const todayActivities = todayActivitiesResult.count || 0
      const previousTodayActivitiesCount = previousTodayActivities.count || 0
      const activityGrowthPercent = previousTodayActivitiesCount > 0
        ? ((todayActivities - previousTodayActivitiesCount) / previousTodayActivitiesCount) * 100
        : 0

      return {
        stats: {
          totalUsers,
          activeUsers: activeUsersCount,
          totalActivities: activitiesResult.count || 0,
          todayActivities,
          activeSubscriptions: 2350, // Placeholder
          totalAdmins: adminCountResult.count || 0,
          totalModerators: moderatorCountResult.count || 0,
          totalEmployees: employeeCountResult.count || 0,
          activeUsersForAccess: activeProfilesCountResult.count || 0,
          inactiveUsers: inactiveProfilesCountResult.count || 0,
        },
        trends: {
          userGrowth: userGrowthPercent,
          activityGrowth: activityGrowthPercent,
        },
        charts: {
          adminActivity: adminActivityChartData,
          moderatorActivity: moderatorActivityChartData,
          employeeActivity: employeeActivityChartData,
          activityByRole: activityByRoleChartData,
          topAdmins,
          topModerators,
          topEmployees,
        },
        metadata: {
          fetchedAt: new Date().toISOString(),
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        },
      }
    }),

  // Get user-specific reports data
  getUserReportsData: protectedProcedure
    .input(
      z.object({
        days: z.number().default(30),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      const profileId = ctx.profile?.id || ctx.user?.id
      const now = new Date()
      const startDate = input.startDate
        ? new Date(input.startDate)
        : new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
      const endDate = input.endDate ? new Date(input.endDate) : now

      // Fetch user-specific data
      const [
        totalLoginsResult,
        activitiesResult,
        todayActivitiesResult,
        activityChartDataResult,
        usageChartDataResult,
      ] = await Promise.all([
        // Total logins (login activities)
        ctx.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId)
          .eq('activity_type', 'login'),

        // All user activities
        ctx.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId),

        // Today's activities
        ctx.supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId)
          .gte('created_at', new Date(now.setHours(0, 0, 0, 0)).toISOString()),

        // Activity data for chart (daily for last 7 days)
        ctx.supabase
          .from('activities')
          .select('created_at')
          .eq('user_id', profileId)
          .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true }),

        // Usage data (monthly for last 7 months)
        ctx.supabase
          .from('activities')
          .select('created_at')
          .eq('user_id', profileId)
          .gte('created_at', new Date(now.getTime() - 210 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true }),
      ])

      // Process activity chart data
      const activityMap = new Map<string, number>()
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      if (activityChartDataResult.data) {
        activityChartDataResult.data.forEach((activity: any) => {
          const date = new Date(activity.created_at)
          const dayKey = date.toISOString().split('T')[0]
          activityMap.set(dayKey, (activityMap.get(dayKey) || 0) + 1)
        })
      }

      const activityChartData = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dayKey = date.toISOString().split('T')[0]
        const dayName = dayNames[date.getDay()]
        activityChartData.push({
          name: dayName,
          activity: activityMap.get(dayKey) || 0,
        })
      }

      // Process usage chart data (monthly)
      const usageMap = new Map<string, number>()
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      if (usageChartDataResult.data) {
        usageChartDataResult.data.forEach((activity: any) => {
          const date = new Date(activity.created_at)
          const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
          usageMap.set(monthKey, (usageMap.get(monthKey) || 0) + 1)
        })
      }

      const usageChartData = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
        usageChartData.push({
          name: monthNames[date.getMonth()],
          users: usageMap.get(monthKey) || 0,
        })
      }

      // Get last login time
      const lastLoginResult = await ctx.supabase
        .from('activities')
        .select('created_at')
        .eq('user_id', profileId)
        .eq('activity_type', 'login')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastLogin = lastLoginResult.data?.created_at
        ? new Date(lastLoginResult.data.created_at)
        : null

      // Calculate trends
      const previousWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const previousWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const previousWeekActivities = await ctx.supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .gte('created_at', previousWeekStart.toISOString())
        .lt('created_at', previousWeekEnd.toISOString())

      const currentWeekActivities = await ctx.supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .gte('created_at', previousWeekEnd.toISOString())

      const previousWeekCount = previousWeekActivities.count || 0
      const currentWeekCount = currentWeekActivities.count || 0
      const activityTrendPercent = previousWeekCount > 0
        ? ((currentWeekCount - previousWeekCount) / previousWeekCount) * 100
        : 0

      // Calculate average session (mock for now)
      const averageSessionMinutes = 12

      return {
        stats: {
          totalLogins: totalLoginsResult.count || 0,
          totalActions: activitiesResult.count || 0,
          reportsGenerated: 24, // Placeholder
          averageSession: `${averageSessionMinutes}m`,
        },
        trends: {
          activityTrend: activityTrendPercent,
          sessionTrend: -14, // Placeholder
        },
        charts: {
          activity: activityChartData,
          usage: usageChartData,
        },
        lastLogin,
        metadata: {
          fetchedAt: new Date().toISOString(),
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        },
      }
    }),

  // Get user profile and statistics (unfiltered)
  getUserProfile: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Get user profile details
      const { data: profile, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('*, designation:designations(name)')
        .eq('id', input.userId)
        .single()

      if (profileError) {
        throw new Error(profileError.message)
      }

      if (!profile) {
        throw new Error('User not found')
      }

      // Get all activity statistics for this user (unfiltered)
      const { data: allActivities } = await ctx.supabase
        .from('activities')
        .select('activity_type, created_at')
        .eq('user_id', profile.id)

      const activityStats = {
        total: allActivities?.length || 0,
        byType: {} as Record<string, number>,
        lastActivity: allActivities && allActivities.length > 0
          ? new Date(Math.max(...allActivities.map(a => new Date(a.created_at).getTime())))
          : null,
      }

      if (allActivities) {
        allActivities.forEach(activity => {
          const type = activity.activity_type || 'unknown'
          activityStats.byType[type] = (activityStats.byType[type] || 0) + 1
        })
      }

      // Get unique modules for this user
      const { data: modulesData } = await ctx.supabase
        .from('activities')
        .select('module')
        .eq('user_id', profile.id)
        .not('module', 'is', null)

      const uniqueModules = Array.from(new Set(modulesData?.map(m => m.module) || []))

      return {
        profile,
        statistics: activityStats,
        modules: uniqueModules,
      }
    }),

  // Get filtered user activities
  getUserActivities: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        page: z.number().default(1),
        limit: z.number().default(10),
        activityType: z.union([z.string(), z.array(z.string())]).optional(),
        module: z.union([z.string(), z.array(z.string())]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Get user profile to resolve user_id (since input.userId is profile id)
      const { data: profile, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('id', input.userId)
        .single()

      if (profileError || !profile) {
        throw new Error('User not found')
      }

      // Build activity query
      let activityQuery = ctx.supabase
        .from('activities')
        .select('*', { count: 'exact' })
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      // Apply filters
      if (input.activityType) {
        if (Array.isArray(input.activityType)) {
          if (input.activityType.length > 0) {
            activityQuery = activityQuery.in('activity_type', input.activityType)
          }
        } else {
          activityQuery = activityQuery.eq('activity_type', input.activityType)
        }
      }

      if (input.startDate) {
        activityQuery = activityQuery.gte('created_at', input.startDate)
      }

      if (input.endDate) {
        activityQuery = activityQuery.lte('created_at', input.endDate)
      }

      if (input.module) {
        if (Array.isArray(input.module)) {
          if (input.module.length > 0) {
            activityQuery = activityQuery.in('module', input.module)
          }
        } else {
          activityQuery = activityQuery.eq('module', input.module)
        }
      }

      // Apply pagination
      const offset = (input.page - 1) * input.limit
      activityQuery = activityQuery.range(offset, offset + input.limit - 1)

      const { data: activities, error: activitiesError, count } = await activityQuery

      if (activitiesError) {
        throw new Error(activitiesError.message)
      }

      return {
        activities: activities || [],
        pagination: {
          page: input.page,
          limit: input.limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / input.limit),
        },
      }
    }),

  // Search users by name, email, or mobile number
  // Empty query returns all users (for reports/exports)
  searchUsers: adminProcedure
    .input(
      z.object({
        query: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      const searchQuery = input.query.trim()

      // Build query - if search is empty, return all users
      let query = ctx.supabase
        .from('profiles')
        .select('id, user_id, email, first_name, last_name, middle_name, mobile_no, avatar_url, role, created_at, sex, date_of_birth, status, designation:designations(name)')

      // Only apply search filter if query is not empty
      if (searchQuery.length > 0) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,middle_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,mobile_no.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query
        .limit(100) // Increased limit for report exports
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      return data || []
    }),

  // Get user details with activity logs
  getUserDetails: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        page: z.number().default(1),
        limit: z.number().default(10),
        activityType: z.union([z.string(), z.array(z.string())]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Get user profile details
      const { data: profile, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('*, designation:designations(name)')
        .eq('id', input.userId)
        .single()

      if (profileError) {
        throw new Error(profileError.message)
      }

      if (!profile) {
        throw new Error('User not found')
      }

      // Build activity query
      let activityQuery = ctx.supabase
        .from('activities')
        .select('*', { count: 'exact' })
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      // Apply filters
      if (input.activityType) {
        if (Array.isArray(input.activityType)) {
          if (input.activityType.length > 0) {
            activityQuery = activityQuery.in('activity_type', input.activityType)
          }
        } else {
          activityQuery = activityQuery.eq('activity_type', input.activityType)
        }
      }

      if (input.startDate) {
        activityQuery = activityQuery.gte('created_at', input.startDate)
      }

      if (input.endDate) {
        activityQuery = activityQuery.lte('created_at', input.endDate)
      }

      // Apply pagination
      const offset = (input.page - 1) * input.limit
      activityQuery = activityQuery.range(offset, offset + input.limit - 1)

      const { data: activities, error: activitiesError, count } = await activityQuery

      if (activitiesError) {
        throw new Error(activitiesError.message)
      }

      // Get activity statistics
      const { data: allActivities } = await ctx.supabase
        .from('activities')
        .select('activity_type, created_at')
        .eq('user_id', profile.id)

      const activityStats = {
        total: allActivities?.length || 0,
        byType: {} as Record<string, number>,
        lastActivity: allActivities && allActivities.length > 0
          ? new Date(Math.max(...allActivities.map(a => new Date(a.created_at).getTime())))
          : null,
      }

      if (allActivities) {
        allActivities.forEach(activity => {
          const type = activity.activity_type || 'unknown'
          activityStats.byType[type] = (activityStats.byType[type] || 0) + 1
        })
      }

      return {
        profile,
        activities: activities || [],
        pagination: {
          page: input.page,
          limit: input.limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / input.limit),
        },
        statistics: activityStats,
      }
    }),

  getUserStatusHistory: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      const { data, error } = await ctx.supabase
        .from('user_status_history')
        .select(`
          *,
          changed_by_profile:profiles!user_status_history_changed_by_fkey(full_name, email)
        `)
        .eq('profile_id', input.userId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)

      return data || []
    }),

  // Get all activities for reporting
  getAllActivities: adminProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      let query = ctx.supabase
        .from('activities')
        .select(`
          *,
          profile:profiles(id, first_name, last_name, middle_name, email, role)
        `)
        .order('created_at', { ascending: false })

      if (input.startDate) {
        query = query.gte('created_at', input.startDate)
      }

      if (input.endDate) {
        query = query.lte('created_at', input.endDate)
      }

      const { data, error } = await query.limit(1000)

      if (error) {
        throw new Error(error.message)
      }

      return data || []
    }),
})
