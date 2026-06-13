import { db } from '@/lib/db'
import { leaves } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
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
        let whereClause = []

        if (role === 'employee') {
            if (!profileId) throwAppError('UNAUTHORIZED', 'Profile ID is required for employee role')
            whereClause.push(eq(leaves.profile_id, profileId))
        } else if (profileId) {
            whereClause.push(eq(leaves.profile_id, profileId))
        }

        if (status !== 'all') {
            whereClause.push(eq(leaves.status, status))
        }

        return await db.query.leaves.findMany({
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

        return data
    }
}
