// ============================================
// lib/trpc/routers/attendance.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, moderatorProcedure } from '../server'
import { TRPCError } from '@trpc/server'
import { attendance, profiles, leaves, officeSettings, officeClosures, activities, notifications } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray, or, isNull } from 'drizzle-orm'
import { AttendanceService } from '@/lib/services/attendance.service'
import { LeavesService } from '@/lib/services/leaves.service'
import { invalidateDashboardCache } from './admin-dashboard-optimized'
import { broadcastServerEvent } from '@/lib/events/server-broadcaster'
import { getLocalDateIST } from '@/lib/utils/date-utils'
import { SmartCache } from '@/lib/cache/smart-cache'
import { FaceServiceClient } from '@/lib/face-service-client'


export const attendanceRouter = router({
    // --- ATTENDANCE ---

    // Simple endpoint for attendance button state - always fresh, no caching
    getTodayStatus: protectedProcedure
        .input(z.object({ localDate: z.string() }))
        .query(async ({ ctx, input }): Promise<{ status: 'not_clocked_in' | 'clocked_in' | 'marked' }> => {
            await AttendanceService.ensureAttendanceSchema()
            const record = await ctx.db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, ctx.profile.id),
                    eq(attendance.date, input.localDate)
                ),
                columns: { check_in: true, check_out: true, current_session_status: true }
            });

            if (!record) return { status: 'not_clocked_in' };

            // Use current_session_status for accurate multi-session state
            // 'checked_in' = active session in progress → can clock out
            // 'checked_out' = previous session completed → can clock in for next session!
            const sessionStatus = record.current_session_status
            if (sessionStatus === 'checked_in') return { status: 'clocked_in' };
            if (sessionStatus === 'checked_out') return { status: 'not_clocked_in' };

            // Legacy fallback
            if (record.check_in && !record.check_out) return { status: 'clocked_in' };
            return { status: 'not_clocked_in' };
        }),



    // Full attendance record for mobile dashboard real-time updates
    getMobileAttendance: protectedProcedure
        .query(async ({ ctx }) => {
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
            const record = await ctx.db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, ctx.profile.id),
                    eq(attendance.date, today)
                ),
                columns: {
                    id: true,
                    check_in: true,
                    check_out: true,
                    first_check_in: true,
                    last_check_out: true,
                    current_session_status: true,
                    total_sessions: true,
                    working_hours: true,
                    status: true
                }
            });
            return record || null;
        }),

    getAttendance: protectedProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            mode: z.enum(['default', 'all']).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const isEmployee = ctx.profile.role === 'employee'

            return await AttendanceService.getAttendance({
                // For employees, always force their own ID. 
                // For others, use input.profileId if provided, else undefined (shows all)
                profileId: isEmployee ? ctx.profile.id : input.profileId,
                role: ctx.profile.role,
                startDate: input.startDate,
                endDate: input.endDate,
                mode: input.mode
            })
        }),

    clockIn: protectedProcedure
        .input(z.object({
            localDate: z.string().optional(),
            isExtraDay: z.boolean().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            attendanceProof: z.string().min(1)
        }).optional())
        .mutation(async ({ ctx, input }) => {
            if (!input?.attendanceProof) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'A fresh biometric verification is required before clocking in.' })
            }
            const result = await AttendanceService.clockIn({
                profileId: ctx.profile.id,
                fullName: ctx.profile.full_name || undefined,
                email: ctx.profile.email,
                localDate: input?.localDate,
                isExtraDay: input?.isExtraDay,
                latitude: input?.latitude,
                longitude: input?.longitude,
                verificationProof: input.attendanceProof
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
                date: input?.localDate || getLocalDateIST(),
                recordId: result.id
            }, ctx.profile.id)

            // Send notifications to admins and moderators
            const adminModerators = await ctx.db.query.profiles.findMany({
                where: or(eq(profiles.role, 'admin'), eq(profiles.role, 'moderator')),
                columns: { id: true, role: true }
            })

            // Send notifications to admins and moderators with role-specific links
            await Promise.all(adminModerators.map(async (user) => {
                const role = user.role || 'admin'
                const link = role === 'admin' ? '/admin/payroll/attendance' : '/moderator/payroll/attendance'
                const title = 'Employee Clocked In'
                const message = `${ctx.profile.full_name || ctx.profile.email} has clocked in`

                // Insert notification to DB
                await ctx.db.insert(notifications).values({
                    user_id: user.id,
                    title,
                    message,
                    type: 'attendance',
                    link
                })

                // Broadcast to the specific user (since postgres_changes may not work due to RLS)
                broadcastServerEvent('new_notification', {
                    title,
                    message,
                    type: 'attendance',
                    link,
                    targetUserId: user.id
                }, user.id)
            }))

            return result
        }),

    clockOut: protectedProcedure
        .input(z.object({
            localDate: z.string().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            attendanceProof: z.string().min(1)
        }).optional())
        .mutation(async ({ ctx, input }) => {
            if (!input?.attendanceProof) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'A fresh biometric verification is required before clocking out.' })
            }
            const result = await AttendanceService.clockOut({
                profileId: ctx.profile.id,
                fullName: ctx.profile.full_name || undefined,
                email: ctx.profile.email,
                localDate: input?.localDate,
                latitude: input?.latitude,
                longitude: input?.longitude,
                verificationProof: input.attendanceProof
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
                date: input?.localDate || getLocalDateIST(),
                recordId: result.id
            }, ctx.profile.id)

            // Send notifications to admins and moderators
            const adminModerators = await ctx.db.query.profiles.findMany({
                where: or(eq(profiles.role, 'admin'), eq(profiles.role, 'moderator')),
                columns: { id: true, role: true }
            })

            // Send notifications to admins and moderators with role-specific links
            await Promise.all(adminModerators.map(async (user) => {
                const role = user.role || 'admin'
                const link = role === 'admin' ? '/admin/payroll/attendance' : '/moderator/payroll/attendance'
                const title = 'Employee Clocked Out'
                const message = `${ctx.profile.full_name || ctx.profile.email} has clocked out`

                // Insert notification to DB
                await ctx.db.insert(notifications).values({
                    user_id: user.id,
                    title,
                    message,
                    type: 'attendance',
                    link
                })

                // Broadcast to the specific user (since postgres_changes may not work due to RLS)
                broadcastServerEvent('new_notification', {
                    title,
                    message,
                    type: 'attendance',
                    link,
                    targetUserId: user.id
                }, user.id)
            }))

            return result
        }),

    verifyAttendance: moderatorProcedure
        .input(z.object({
            id: z.string(),
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

            // Insert notification for the employee
            const isApproved = input.status === 'verified'
            const isExtraDay = result.is_extra_day
            const notifyTitle = isApproved 
                ? (isExtraDay ? 'Extra Day Approved' : 'Attendance Approved') 
                : (isExtraDay ? 'Extra Day Rejected' : 'Attendance Rejected')
            const notifyMessage = isApproved
                ? (isExtraDay 
                    ? `Your extra day attendance record for ${result.date} has been approved as an extra working day by ${ctx.profile.full_name || ctx.profile.email}.`
                    : `Your attendance record for ${result.date} has been approved by ${ctx.profile.full_name || ctx.profile.email}.`)
                : `Your attendance record for ${result.date} has been rejected${input.remarks ? `: "${input.remarks}"` : ''} by ${ctx.profile.full_name || ctx.profile.email}.`

            try {
                await ctx.db.insert(notifications).values({
                    user_id: result.profile_id,
                    title: notifyTitle,
                    message: notifyMessage,
                    type: 'attendance_approval',
                    link: '/mobile/history'
                })

                // Broadcast notification to the specific employee
                broadcastServerEvent('new_notification', {
                    title: notifyTitle,
                    message: notifyMessage,
                    type: 'attendance_approval',
                    link: '/mobile/history',
                    targetUserId: result.profile_id
                }, result.profile_id)
            } catch (err) {
                console.error('[verifyAttendance] Failed to send notification:', err)
            }

            return result
        }),

    verifySession: moderatorProcedure
        .input(z.object({
            sessionId: z.string().uuid(),
            attendanceId: z.string().uuid(),
            status: z.enum(['verified', 'rejected']),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.verifyAttendanceSession({
                sessionId: input.sessionId,
                attendanceId: input.attendanceId,
                status: input.status,
                remarks: input.remarks,
                verifiedBy: ctx.profile.id,
                verifierName: ctx.profile.full_name || ctx.profile.email
            })

            invalidateDashboardCache()

            broadcastServerEvent('dashboard_sync', {
                action: 'verify-session',
                targetUserId: result.session.profile_id
            }, result.session.profile_id)

            broadcastServerEvent('attendance_update', {
                action: input.status === 'verified' ? 'session_verified' : 'session_rejected',
                employeeId: result.session.profile_id,
                performedById: ctx.profile.id,
                performedByName: ctx.profile.full_name,
                newStatus: input.status,
                date: result.session.date,
                sessionId: input.sessionId,
                attendanceId: input.attendanceId,
                remarks: input.remarks
            }, result.session.profile_id)

            return result
        }),

    updateSession: moderatorProcedure
        .input(z.object({
            sessionId: z.string().uuid(),
            attendanceId: z.string().uuid(),
            checkIn: z.string(),
            checkOut: z.string().nullable().optional(),
            status: z.enum(['active', 'completed', 'verified', 'rejected']).optional(),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.updateAttendanceSession({
                sessionId: input.sessionId,
                attendanceId: input.attendanceId,
                checkIn: input.checkIn,
                checkOut: input.checkOut,
                status: input.status,
                remarks: input.remarks,
                updatedBy: ctx.profile.id,
                updaterName: ctx.profile.full_name || ctx.profile.email
            })

            invalidateDashboardCache()

            broadcastServerEvent('dashboard_sync', {
                action: 'update-session',
                targetUserId: result.session.profile_id
            }, result.session.profile_id)

            broadcastServerEvent('attendance_update', {
                action: 'session_updated',
                employeeId: result.session.profile_id,
                performedById: ctx.profile.id,
                performedByName: ctx.profile.full_name,
                date: result.session.date,
                sessionId: input.sessionId,
                attendanceId: input.attendanceId,
                remarks: input.remarks
            }, result.session.profile_id)

            return result
        }),

    batchUpdateSessions: moderatorProcedure
        .input(z.object({
            attendanceId: z.string().uuid(),
            sessions: z.array(z.object({
                id: z.string().uuid(),
                check_in: z.string().optional(),
                check_out: z.string().nullable().optional(),
                status: z.enum(['active', 'completed', 'verified', 'rejected']).optional(),
                remarks: z.string().nullable().optional(),
            }))
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.batchUpdateAttendanceSessions({
                attendanceId: input.attendanceId,
                sessions: input.sessions,
                updatedBy: ctx.profile.id,
                updaterName: ctx.profile.full_name || ctx.profile.email
            })

            invalidateDashboardCache()

            broadcastServerEvent('dashboard_sync', {
                action: 'batch-update-sessions',
                targetUserId: result.attendance?.profile_id
            }, result.attendance?.profile_id)

            broadcastServerEvent('attendance_update', {
                action: 'batch_sessions_updated',
                employeeId: result.attendance?.profile_id,
                performedById: ctx.profile.id,
                performedByName: ctx.profile.full_name,
                attendanceId: input.attendanceId,
                sessionsCount: input.sessions.length
            }, result.attendance?.profile_id)

            return result
        }),

    bulkVerifyAttendance: moderatorProcedure
        .input(z.object({
            ids: z.array(z.string()),
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
            id: z.string(),
            checkIn: z.string().nullable().optional(),
            checkOut: z.string().nullable().optional(),
            status: z.enum(['pending', 'verified', 'rejected', 'absent']).optional(),
            dayType: z.string().optional(),
            isHalfDay: z.boolean().optional(),
            isExtraDay: z.boolean().optional(),
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
            try {
                return await LeavesService.getLeaves({
                    profileId: ctx.profile.role === 'employee' ? ctx.profile.id : input.profileId,
                    role: ctx.profile.role,
                    status: input.status
                })
            } catch (err: any) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: err.message || 'Failed to retrieve leave records'
                })
            }
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
            try {
                return await LeavesService.applyLeave({
                    profileId: ctx.profile.id,
                    leaveType: input.leaveType,
                    startDate: input.startDate,
                    endDate: input.endDate,
                    isHalfDay: input.isHalfDay,
                    halfDayPeriod: input.halfDayPeriod,
                    reason: input.reason
                })
            } catch (err: any) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: err.message || 'Failed to apply for leave'
                })
            }
        }),

    approveLeave: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            status: z.enum(['approved', 'rejected']),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            try {
                const result = await LeavesService.approveLeave({
                    id: input.id,
                    status: input.status,
                    remarks: input.remarks,
                    approvedBy: ctx.profile.id
                })

                // Invalidate dashboard cache immediately on server
                invalidateDashboardCache()

                // Broadcast sync event to all clients
                broadcastServerEvent('dashboard_sync', {
                    action: 'approve-leave',
                    targetUserId: result.profile_id
                }, result.profile_id)

                // Broadcast attendance-specific event for real-time updates
                broadcastServerEvent('attendance_update', {
                    action: input.status === 'approved' ? 'leave-approved' : 'leave-rejected',
                    employeeId: result.profile_id,
                    performedById: ctx.profile.id,
                    performedByName: ctx.profile.full_name,
                    newStatus: input.status
                }, result.profile_id)

                return result
            } catch (err: any) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: err.message || 'Failed to approve leave'
                })
            }
        }),

    // --- SETTINGS ---

    getOfficeSettings: protectedProcedure
        .query(async () => {
            const data = await SmartCache.getOfficeSettingsCached()
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
            absentDeductionMultiplier: z.number().int().min(1).max(3).optional(),
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
                absent_deduction_multiplier: input.absentDeductionMultiplier ?? 1,
                updated_at: new Date()
            }).where(eq(officeSettings.id, current.id)).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update settings' })
            
            // Invalidate settings cache namespace
            SmartCache.invalidateSettings()
            return data
        }),

    getOfficeClosures: protectedProcedure
        .input(z.object({ locationId: z.string().uuid().optional() }).optional())
        .query(async ({ input }) => {
            const closures = await SmartCache.getOfficeClosuresCached()
            if (input?.locationId) {
                return closures.filter((c: any) => !c.location_id || c.location_id === input.locationId)
            }
            return closures
        }),

    addOfficeClosure: adminProcedure
        .input(z.object({
            date: z.string(),
            reason: z.string(),
            type: z.enum(['holiday', 'closed']),
            locationId: z.string().uuid().nullable().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const targetLocId = input.locationId || null;
            // Check for existing closure on same date for same scope
            const existing = await ctx.db.query.officeClosures.findFirst({
                where: and(
                    eq(officeClosures.date, input.date),
                    targetLocId ? eq(officeClosures.location_id, targetLocId) : isNull(officeClosures.location_id)
                )
            })

            if (existing) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `A closure already exists for ${input.date} for this scope.`
                })
            }

            const [data] = await ctx.db.insert(officeClosures).values({
                date: input.date,
                reason: input.reason,
                type: input.type,
                location_id: targetLocId,
            }).returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add closure' })
            
            // Invalidate closures cache namespace
            SmartCache.invalidateClosures()
            return data
        }),

    deleteOfficeClosure: adminProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.delete(officeClosures).where(eq(officeClosures.id, input.id))
            // Invalidate closures cache namespace
            SmartCache.invalidateClosures()
            return { success: true }
        }),

    // Employee personal attendance report for download
    getMyAttendanceReport: protectedProcedure
        .input(z.object({
            startDate: z.string(),
            endDate: z.string(),
        }))
        .query(async ({ ctx, input }) => {
            const profileId = ctx.profile.id

            const records = await ctx.db.query.attendance.findMany({
                where: and(
                    eq(attendance.profile_id, profileId),
                    gte(attendance.date, input.startDate),
                    lte(attendance.date, input.endDate)
                ),
                orderBy: [desc(attendance.date)]
            })

            // Get office settings for extra hours calculation
            const settings = await SmartCache.getOfficeSettingsCached()
            const defaultCheckIn = settings?.default_check_in || '10:00:00'
            const defaultCheckOut = settings?.default_check_out || '19:00:00'

            // Calculate scheduled hours
            const [inH, inM] = defaultCheckIn.split(':').map(Number)
            const [outH, outM] = defaultCheckOut.split(':').map(Number)
            const scheduledHours = ((outH * 60 + outM) - (inH * 60 + inM)) / 60

            const reportData = records.map((record, index) => {
                const workingHours = Number(record.working_hours) || 0
                const extraHours = Math.max(0, workingHours - scheduledHours)

                return {
                    sr: index + 1,
                    date: record.date,
                    markedOfficeLocation: record.checkin_location_name || 'N/A',
                    clockIn: record.check_in ? new Date(record.check_in).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }) : '-',
                    clockOut: record.check_out ? new Date(record.check_out).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }) : '-',
                    totalHours: workingHours ? `${workingHours.toFixed(1)}h` : '-',
                    extraHours: extraHours > 0 ? `+${extraHours.toFixed(1)}h` : '0h',
                    status: record.status,
                    remark: record.remarks || '-',
                    markedDay: record.is_half_day ? 'Half Day' : 'Full Day'
                }
            })

            return {
                data: reportData,
                meta: {
                    startDate: input.startDate,
                    endDate: input.endDate,
                    employeeName: ctx.profile.full_name || ctx.profile.email,
                    totalRecords: records.length,
                    generatedAt: new Date().toISOString()
                }
            }
        }),

    verifyFace: protectedProcedure
        .input(z.object({ selfieBase64: z.string().min(100).max(6_000_000).refine(value => /^data:image\/(jpeg|png|webp);base64,/.test(value), 'A camera image is required') }))
        .mutation(async ({ ctx, input }) => {
            const threshold = Number(process.env.FACE_MATCH_COSINE_THRESHOLD ?? '0.80')
            if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Face verification threshold is invalid.' })
            try {
                const profile = await ctx.db.query.profiles.findFirst({ where: eq(profiles.id, ctx.profile.id), columns: { id: true, face_embedding_512: true } })
                if (!profile) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee profile not found.' })
                const result = await FaceServiceClient.extract(input.selfieBase64)
                const selfie = result.embedding_512 || (result.embedding?.length === 512 ? result.embedding : null)
                if (!result.success || !result.face_detected || result.face_count !== 1 || !selfie || selfie.length !== 512) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error_message || 'Exactly one clear face is required.' })
                if (result.is_live !== true) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Liveness verification failed. Please retake your selfie.' })
                const stored = profile.face_embedding_512 as number[] | null
                if (!stored || stored.length !== 512 || !stored.every(Number.isFinite)) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Your approved profile has no valid biometric template. Please submit a new profile photo.' })
                const dot = selfie.reduce((sum, value, index) => sum + value * stored[index], 0)
                const selfieNorm = Math.sqrt(selfie.reduce((sum, value) => sum + value * value, 0))
                const storedNorm = Math.sqrt(stored.reduce((sum, value) => sum + value * value, 0))
                if (!selfieNorm || !storedNorm) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Invalid biometric template.' })
                const rawCosine = dot / (selfieNorm * storedNorm)
                const similarity = Math.max(0, Math.min(1, rawCosine))
                const distance = Math.sqrt(Math.max(0, 2 - (2 * rawCosine)))
                const matched = similarity >= threshold
                return { matched, similarity: Math.round(similarity * 1000) / 1000, distance: Math.round(distance * 1000) / 1000, threshold, is_live: true, diagnostics: result.diagnostics, error: matched ? undefined : 'Face does not match the approved profile photo.' }
            } catch (error) {
                if (error instanceof TRPCError) throw error
                throw new TRPCError({ code: 'BAD_REQUEST', message: error instanceof Error ? error.message : 'Face verification failed.' })
            }
        }),
})
