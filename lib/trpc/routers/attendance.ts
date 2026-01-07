// ============================================
// lib/trpc/routers/attendance.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, moderatorProcedure } from '../server'
import { TRPCError } from '@trpc/server'
import { attendance, profiles, leaves, officeSettings, officeClosures, activities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm'
import { AttendanceService } from '@/lib/services/attendance.service'
import { invalidateDashboardCache } from './admin-dashboard-optimized'
import { broadcastServerEvent } from '@/lib/events/server-broadcaster'

export const attendanceRouter = router({
    // --- ATTENDANCE ---

    // Simple endpoint for attendance button state - always fresh, no caching
    getTodayStatus: protectedProcedure
        .input(z.object({ localDate: z.string() }))
        .query(async ({ ctx, input }) => {
            const record = await ctx.db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, ctx.profile.id),
                    eq(attendance.date, input.localDate)
                ),
                columns: { check_in: true, check_out: true }
            });

            if (!record) return { status: 'not_clocked_in' as const };
            if (record.check_in && !record.check_out) return { status: 'clocked_in' as const };
            return { status: 'marked' as const };
        }),

    getAttendance: protectedProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const isEmployee = ctx.profile.role === 'employee'

            return await AttendanceService.getAttendance({
                // For employees, always force their own ID. 
                // For others, use input.profileId if provided, else undefined (shows all)
                profileId: isEmployee ? ctx.profile.id : input.profileId,
                role: ctx.profile.role,
                startDate: input.startDate,
                endDate: input.endDate
            })
        }),

    clockIn: protectedProcedure
        .input(z.object({
            localDate: z.string().optional(),
            isExtraDay: z.boolean().optional()
        }).optional())
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.clockIn({
                profileId: ctx.profile.id,
                fullName: ctx.profile.full_name || undefined,
                email: ctx.profile.email,
                localDate: input?.localDate,
                isExtraDay: input?.isExtraDay
            })
            // Invalidate dashboard cache immediately on server
            invalidateDashboardCache()

            // Broadcast sync event to all clients
            broadcastServerEvent('dashboard_sync', {
                action: 'clock-in',
                userId: ctx.profile.id
            }, ctx.profile.id)

            // Broadcast attendance-specific event for real-time updates
            broadcastServerEvent('attendance_update', {
                action: 'clock-in',
                employeeId: ctx.profile.id,
                employeeName: ctx.profile.full_name,
                date: input?.localDate || new Date().toISOString().split('T')[0],
                recordId: result.id
            }, ctx.profile.id)

            return result
        }),

    clockOut: protectedProcedure
        .input(z.object({
            localDate: z.string().optional()
        }).optional())
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.clockOut({
                profileId: ctx.profile.id,
                fullName: ctx.profile.full_name || undefined,
                email: ctx.profile.email,
                localDate: input?.localDate
            })
            // Invalidate dashboard cache immediately on server
            invalidateDashboardCache()

            // Broadcast sync event to all clients
            broadcastServerEvent('dashboard_sync', {
                action: 'clock-out',
                userId: ctx.profile.id
            }, ctx.profile.id)

            // Broadcast attendance-specific event for real-time updates
            broadcastServerEvent('attendance_update', {
                action: 'clock-out',
                employeeId: ctx.profile.id,
                employeeName: ctx.profile.full_name,
                date: input?.localDate || new Date().toISOString().split('T')[0],
                recordId: result.id
            }, ctx.profile.id)

            return result
        }),

    verifyAttendance: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            status: z.enum(['verified', 'rejected']),
            remarks: z.string().optional(),
            isHalfDay: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.verifyAttendance({
                id: input.id,
                status: input.status,
                remarks: input.remarks,
                isHalfDay: input.isHalfDay,
                verifiedBy: ctx.profile.id,
                verifierName: ctx.profile.full_name || ctx.profile.email
            })
            // Invalidate dashboard cache immediately on server
            invalidateDashboardCache()

            // Broadcast sync event to all clients
            broadcastServerEvent('dashboard_sync', {
                action: 'verify-attendance',
                targetUserId: result.profile_id
            }, result.profile_id)

            // Broadcast attendance-specific event for real-time updates
            broadcastServerEvent('attendance_update', {
                action: input.status === 'verified' ? 'verified' : 'rejected',
                employeeId: result.profile_id,
                performedById: ctx.profile.id,
                performedByName: ctx.profile.full_name,
                newStatus: input.status,
                date: result.date,
                recordId: result.id,
                remarks: input.remarks
            }, result.profile_id)

            return result
        }),

    bulkVerifyAttendance: moderatorProcedure
        .input(z.object({
            ids: z.array(z.string().uuid()),
            status: z.enum(['verified', 'rejected']),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.bulkVerifyAttendance({
                ids: input.ids,
                status: input.status,
                remarks: input.remarks,
                verifiedBy: ctx.profile.id,
                verifierName: ctx.profile.full_name || ctx.profile.email
            })

            // Invalidate dashboard cache immediately on server
            invalidateDashboardCache()

            // Broadcast sync event to all clients
            broadcastServerEvent('dashboard_sync', {
                action: 'bulk-verify'
            })

            // Broadcast attendance-specific event for real-time updates
            broadcastServerEvent('attendance_update', {
                action: 'bulk-verify',
                employeeId: 'bulk', // Special marker for bulk operations
                performedById: ctx.profile.id,
                performedByName: ctx.profile.full_name,
                newStatus: input.status
            })

            return result
        }),

    manualUpdate: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            checkIn: z.string().optional(),
            checkOut: z.string().optional(),
            status: z.enum(['pending', 'verified', 'rejected']).optional(),
            isHalfDay: z.boolean().optional(),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.manualUpdate({
                ...input,
                updatedBy: ctx.profile.id,
                updaterName: ctx.profile.full_name || ctx.profile.email
            })

            // Invalidate dashboard cache immediately on server
            invalidateDashboardCache()

            // Broadcast sync event to all clients
            broadcastServerEvent('dashboard_sync', {
                action: 'manual-update',
                targetUserId: (result as any)?.profile_id
            }, (result as any)?.profile_id)

            // Broadcast attendance-specific event for real-time updates
            broadcastServerEvent('attendance_update', {
                action: 'manual-update',
                employeeId: (result as any)?.profile_id,
                performedById: ctx.profile.id,
                performedByName: ctx.profile.full_name,
                newStatus: input.status,
                date: (result as any)?.date,
                recordId: input.id
            }, (result as any)?.profile_id)

            return result
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
            isHalfDay: z.boolean().optional(),
            halfDayPeriod: z.enum(['morning', 'afternoon']).optional(),
            reason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const [data] = await ctx.db.insert(leaves).values({
                profile_id: ctx.profile.id,
                leave_type: input.leaveType,
                start_date: input.startDate,
                endDate: input.endDate,
                is_half_day: input.isHalfDay ?? false,
                half_day_period: input.halfDayPeriod,
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
                orderBy: [desc(officeClosures.date)]
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
