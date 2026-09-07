import { db } from '@/lib/db'
import { leaves, attendance } from '@/lib/db/schema'
import { eq, and, desc, inArray, gte, lte, isNotNull } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'

export class LeavesService {
    /**
     * Get leaves with optional filters
     */
    static async getLeaves({
        profileId,
        role,
        status = 'all'
    }: {
        profileId?: string
        role: string
        status?: 'pending' | 'approved' | 'rejected' | 'all'
    }) {
        let whereClause: any[] = []

        if (role === 'employee') {
            if (!profileId) throwAppError('UNAUTHORIZED', 'Profile ID is required for employee role')
            whereClause.push(eq(leaves.profile_id, profileId))
        } else if (profileId) {
            whereClause.push(eq(leaves.profile_id, profileId))
        }

        if (status !== 'all') {
            whereClause.push(eq(leaves.status, status))
        }

        const leavesList = await db.query.leaves.findMany({
            where: and(...whereClause),
            with: {
                profile: {
                    columns: {
                        id: true,
                        email: true,
                        full_name: true,
                        avatar_url: true,
                        role: true
                    },
                    with: {
                        designation: {
                            columns: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: [desc(leaves.created_at)]
        })

        if (leavesList.length === 0) return []

        try {
            const profileIds = Array.from(new Set(leavesList.map(l => String(l.profile_id)))) as string[]
            if (profileIds.length === 0) {
                return leavesList.map(l => ({ ...l, has_punches: false }))
            }
            const minStartDate = leavesList.reduce((min, l) => l.start_date < min ? l.start_date : min, leavesList[0].start_date)
            const maxEndDate = leavesList.reduce((max, l) => l.end_date > max ? l.end_date : max, leavesList[0].end_date)

            const punches = await db.select({
                profile_id: attendance.profile_id,
                date: attendance.date
            })
            .from(attendance)
            .where(and(
                inArray(attendance.profile_id, profileIds),
                gte(attendance.date, minStartDate),
                lte(attendance.date, maxEndDate),
                isNotNull(attendance.check_in)
            ))

            return leavesList.map(l => {
                let hasPunches = false
                for (const p of punches) {
                    if (p.profile_id === l.profile_id && p.date >= l.start_date && p.date <= l.end_date) {
                        hasPunches = true
                        break
                    }
                }
                return {
                    ...l,
                    has_punches: hasPunches
                }
            })
        } catch (err) {
            console.error('[LeavesService.getLeaves] Failed to check punches:', err)
            return leavesList.map(l => ({ ...l, has_punches: false }))
        }
    }

    /**
     * Apply for leave
     */
    static async applyLeave({
        profileId,
        leaveType,
        startDate,
        endDate,
        isHalfDay,
        halfDayPeriod,
        reason
    }: {
        profileId: string
        leaveType?: string
        startDate: string
        endDate: string
        isHalfDay?: boolean
        halfDayPeriod?: 'morning' | 'afternoon'
        reason?: string
    }) {
        const [data] = await db.insert(leaves).values({
            profile_id: profileId,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            is_half_day: isHalfDay ?? false,
            half_day_period: halfDayPeriod,
            reason,
            status: 'pending'
        }).returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to apply for leave')

        return data
    }

    /**
     * Approve or reject a leave request
     */
    static async approveLeave({
        id,
        status,
        remarks,
        approvedBy
    }: {
        id: string
        status: 'approved' | 'rejected'
        remarks?: string
        approvedBy: string
    }) {
        const [data] = await db.update(leaves).set({
            status,
            remarks,
            approved_by: approvedBy,
            updated_at: new Date()
        }).where(eq(leaves.id, id)).returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to approve leave')

        // Synchronize attendance records for this profile within the leave date range
        try {
            const existingRecords = await db.query.attendance.findMany({
                where: and(
                    eq(attendance.profile_id, data.profile_id),
                    gte(attendance.date, data.start_date),
                    lte(attendance.date, data.end_date)
                )
            })

            for (const rec of existingRecords) {
                if (status === 'rejected') {
                    if (rec.check_in || rec.check_out) {
                        // Employee attended work and has punches - keep punches and clean remarks
                        const cleanRemarks = (rec.remarks || '').replace(/leave:?[^;]*/gi, '').trim()
                        await db.update(attendance).set({
                            remarks: cleanRemarks || 'Punches verified; leave rejected',
                            updated_at: new Date()
                        }).where(eq(attendance.id, rec.id))
                    } else {
                        // Record has NO punches: mark it as absent
                        await db.update(attendance).set({
                            status: 'absent',
                            remarks: remarks ? `Absent: ${remarks}` : 'Absent (Leave rejected)',
                            updated_at: new Date()
                        }).where(eq(attendance.id, rec.id))
                    }
                } else if (status === 'approved') {
                    if (!rec.check_in && !rec.check_out) {
                        await db.update(attendance).set({
                            status: 'verified',
                            remarks: `Leave: ${data.leave_type || 'Casual'} (approved)`,
                            is_half_day: data.is_half_day || false,
                            updated_at: new Date()
                        }).where(eq(attendance.id, rec.id))
                    }
                }
            }
        } catch (err) {
            console.error('[LeavesService.approveLeave] Failed to sync attendance records:', err)
        }

        return data
    }
}
