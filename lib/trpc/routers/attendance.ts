// ============================================
// lib/trpc/routers/attendance.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, moderatorProcedure } from '../server'
import { TRPCError } from '@trpc/server'
import { attendance, profiles, leaves, officeSettings, officeClosures, activities, notifications } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray, or } from 'drizzle-orm'
import { AttendanceService } from '@/lib/services/attendance.service'
import { LeavesService } from '@/lib/services/leaves.service'
import { invalidateDashboardCache } from './admin-dashboard-optimized'
import { broadcastServerEvent } from '@/lib/events/server-broadcaster'
import { getLocalDateIST } from '@/lib/utils/date-utils'
import { SmartCache } from '@/lib/cache/smart-cache'

const LEGACY_FACE_DIMENSIONS = 128
const LEGACY_FACE_THRESHOLD = 0.5

type LegacyFaceExtractResponse = {
    success?: boolean
    embedding?: unknown
    error?: string
    face_detected?: boolean
    face_count?: number
    dimensions?: number
}

type LegacyFaceCompareResponse = {
    matched?: boolean
    distance?: number
    similarity?: number
    dimensions?: number
    error?: string
}

function getLegacyFaceApiUrl(): string {
    const url = process.env.FACE_API_URL?.trim()
    if (!url) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Face verification service is not configured.'
        })
    }
    return url.replace(/\/$/, '')
}

function isValidLegacyEmbedding(value: unknown): value is number[] {
    return Array.isArray(value) &&
        value.length === LEGACY_FACE_DIMENSIONS &&
        value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

async function extractLegacyFaceEmbedding(faceApiUrl: string, imageBase64: string, source: 'selfie' | 'profile photo'): Promise<number[]> {
    let response: Response
    try {
        response = await fetch(`${faceApiUrl}/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: imageBase64 }),
            signal: AbortSignal.timeout(8000),
        })
    } catch {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Face verification service is unavailable. Please try again shortly.'
        })
    }

    const result = await response.json().catch(() => null) as LegacyFaceExtractResponse | null
    if (!response.ok || !result) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Face verification service did not return a valid response.'
        })
    }

    if (
        result.success !== true ||
        result.face_detected !== true ||
        result.face_count !== 1 ||
        result.dimensions !== LEGACY_FACE_DIMENSIONS ||
        !isValidLegacyEmbedding(result.embedding)
    ) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || `A clear image with exactly one face is required for the ${source}.`
        })
    }

    return result.embedding
}

async function compareLegacyFaceEmbeddings(faceApiUrl: string, embedding1: number[], embedding2: number[]): Promise<Required<Pick<LegacyFaceCompareResponse, 'matched' | 'distance' | 'similarity' | 'dimensions'>>> {
    let response: Response
    try {
        response = await fetch(`${faceApiUrl}/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embedding1,
                embedding2,
                threshold: LEGACY_FACE_THRESHOLD,
            }),
            signal: AbortSignal.timeout(5000),
        })
    } catch {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Face verification service is unavailable. Please try again shortly.'
        })
    }

    const result = await response.json().catch(() => null) as LegacyFaceCompareResponse | null
    if (
        !response.ok ||
        !result ||
        typeof result.matched !== 'boolean' ||
        typeof result.distance !== 'number' ||
        !Number.isFinite(result.distance) ||
        typeof result.similarity !== 'number' ||
        !Number.isFinite(result.similarity) ||
        result.dimensions !== LEGACY_FACE_DIMENSIONS
    ) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result?.error || 'Face verification service did not return a valid comparison.'
        })
    }

    return {
        matched: result.matched,
        distance: result.distance,
        similarity: result.similarity,
        dimensions: result.dimensions,
    }
}

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
            longitude: z.number().optional()
        }).optional())
        .mutation(async ({ ctx, input }) => {
            const result = await AttendanceService.clockIn({
                profileId: ctx.profile.id,
                fullName: ctx.profile.full_name || undefined,
                email: ctx.profile.email,
                localDate: input?.localDate,
                isExtraDay: input?.isExtraDay,
                latitude: input?.latitude,
                longitude: input?.longitude
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
            status: z.enum(['pending', 'verified', 'rejected']).optional(),
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
                return await LeavesService.approveLeave({
                    id: input.id,
                    status: input.status,
                    remarks: input.remarks,
                    approvedBy: ctx.profile.id
                })
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
        .query(async () => {
            return await SmartCache.getOfficeClosuresCached()
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
        .input(z.object({
            selfieBase64: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            try {
                const faceApiUrl = getLegacyFaceApiUrl()

                // 1. Fetch user profile
                const profile = await ctx.db.query.profiles.findFirst({
                    where: eq(profiles.id, ctx.profile.id),
                    columns: { id: true, face_embedding: true, avatar_url: true }
                })

                if (!profile) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Employee profile not found'
                    })
                }

                // 2. The hosted service is authoritative. A failed extraction
                // rejects the punch; there is no browser or mock fallback.
                const selfieEmbedding = await extractLegacyFaceEmbedding(
                    faceApiUrl,
                    input.selfieBase64,
                    'selfie'
                )

                // 3. Get profile face embedding (from DB or extract from avatar_url)
                let profileEmbedding = profile.face_embedding as number[] | null

                if (!isValidLegacyEmbedding(profileEmbedding)) {
                    if (!profile.avatar_url) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'No profile photo registered. Please upload a profile photo first.'
                        })
                    }

                    // Extract embedding from avatar_url
                    try {
                        const imgResponse = await fetch(profile.avatar_url)
                        if (!imgResponse.ok) {
                            throw new Error('Failed to fetch profile image')
                        }
                        const buffer = await imgResponse.arrayBuffer()
                        const base64 = Buffer.from(buffer).toString('base64')
                        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'
                        const base64DataUrl = `data:${contentType};base64,${base64}`

                        profileEmbedding = await extractLegacyFaceEmbedding(
                            faceApiUrl,
                            base64DataUrl,
                            'profile photo'
                        )
                        
                        // Save vector back to DB for future speedups
                        await ctx.db.update(profiles)
                            .set({ face_embedding: profileEmbedding })
                            .where(eq(profiles.id, ctx.profile.id))

                    } catch (e: any) {
                        throw new TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: `Could not process profile photo: ${e.message}`
                        })
                    }
                }

                if (!isValidLegacyEmbedding(profileEmbedding)) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Profile face embedding is invalid. Please upload a new profile photo.'
                    })
                }

                // 4. Vector validation and matching stay in the face service.
                const comparison = await compareLegacyFaceEmbeddings(
                    faceApiUrl,
                    selfieEmbedding,
                    profileEmbedding
                )

                return {
                    matched: comparison.matched,
                    similarity: comparison.similarity,
                    distance: comparison.distance,
                    error: comparison.matched
                        ? undefined
                        : `Face does not match profile photo (${(comparison.similarity * 100).toFixed(0)}% similarity).`
                }

            } catch (err) {
                if (err instanceof TRPCError) throw err
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: err instanceof Error ? err.message : 'Unknown verification error'
                })
            }
        }),
})
