// ============================================
// lib/trpc/routers/moderator-reports.ts
// Reports and Analytics Router for Moderator
// ============================================
import { z } from 'zod'
import { router, moderatorProcedure, protectedProcedure } from '../server'

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
            if (!ctx.supabase) {
                throw new Error('Supabase client not available')
            }

            const now = new Date()
            const startDate = input.startDate
                ? new Date(input.startDate)
                : new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
            const endDate = input.endDate ? new Date(input.endDate) : now

            // Fetch required data in parallel - filtered for moderators
            const [
                totalUsersResult,
                activeUsersResult,
                activitiesResult,
                todayActivitiesResult,
                activitiesInPeriodResult,
                profilesResult,
                moderatorCountResult,
                employeeCountResult,
            ] = await Promise.all([
                // Total users count (can see all users count usually)
                ctx.supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true }),

                // Active users (last 7 days)
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
                    .gte('created_at', new Date(now.setHours(0, 0, 0, 0)).toISOString()),

                // Activities in selected period for aggregation
                ctx.supabase
                    .from('activities')
                    .select('activity_type, user_id')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString()),

                // User profiles (fetch id, role, name details)
                ctx.supabase
                    .from('profiles')
                    .select('id, user_id, role, first_name, last_name, email, avatar_url'),

                // Total Moderators Count
                ctx.supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'moderator'),

                // Total Employees Count
                ctx.supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'employee'),
            ])

            // Process Activity by User
            const userActivityCounts = new Map<string, number>()

            if (activitiesInPeriodResult.data) {
                activitiesInPeriodResult.data.forEach((activity: any) => {
                    if (activity.user_id) {
                        userActivityCounts.set(activity.user_id, (userActivityCounts.get(activity.user_id) || 0) + 1)
                    }
                })
            }

            const moderatorUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []
            const employeeUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []
            const regularUsers: { user_id: string, name: string, count: number, email: string, avatar_url: string | null }[] = []

            if (profilesResult.data) {
                profilesResult.data.forEach((profile: any) => {
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

                        if (profile.role === 'moderator') {
                            moderatorUsers.push(userData)
                        } else if (profile.role === 'employee') {
                            employeeUsers.push(userData)
                        } else if (profile.role === 'user') {
                            regularUsers.push(userData)
                        }
                    }
                })
            }

            // Sort and substring top 5
            const topModerators = moderatorUsers.sort((a, b) => b.count - a.count).slice(0, 5)
            const topEmployees = employeeUsers.sort((a, b) => b.count - a.count).slice(0, 5)
            const topUsers = regularUsers.sort((a, b) => b.count - a.count).slice(0, 5)

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
                    // Total count only
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

            // Moderators can see their own breakdown and employee breakdown
            // But we will follow the same pattern as admin for consistency
            const moderatorActivityChartData = prepareBreakdownChartData(topModerators, true)
            const employeeActivityChartData = prepareBreakdownChartData(topEmployees, false)

            // Calculate unique active users
            const uniqueActiveUserIds = new Set(
                activeUsersResult.data?.map((a: any) => a.user_id) || []
            )
            const activeUsersCount = uniqueActiveUserIds.size

            // Calculate trends
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
                    totalModerators: moderatorCountResult.count || 0,
                    totalEmployees: employeeCountResult.count || 0,
                },
                trends: {
                    userGrowth: userGrowthPercent,
                    activityGrowth: activityGrowthPercent,
                },
                charts: {
                    moderatorActivity: moderatorActivityChartData,
                    employeeActivity: employeeActivityChartData,
                    topModerators,
                    topEmployees,
                    topUsers,
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

    // Search users for moderator (limited to non-admin roles usually, but consistent for now)
    searchUsers: moderatorProcedure
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

            let query = ctx.supabase
                .from('profiles')
                .select('id, user_id, email, first_name, last_name, middle_name, mobile_no, avatar_url, role, created_at, sex, date_of_birth, status, designation:designations(name)')
                .neq('role', 'admin') // Filter out admins for moderators

            if (searchQuery.length > 0) {
                query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,middle_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,mobile_no.ilike.%${searchQuery}%`)
            }

            const { data, error } = await query
                .limit(100)
                .order('created_at', { ascending: false })

            if (error) {
                throw new Error(error.message)
            }

            return data || []
        }),

    getUserProfile: moderatorProcedure
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
                .neq('role', 'admin') // Prevent viewing admin profiles
                .single()

            if (profileError) {
                throw new Error(profileError.message)
            }

            if (!profile) {
                throw new Error('User not found or access denied')
            }

            // Get all activity statistics for this user
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
            if (!ctx.supabase) {
                throw new Error('Supabase client not available')
            }

            // Get user profile and ensure it's not an admin
            const { data: profile, error: profileError } = await ctx.supabase
                .from('profiles')
                .select('id, role')
                .eq('id', input.userId)
                .neq('role', 'admin')
                .single()

            if (profileError || !profile) {
                throw new Error('User not found or access denied')
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

    // Get all activities for reporting (non-admin)
    getAllActivities: moderatorProcedure
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
                .neq('profile.role', 'admin') // Moderators shouldn't see admin activity if any, though RLS should handle it
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
