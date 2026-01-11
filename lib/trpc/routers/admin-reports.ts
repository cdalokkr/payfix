// ============================================
// lib/trpc/routers/admin-reports.ts
// Reports and Analytics Router for Admin
// ============================================
import { z } from 'zod'
import { router, adminProcedure, protectedProcedure } from '../server'
import { profiles, activities, attendance, userStatusHistory } from '@/lib/db/schema'
import { eq, and, gte, lte, count, sql, desc, or, ilike, ne } from 'drizzle-orm'

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

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const [
        roleCounts,
        statusCounts,
        activityStats,
        activeUsersResult,
        activitiesInPeriod,
        profilesData,
      ] = await Promise.all([
        // 1. Consolidated Role counts
        ctx.db.select({ role: profiles.role, count: count() }).from(profiles).groupBy(profiles.role),

        // 2. Consolidated Status counts
        ctx.db.select({ status: profiles.status, count: count() }).from(profiles).groupBy(profiles.status),

        // 3. Consolidated Activity stats (Total and Today)
        ctx.db.select({
          total: count(),
          today: sql<number>`count(*) filter (where ${activities.created_at} >= ${todayStart.toISOString()}::timestamp)`
        }).from(activities),

        // 4. Active users (last 7 days)
        ctx.db.select({ user_id: activities.user_id })
          .from(activities)
          .where(gte(activities.created_at, sevenDaysAgo)),

        // 5. Activities in the requested period
        ctx.db.query.activities.findMany({
          where: and(
            gte(activities.created_at, startDate),
            lte(activities.created_at, endDate)
          ),
          columns: { activity_type: true, user_id: true }
        }),

        // 6. Profiles data
        ctx.db.query.profiles.findMany({
          columns: { id: true, role: true, first_name: true, last_name: true, email: true, avatar_url: true }
        }),
      ])

      // Map consolidated results back to original variables or stats object
      const totalUsers = roleCounts.reduce((acc, curr) => acc + Number(curr.count), 0)
      const getRoleCount = (role: string) => Number(roleCounts.find(r => r.role === role)?.count || 0)
      const getStatusCount = (status: string) => Number(statusCounts.find(s => s.status === status)?.count || 0)

      const adminCount = getRoleCount('admin')
      const employeeCount = getRoleCount('employee')
      const moderatorCount = getRoleCount('moderator')
      const activeProfilesCount = getStatusCount('active')
      const inactiveProfilesCount = getStatusCount('deactive')
      const totalActivities = Number(activityStats[0]?.total || 0)
      const todayActivities = Number(activityStats[0]?.today || 0)

      // Process Activity by User
      const userActivityCounts = new Map<string, number>()

      if (activitiesInPeriod) {
        activitiesInPeriod.forEach((activity: any) => {
          if (activity.user_id) {
            userActivityCounts.set(activity.user_id, (userActivityCounts.get(activity.user_id) || 0) + 1)
          }
        })
      }

      const adminUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []
      const moderatorUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []
      const employeeUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []

      if (profilesData) {
        profilesData.forEach((profile: any) => {
          const count = userActivityCounts.get(profile.id) || 0
          if (count > 0) {
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
            const userData = {
              user_id: profile.id,
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

          if (activitiesInPeriod) {
            activitiesInPeriod.forEach((activity: any) => {
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

      // Process Activity By Role Data
      const roleMap = new Map<string, string>()
      if (profilesData) {
        profilesData.forEach((user: any) => {
          if (user.id) roleMap.set(user.id, user.role)
        })
      }

      const activityRoleCounts = new Map<string, { admin: number, employee: number }>()

      if (activitiesInPeriod) {
        activitiesInPeriod.forEach((activity: any) => {
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

      // Calculate trends (compare with previous period)
      const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))

      const [previousStats, previousTodayActivities] = await Promise.all([
        ctx.db.select({ value: count() }).from(profiles).where(lte(profiles.created_at, startDate)),
        ctx.db.select({ value: count() }).from(activities).where(
          and(
            gte(activities.created_at, previousStartDate),
            lte(activities.created_at, startDate)
          )
        ),
      ])

      const previousTotalUsersCount = previousStats[0]?.value || 0
      const userGrowthPercent = previousTotalUsersCount > 0
        ? ((totalUsers - previousTotalUsersCount) / previousTotalUsersCount) * 100
        : 0

      const previousTodayActivitiesCount = previousTodayActivities[0]?.value || 0
      const activityGrowthPercent = previousTodayActivitiesCount > 0
        ? ((todayActivities - previousTodayActivitiesCount) / previousTodayActivitiesCount) * 100
        : 0

      // Calculate unique active users
      const activeUsersCount = new Set(activeUsersResult.map((a: any) => a.user_id)).size

      return {
        stats: {
          totalUsers,
          activeUsers: activeUsersCount,
          totalActivities,
          todayActivities,
          activeSubscriptions: 2350, // Placeholder
          totalAdmins: adminCount,
          totalModerators: moderatorCount,
          totalEmployees: employeeCount,
          activeUsersForAccess: activeProfilesCount,
          inactiveUsers: inactiveProfilesCount,
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
      const profileId = ctx.profile?.id || ctx.user?.id
      if (!profileId) throw new Error('Unauthorized')

      const now = new Date()
      const startDate = input.startDate ? new Date(input.startDate) : new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
      const endDate = input.endDate ? new Date(input.endDate) : now

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const [
        mainStats,
        weeklyStats,
        activityChartDataRaw,
        usageChartDataRaw,
        lastLoginResult,
      ] = await Promise.all([
        // 1. Consolidated Main Stats
        ctx.db.select({
          totalLogins: sql<number>`count(*) filter (where ${activities.activity_type} = 'login')`,
          totalActions: count(),
          todayActivities: sql<number>`count(*) filter (where ${activities.created_at} >= ${todayStart.toISOString()}::timestamp)`
        }).from(activities).where(eq(activities.user_id, profileId)),

        // 2. Consolidated Weekly Trend Stats
        ctx.db.select({
          currentWeek: sql<number>`count(*) filter (where ${activities.created_at} >= ${weekAgo.toISOString()}::timestamp)`,
          previousWeek: sql<number>`count(*) filter (where ${activities.created_at} >= ${twoWeeksAgo.toISOString()}::timestamp and ${activities.created_at} < ${weekAgo.toISOString()}::timestamp)`
        }).from(activities).where(eq(activities.user_id, profileId)),

        // 3. Activity Chart Data (last 7 days)
        ctx.db.select({ created_at: activities.created_at })
          .from(activities)
          .where(and(eq(activities.user_id, profileId), gte(activities.created_at, weekAgo)))
          .orderBy(desc(activities.created_at)),

        // 4. Usage Chart Data (last 210 days)
        ctx.db.select({ created_at: activities.created_at })
          .from(activities)
          .where(and(eq(activities.user_id, profileId), gte(activities.created_at, new Date(now.getTime() - 210 * 24 * 60 * 60 * 1000))))
          .orderBy(desc(activities.created_at)),

        // 5. Last Login
        ctx.db.select({ created_at: activities.created_at })
          .from(activities)
          .where(and(eq(activities.user_id, profileId), eq(activities.activity_type, 'login')))
          .orderBy(desc(activities.created_at))
          .limit(1),
      ])

      const totalLogins = Number(mainStats[0]?.totalLogins || 0)
      const totalActions = Number(mainStats[0]?.totalActions || 0)
      const todayActivities = Number(mainStats[0]?.todayActivities || 0)
      const currentWeek = Number(weeklyStats[0]?.currentWeek || 0)
      const previousWeek = Number(weeklyStats[0]?.previousWeek || 0)

      // Process activity chart data
      const activityMap = new Map<string, number>()
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      if (activityChartDataRaw) {
        activityChartDataRaw.forEach((activity: any) => {
          if (!activity.created_at) return
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

      if (usageChartDataRaw) {
        usageChartDataRaw.forEach((activity: any) => {
          if (!activity.created_at) return
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

      const lastLogin = (lastLoginResult && lastLoginResult[0] && lastLoginResult[0].created_at)
        ? new Date(lastLoginResult[0].created_at)
        : null

      // Calculate trends
      const activityTrendPercent = previousWeek > 0
        ? ((currentWeek - previousWeek) / previousWeek) * 100
        : 0

      // Calculate average session (mock for now)
      const averageSessionMinutes = 12

      return {
        stats: {
          totalLogins,
          totalActions,
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
        lastLogin: lastLogin ? lastLogin.toISOString() : null,
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
      // Get user profile details
      const profileData = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.id, input.userId),
        with: { designation: true }
      })

      if (!profileData) {
        throw new Error('User not found')
      }

      // Get all activity statistics for this user (unfiltered)
      const allActivities = await ctx.db.query.activities.findMany({
        where: eq(activities.user_id, profileData.id),
        columns: { activity_type: true, created_at: true, module: true }
      })

      const activityStats = {
        total: allActivities?.length || 0,
        byType: {} as Record<string, number>,
        lastActivity: allActivities && allActivities.length > 0
          ? new Date(Math.max(...allActivities.map(a => a.created_at ? new Date(a.created_at).getTime() : 0)))
          : null,
      }

      if (allActivities) {
        allActivities.forEach(activity => {
          const type = activity.activity_type || 'unknown'
          activityStats.byType[type] = (activityStats.byType[type] || 0) + 1
        })
      }

      // Get unique modules
      const uniqueModules = Array.from(new Set(allActivities?.map(m => m.module).filter(Boolean)))

      return {
        profile: {
          ...profileData,
          created_at: profileData.created_at ? profileData.created_at.toISOString() : null,
          updated_at: profileData.updated_at ? profileData.updated_at.toISOString() : null,
          user_id: profileData.id,
          role: profileData.role as any,
          designation: profileData.designation ? {
            ...profileData.designation,
            created_at: profileData.designation.created_at ? profileData.designation.created_at.toISOString() : null,
            updated_at: profileData.designation.updated_at ? profileData.designation.updated_at.toISOString() : null,
            role: profileData.designation.role as any,
          } : null
        } as any,
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
      let filters = [eq(activities.user_id, input.userId)]

      if (input.activityType) {
        if (Array.isArray(input.activityType)) {
          if (input.activityType.length > 0) filters.push(sql`${activities.activity_type} IN ${input.activityType}`)
        } else {
          filters.push(eq(activities.activity_type, input.activityType as any))
        }
      }

      if (input.startDate) filters.push(gte(activities.created_at, new Date(input.startDate)))
      if (input.endDate) filters.push(lte(activities.created_at, new Date(input.endDate)))

      if (input.module) {
        if (Array.isArray(input.module)) {
          if (input.module.length > 0) filters.push(sql`${activities.module} IN ${input.module}`)
        } else {
          filters.push(eq(activities.module, input.module))
        }
      }

      const where = and(...filters)

      const totalResult = await ctx.db.select({ value: count() }).from(activities).where(where)
      const total = totalResult[0].value

      const data = await ctx.db.query.activities.findMany({
        where,
        orderBy: [desc(activities.created_at)],
        limit: input.limit,
        offset: (input.page - 1) * input.limit,
      })

      return {
        activities: (data || []).map(a => ({
          ...a,
          created_at: a.created_at ? a.created_at.toISOString() : null,
          user_id: a.user_id as string,
        })),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
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
      const searchQuery = input.query.trim()
      let filters = []

      if (searchQuery.length > 0) {
        filters.push(
          or(
            ilike(profiles.first_name, `%${searchQuery}%`),
            ilike(profiles.last_name, `%${searchQuery}%`),
            ilike(profiles.middle_name, `%${searchQuery}%`),
            ilike(profiles.email, `%${searchQuery}%`),
            ilike(profiles.mobile_no, `%${searchQuery}%`)
          )
        )
      }

      const data = await ctx.db.query.profiles.findMany({
        where: filters.length > 0 ? and(...filters) : undefined,
        with: { designation: true },
        limit: 100,
        orderBy: [desc(profiles.created_at)],
      })

      return (data || []).map(u => ({
        ...u,
        created_at: u.created_at ? u.created_at.toISOString() : null,
        updated_at: u.updated_at ? u.updated_at.toISOString() : null,
        user_id: u.id,
        role: u.role as any,
        designation: u.designation ? {
          ...u.designation,
          created_at: u.designation.created_at ? u.designation.created_at.toISOString() : null,
          updated_at: u.designation.updated_at ? u.designation.updated_at.toISOString() : null,
          role: u.designation.role as any,
        } : null
      }))
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
      // Get user profile details
      const profileData = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.id, input.userId),
        with: { designation: true }
      })

      if (!profileData) throw new Error('User not found')

      // Build activity filters
      let filters = [eq(activities.user_id, profileData.id)]
      if (input.activityType) {
        if (Array.isArray(input.activityType)) {
          if (input.activityType.length > 0) filters.push(sql`${activities.activity_type} IN ${input.activityType}`)
        } else {
          filters.push(eq(activities.activity_type, input.activityType as any))
        }
      }
      if (input.startDate) filters.push(gte(activities.created_at, new Date(input.startDate)))
      if (input.endDate) filters.push(lte(activities.created_at, new Date(input.endDate)))

      const where = and(...filters)

      // Get activities paginated and total count
      const [totalResult, paginatedActivities, allActivities] = await Promise.all([
        ctx.db.select({ value: count() }).from(activities).where(where),
        ctx.db.query.activities.findMany({
          where,
          orderBy: [desc(activities.created_at)],
          limit: input.limit,
          offset: (input.page - 1) * input.limit,
        }),
        ctx.db.query.activities.findMany({
          where: eq(activities.user_id, profileData.id),
          columns: { activity_type: true, created_at: true }
        })
      ])

      const total = totalResult[0].value

      const activityStats = {
        total: allActivities?.length || 0,
        byType: {} as Record<string, number>,
        lastActivity: allActivities && allActivities.length > 0
          ? new Date(Math.max(...allActivities.map(a => a.created_at ? new Date(a.created_at).getTime() : 0)))
          : null,
      }

      if (allActivities) {
        allActivities.forEach(activity => {
          const type = activity.activity_type || 'unknown'
          activityStats.byType[type] = (activityStats.byType[type] || 0) + 1
        })
      }

      return {
        profile: {
          ...profileData,
          created_at: profileData.created_at ? profileData.created_at.toISOString() : null,
          updated_at: profileData.updated_at ? profileData.updated_at.toISOString() : null,
          user_id: profileData.id,
          role: profileData.role as any,
          designation: profileData.designation ? {
            ...profileData.designation,
            created_at: profileData.designation.created_at ? profileData.designation.created_at.toISOString() : null,
            updated_at: profileData.designation.updated_at ? profileData.designation.updated_at.toISOString() : null,
            role: profileData.designation.role as any,
          } : null
        },
        activities: (paginatedActivities || []).map(a => ({
          ...a,
          created_at: a.created_at ? a.created_at.toISOString() : null,
          user_id: a.user_id as string,
        })),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
        statistics: activityStats,
      }
    }),
  getUserStatusHistory: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.userStatusHistory.findMany({
        where: eq(userStatusHistory.profile_id, input.userId),
        with: {
          actor: {
            columns: { full_name: true, email: true }
          }
        },
        orderBy: [desc(userStatusHistory.created_at)]
      })
      return data || []
    }),

  getAllActivities: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let filters = []
      if (input.startDate) filters.push(gte(activities.created_at, new Date(input.startDate)))
      if (input.endDate) filters.push(lte(activities.created_at, new Date(input.endDate)))

      const data = await ctx.db.query.activities.findMany({
        where: filters.length > 0 ? and(...filters) : undefined,
        with: {
          profile: true
        },
        orderBy: [desc(activities.created_at)],
        limit: 1000
      })

      return data || []
    }),
})
