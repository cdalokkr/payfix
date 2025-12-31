// ============================================
// lib/trpc/routers/attendance.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, moderatorProcedure } from '../server'
import { TRPCError } from '@trpc/server'
import { attendance, profiles, leaves, officeSettings, officeClosures, activities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export const attendanceRouter = router({
    // --- ATTENDANCE ---

    getAttendance: protectedProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const startTime = performance.now()

            // Drizzle Query
            let whereClause = []

            if (ctx.profile.role === 'employee') {
                whereClause.push(eq(attendance.profile_id, ctx.profile.id))
            } else if (input.profileId) {
                whereClause.push(eq(attendance.profile_id, input.profileId))
            }

            if (input.startDate) whereClause.push(gte(attendance.date, input.startDate))
            if (input.endDate) whereClause.push(lte(attendance.date, input.endDate))

            const data = await ctx.db.query.attendance.findMany({
                where: and(...whereClause),
                with: {
                    profile: {
                        columns: {
                            email: true,
                            full_name: true
                        }
                    }
                },
                orderBy: [desc(attendance.date)]
            })

            const duration = performance.now() - startTime
            if (process.env.NODE_ENV === 'development') {
                console.log(`[DRIZZLE-PERF] getAttendance: ${duration.toFixed(2)}ms`)
            }

            // Map results to ensure numeric types are numbers for the frontend
            return data.map(item => ({
                ...item,
                working_hours: item.working_hours ? Number(item.working_hours) : null
            }))
        }),

    clockIn: protectedProcedure
        .input(z.object({
            localDate: z.string().optional(),
            isExtraDay: z.boolean().optional()
        }).optional())
        .mutation(async ({ ctx, input }) => {
            const today = input?.localDate || new Date().toISOString().split('T')[0]

            // Check if already clocked in today using Drizzle
            const existing = await ctx.db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, ctx.profile.id),
                    eq(attendance.date, today)
                ),
                columns: { id: true }
            })

            if (existing) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already clocked in for today.' })
            }

            // Insert attendance record using Drizzle
            const [data] = await ctx.db.insert(attendance).values({
                profile_id: ctx.profile.id,
                date: today,
                check_in: new Date(),
                status: 'pending',
                is_extra_day: input?.isExtraDay || false
            }).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create clock-in record' })

            // Log activity using Drizzle
            await ctx.db.insert(activities).values({
                user_id: ctx.profile.id,
                activity_type: 'data_create',
                module: 'attendance',
                description: `${ctx.profile.full_name || ctx.profile.email} clocked in at ${new Date().toLocaleTimeString()}`,
            })

            return data
        }),

    clockOut: protectedProcedure
        .input(z.object({
            localDate: z.string().optional()
        }).optional())
        .mutation(async ({ ctx, input }) => {
            const today = input?.localDate || new Date().toISOString().split('T')[0]

            // Try to find today's record first using Drizzle
            let record = await ctx.db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, ctx.profile.id),
                    eq(attendance.date, today)
                ),
                columns: { id: true, check_in: true, check_out: true, date: true }
            })

            // If no record for today, look for the most recent pending record (stale session)
            if (!record) {
                record = await ctx.db.query.attendance.findFirst({
                    where: and(
                        eq(attendance.profile_id, ctx.profile.id),
                        sql`${attendance.check_out} IS NULL`
                    ),
                    orderBy: [desc(attendance.date)]
                })
            }

            if (!record) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'No clock-in record found to clock out.' })
            }

            if (record.check_out) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already clocked out for this session.' })
            }

            // Update record using Drizzle
            const [data] = await ctx.db.update(attendance).set({
                check_out: new Date(),
                updated_at: new Date()
            }).where(eq(attendance.id, record.id)).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update clock-out record' })

            // Log activity
            await ctx.db.insert(activities).values({
                user_id: ctx.profile.id,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `${ctx.profile.full_name || ctx.profile.email} clocked out at ${new Date().toLocaleTimeString()}`,
            })

            return data
        }),

    verifyAttendance: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            status: z.enum(['verified', 'rejected']),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const [data] = await ctx.db.update(attendance).set({
                status: input.status,
                remarks: input.remarks,
                verified_by: ctx.profile.id,
                updated_at: new Date()
            }).where(eq(attendance.id, input.id)).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to verify attendance' })

            const today = new Date().toISOString().split('T')[0]

            // Log activity for real-time update
            await ctx.db.insert(activities).values({
                user_id: data.profile_id,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `Attendance record for ${today} was ${input.status} by ${ctx.profile.full_name || ctx.profile.email}`,
            })

            return data
        }),

    manualUpdate: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            checkIn: z.string().optional(),
            checkOut: z.string().optional(),
            status: z.enum(['pending', 'verified', 'rejected']).optional(),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const updateData: any = {
                updated_at: new Date()
            }
            if (input.checkIn) updateData.check_in = new Date(input.checkIn)
            if (input.checkOut) updateData.check_out = new Date(input.checkOut)
            if (input.status) updateData.status = input.status
            if (input.remarks) updateData.remarks = input.remarks

            const [data] = await ctx.db.update(attendance)
                .set(updateData)
                .where(eq(attendance.id, input.id))
                .returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update attendance record' })

            // Log activity for real-time update
            await ctx.db.insert(activities).values({
                user_id: data.profile_id,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `Attendance record for ${data.date} was manually updated by ${ctx.profile.full_name || ctx.profile.email}`,
            })

            return data
        }),

    // --- LEAVES ---

    getLeaves: protectedProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
        }))
        .query(async ({ ctx, input }) => {
            let whereClause = []

            if (ctx.profile.role === 'employee') {
                whereClause.push(eq(leaves.profile_id, ctx.profile.id))
            } else if (input.profileId) {
                whereClause.push(eq(leaves.profile_id, input.profileId))
            }

            if (input.status !== 'all') {
                whereClause.push(eq(leaves.status, input.status))
            }

            return await ctx.db.query.leaves.findMany({
                where: and(...whereClause),
                with: {
                    profile: {
                        columns: {
                            email: true,
                            full_name: true
                        }
                    }
                },
                orderBy: [desc(leaves.created_at)]
            })
        }),

    applyLeave: protectedProcedure
        .input(z.object({
            leaveType: z.string().optional(),
            startDate: z.string(),
            endDate: z.string(),
            reason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const [data] = await ctx.db.insert(leaves).values({
                profile_id: ctx.profile.id,
                leave_type: input.leaveType,
                start_date: input.startDate,
                endDate: input.endDate,
                reason: input.reason,
                status: 'pending'
            }).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to apply for leave' })

            return data
        }),

    approveLeave: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            status: z.enum(['approved', 'rejected']),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const [data] = await ctx.db.update(leaves).set({
                status: input.status,
                remarks: input.remarks,
                approved_by: ctx.profile.id,
                updated_at: new Date()
            }).where(eq(leaves.id, input.id)).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to approve leave' })

            return data
        }),

    // --- SETTINGS ---

    getOfficeSettings: protectedProcedure
        .query(async ({ ctx }) => {
            const data = await ctx.db.query.officeSettings.findFirst()
            if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Office settings not found' })
            return data
        }),

    updateOfficeSettings: moderatorProcedure
        .input(z.object({
            defaultCheckIn: z.string(),
            defaultCheckOut: z.string(),
            offDays: z.array(z.number()),
            dailyWorkingHours: z.record(z.string(), z.object({
                checkIn: z.string(),
                checkOut: z.string()
            })).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const current = await ctx.db.query.officeSettings.findFirst({
                columns: { id: true }
            })

            if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Office settings not found' })

            const [data] = await ctx.db.update(officeSettings).set({
                default_check_in: input.defaultCheckIn,
                default_check_out: input.defaultCheckOut,
                off_days: input.offDays,
                daily_working_hours: input.dailyWorkingHours || {},
                updated_at: new Date()
            }).where(eq(officeSettings.id, current.id)).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update settings' })
            return data
        }),

    getOfficeClosures: protectedProcedure
        .query(async ({ ctx }) => {
            return await ctx.db.query.officeClosures.findMany({
                orderBy: [officeClosures.date]
            })
        }),

    addOfficeClosure: adminProcedure
        .input(z.object({
            date: z.string(),
            reason: z.string(),
            type: z.enum(['holiday', 'closed']),
        }))
        .mutation(async ({ ctx, input }) => {
            // Check for existing closure on same date
            const existing = await ctx.db.query.officeClosures.findFirst({
                where: eq(officeClosures.date, input.date)
            })

            if (existing) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `A closure already exists for ${input.date}`
                })
            }

            const [data] = await ctx.db.insert(officeClosures).values({
                date: input.date,
                reason: input.reason,
                type: input.type
            }).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add closure' })
            return data
        }),

    deleteOfficeClosure: adminProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.delete(officeClosures).where(eq(officeClosures.id, input.id))
            return { success: true }
        }),
})
