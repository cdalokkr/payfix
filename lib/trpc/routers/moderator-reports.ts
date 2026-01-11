// ============================================
// lib/trpc/routers/moderator-reports.ts
// Reports and Analytics Router for Moderator
// ============================================
import { z } from 'zod'
import { router, moderatorProcedure, protectedProcedure } from '../server'
import { profiles, activities } from '@/lib/db/schema'
import { eq, and, gte, lte, count, sql, desc, or, ilike, ne, SQL } from 'drizzle-orm'

export const moderatorReportsRouter = router({
    // Get comprehensive reports data for moderator
    getReportsData: moderatorProcedure
        .input(
            z.object({
                days: z.number().default(30),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const now = new Date()
            const startDate = input.startDate ? new Date(input.startDate) : new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
            const endDate = input.endDate ? new Date(input.endDate) : now

            const [
                totalUsersResult,
                activeUsersResult,
                totalActivitiesResult,
                todayActivitiesResult,
                activitiesInPeriod,
                profilesData,
                moderatorCountResult,
                employeeCountResult,
            ] = await Promise.all([
                ctx.db.select({ value: count() }).from(profiles),
                ctx.db.select({ user_id: activities.user_id }).from(activities).where(gte(activities.created_at, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))),
                ctx.db.select({ value: count() }).from(activities),
                ctx.db.select({ value: count() }).from(activities).where(gte(activities.created_at, new Date(new Date().setHours(0, 0, 0, 0)))),
                ctx.db.query.activities.findMany({
                    where: and(gte(activities.created_at, startDate), lte(activities.created_at, endDate)),
                    columns: { activity_type: true, user_id: true }
                }),
                ctx.db.query.profiles.findMany({
                    columns: { id: true, role: true, first_name: true, last_name: true, email: true, avatar_url: true }
                }),
                ctx.db.select({ value: count() }).from(profiles).where(eq(profiles.role, 'moderator')),
                ctx.db.select({ value: count() }).from(profiles).where(eq(profiles.role, 'employee')),
            ])

            // Process Activity by User
            const userActivityCounts = new Map<string, number>()
            activitiesInPeriod.forEach((activity: any) => {
                if (activity.user_id) {
                    userActivityCounts.set(activity.user_id, (userActivityCounts.get(activity.user_id) || 0) + 1)
                }
            })

            const moderatorUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []
            const employeeUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []

            profilesData.forEach((profile: any) => {
                const count = userActivityCounts.get(profile.id) || 0
                if (count > 0) {
                    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
                    const userData = { user_id: profile.id, name, count, email: profile.email, avatar_url: profile.avatar_url }
                    if (profile.role === 'moderator') moderatorUsers.push(userData)
                    else employeeUsers.push(userData)
                }
            })

            const topModerators = moderatorUsers.sort((a, b) => b.count - a.count).slice(0, 5)
            const topEmployees = employeeUsers.sort((a, b) => b.count - a.count).slice(0, 5)

            const prepareBreakdownChartData = (topUsers: any[], showBreakdown: boolean = true) => {
                const topUserIds = new Set(topUsers.map(u => u.user_id))
                if (showBreakdown) {
                    const activityTypesMap = new Map<string, Map<string, number>>()
                    const allActivityTypes = new Set<string>()
                    activitiesInPeriod.forEach((activity: any) => {
                        if (activity.user_id && topUserIds.has(activity.user_id)) {
                            const type = activity.activity_type || 'unknown'
                            allActivityTypes.add(type)
                            if (!activityTypesMap.has(activity.user_id)) activityTypesMap.set(activity.user_id, new Map())
                            const userTypes = activityTypesMap.get(activity.user_id)!
                            userTypes.set(type, (userTypes.get(type) || 0) + 1)
                        }
                    })
                    const chartLabels = Array.from(allActivityTypes).sort()
                    const chartDatasets = topUsers.map((user, index) => {
                        const userTypes = activityTypesMap.get(user.user_id) || new Map()
                        const data = chartLabels.map(label => userTypes.get(label) || 0)
                        const colors = ['rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)', 'rgba(153, 102, 255, 0.5)']
                        const borderColors = ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)']
                        return { label: user.name, data, backgroundColor: colors[index % colors.length], borderColor: borderColors[index % borderColors.length], borderWidth: 2 }
                    })
                    return { labels: chartLabels, datasets: chartDatasets }
                } else {
                    return { labels: ['Total Activities'], datasets: topUsers.map((user, index) => ({ label: user.name, data: [user.count], backgroundColor: ['rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)', 'rgba(153, 102, 255, 0.5)'][index % 5], borderColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'][index % 5], borderWidth: 2 })) }
                }
            }

            const moderatorActivityChartData = prepareBreakdownChartData(topModerators, true)
            const employeeActivityChartData = prepareBreakdownChartData(topEmployees, false)

            const activeUsersCount = new Set(activeUsersResult.map(a => a.user_id)).size

            const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
            const [previousTotalUsers, previousTodayActivities] = await Promise.all([
                ctx.db.select({ value: count() }).from(profiles).where(lte(profiles.created_at, startDate)),
                ctx.db.select({ value: count() }).from(activities).where(and(gte(activities.created_at, new Date(previousStartDate.setHours(0, 0, 0, 0))), lte(activities.created_at, startDate))),
            ])

            const totalUsers = totalUsersResult[0].value
            const previousTotalUsersCount = previousTotalUsers[0].value
            const userGrowthPercent = previousTotalUsersCount > 0 ? ((totalUsers - previousTotalUsersCount) / previousTotalUsersCount) * 100 : 0

            const todayActivities = todayActivitiesResult[0].value
            const previousTodayActivitiesCount = previousTodayActivities[0].value
            const activityGrowthPercent = previousTodayActivitiesCount > 0 ? ((todayActivities - previousTodayActivitiesCount) / previousTodayActivitiesCount) * 100 : 0

            return {
                stats: {
                    totalUsers,
                    activeUsers: activeUsersCount,
                    totalActivities: totalActivitiesResult[0].value,
                    todayActivities,
                    totalModerators: moderatorCountResult[0].value,
                    totalEmployees: employeeCountResult[0].value,
                },
                trends: { userGrowth: userGrowthPercent, activityGrowth: activityGrowthPercent },
                charts: { moderatorActivity: moderatorActivityChartData, employeeActivity: employeeActivityChartData, topModerators, topEmployees },
                metadata: { fetchedAt: new Date().toISOString(), dateRange: { start: startDate.toISOString(), end: endDate.toISOString() } },
            }
        }),

    // Search users for moderator (limited to non-admin roles usually, but consistent for now)
    searchUsers: moderatorProcedure
        .input(
            z.object({
                query: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            const searchQuery = input.query.trim()
            let filters: (SQL | undefined)[] = [ne(profiles.role, 'admin')]

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
                where: and(...filters),
                with: { designation: true },
                limit: 100,
                orderBy: [desc(profiles.created_at)],
            })

            return data.map(u => ({
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
            })) || []
        }),

    getUserProfile: moderatorProcedure
        .input(
            z.object({
                userId: z.string().uuid(),
            })
        )
        .query(async ({ ctx, input }) => {
            const profileData = await ctx.db.query.profiles.findFirst({
                where: and(eq(profiles.id, input.userId), ne(profiles.role, 'admin')),
                with: { designation: true }
            })

            if (!profileData) throw new Error('User not found or access denied')

            const allActivities = await ctx.db.query.activities.findMany({
                where: eq(activities.user_id, profileData.id),
                columns: { activity_type: true, created_at: true, module: true }
            })

            const activityStats = {
                total: allActivities?.length || 0,
                byType: {} as Record<string, number>,
                lastActivity: allActivities && allActivities.length > 0
                    ? new Date(Math.max(...allActivities.map(a => (a.created_at ? new Date(a.created_at).getTime() : 0))))
                    : null,
            }

            if (allActivities) {
                allActivities.forEach(activity => {
                    const type = activity.activity_type || 'unknown'
                    activityStats.byType[type] = (activityStats.byType[type] || 0) + 1
                })
            }

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
                },
                statistics: activityStats,
                modules: uniqueModules,
            }
        }),

    getUserActivities: moderatorProcedure
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
            const profileData = await ctx.db.query.profiles.findFirst({
                where: and(eq(profiles.id, input.userId), ne(profiles.role, 'admin')),
            })

            if (!profileData) throw new Error('User not found or access denied')

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

    // Get all activities for reporting (non-admin)
    getAllActivities: moderatorProcedure
        .input(
            z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        )
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

            // Filter out admin results if any (RLS should handle it, but for safety)
            return data.filter(a => a.profile?.role !== 'admin').map(a => ({
                ...a,
                created_at: a.created_at ? a.created_at.toISOString() : null,
                user_id: a.user_id as string,
                profile: a.profile ? {
                    ...a.profile,
                    created_at: a.profile.created_at ? a.profile.created_at.toISOString() : null,
                    updated_at: a.profile.updated_at ? a.profile.updated_at.toISOString() : null,
                    user_id: a.profile.id,
                    role: a.profile.role as any,
                } : null
            })) || []
        }),
})
