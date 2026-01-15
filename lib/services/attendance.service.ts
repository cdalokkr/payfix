import { db } from '@/lib/db'
import { attendance, activities, officeSettings, officeClosures } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'
import { getLocalDateIST } from '@/lib/utils/date-utils'

export class AttendanceService {
    /**
     * Get attendance records with optional filters
     */
    static async getAttendance({
        profileId,
        role,
        startDate,
        endDate,
        mode = 'all'
    }: {
        profileId?: string
        role: string
        startDate?: string
        endDate?: string
        mode?: 'default' | 'all'
    }) {
        let whereClause = []

        // If employee, they can only see their own records (profileId must be provided by router)
        if (role === 'employee') {
            if (!profileId) throwAppError('UNAUTHORIZED', 'Profile ID is required for employee role')
            whereClause.push(eq(attendance.profile_id, profileId))
        }
        // If not employee, only filter by profileId if it's explicitly requested
        else if (profileId) {
            whereClause.push(eq(attendance.profile_id, profileId))
        }

        // Mode logic
        if (mode === 'default' && !startDate && !endDate) {
            const today = getLocalDateIST()
            whereClause.push(
                sql`(${attendance.date} = ${today} OR (${attendance.date} < ${today} AND ${attendance.status} = 'pending'))`
            )
        } else {
            if (startDate) whereClause.push(gte(attendance.date, startDate))
            if (endDate) whereClause.push(lte(attendance.date, endDate))
        }

        const data = await db.query.attendance.findMany({
            where: and(...whereClause),
            with: {
                profile: {
                    columns: {
                        email: true,
                        full_name: true,
                        role: true,
                        avatar_url: true,
                        sex: true
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
            orderBy: [desc(attendance.date)]
        })

        return data.map(item => ({
            ...item,
            working_hours: item.working_hours ? Number(item.working_hours) : null
        }))
    }

    /**
     * Clock in a user
     */
    static async clockIn({
        profileId,
        fullName,
        email,
        localDate,
        isExtraDay
    }: {
        profileId: string
        fullName?: string
        email: string
        localDate?: string
        isExtraDay?: boolean
    }) {
        const today = localDate || getLocalDateIST()
        const dayOfWeek = new Date(today).getDay()

        const settings = await db.query.officeSettings.findFirst()
        const closures = await db.query.officeClosures.findMany()

        const isOffDay = settings?.off_days?.includes(dayOfWeek)
        const isHoliday = closures?.some(c => c.date === today)

        if (isHoliday) {
            const holiday = closures.find(c => c.date === today)
            throwAppError('HOLIDAY_RESTRICTION', `Office is closed for ${holiday?.reason || 'Holiday'}.`)
        }

        if (isOffDay && !isExtraDay) {
            throwAppError('OFF_DAY_RESTRICTION', 'Today is a weekly off day. Please use "Extra Work" to clock in if authorized.')
        }

        const existing = await db.query.attendance.findFirst({
            where: and(
                eq(attendance.profile_id, profileId),
                eq(attendance.date, today)
            ),
            columns: { id: true }
        })

        if (existing) {
            throwAppError('ALREADY_CLOCKED_IN', 'Already clocked in for today.')
        }

        const [data] = await db.insert(attendance).values({
            profile_id: profileId,
            date: today,
            check_in: new Date(),
            status: 'pending',
            is_extra_day: isExtraDay || false
        }).returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to create clock-in record')

        await db.insert(activities).values({
            user_id: profileId,
            activity_type: 'data_create',
            module: 'attendance',
            description: `Clocked in at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}${isExtraDay ? ' (Extra Work)' : ''}`,
        })

        return data
    }

    /**
     * Clock out a user
     */
    static async clockOut({
        profileId,
        fullName,
        email,
        localDate
    }: {
        profileId: string
        fullName?: string
        email: string
        localDate?: string
    }) {
        const today = localDate || getLocalDateIST()

        let record = await db.query.attendance.findFirst({
            where: and(
                eq(attendance.profile_id, profileId),
                eq(attendance.date, today)
            ),
            columns: { id: true, check_in: true, check_out: true, date: true }
        })

        if (!record) {
            record = await db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, profileId),
                    sql`${attendance.check_out} IS NULL`
                ),
                orderBy: [desc(attendance.date)]
            })
        }

        if (!record) {
            throwAppError('NO_CLOCK_IN_FOUND', 'No clock-in record found to clock out.')
        }

        if (record!.check_out) {
            throwAppError('ALREADY_CLOCKED_OUT', 'Already clocked out for this session.')
        }

        const [data] = await db.update(attendance).set({
            check_out: new Date(),
            updated_at: new Date()
        }).where(eq(attendance.id, record!.id)).returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to update clock-out record')

        await db.insert(activities).values({
            user_id: profileId,
            activity_type: 'data_edit',
            module: 'attendance',
            description: `Clocked out at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`,
        })

        return data
    }

    /**
     * Verify attendance record
     */
    static async verifyAttendance({
        id,
        status,
        remarks,
        isHalfDay,
        verifiedBy,
        verifierName
    }: {
        id: string
        status: 'verified' | 'rejected'
        remarks?: string
        isHalfDay?: boolean
        verifiedBy: string
        verifierName: string
    }) {
        const [data] = await db.update(attendance).set({
            status,
            remarks,
            is_half_day: isHalfDay ?? false,
            verified_by: verifiedBy,
            updated_at: new Date()
        }).where(eq(attendance.id, id)).returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to verify attendance')

        await db.insert(activities).values({
            user_id: data.profile_id,
            activity_type: 'data_edit',
            module: 'attendance',
            description: `Attendance record for ${data.date} was ${status} by ${verifierName}`,
        })

        return data
    }

    /**
     * Bulk verify attendance records
     */
    static async bulkVerifyAttendance({
        ids,
        status,
        remarks,
        verifiedBy,
        verifierName
    }: {
        ids: string[]
        status: 'verified' | 'rejected'
        remarks?: string
        verifiedBy: string
        verifierName: string
    }) {
        const updatedRecords = await db.update(attendance).set({
            status,
            remarks,
            verified_by: verifiedBy,
            updated_at: new Date()
        }).where(inArray(attendance.id, ids)).returning()

        if (!updatedRecords.length) throwAppError('NOT_FOUND', 'No records found to update')

        await db.insert(activities).values({
            user_id: verifiedBy,
            activity_type: 'data_edit',
            module: 'attendance',
            description: `Bulk ${status} ${updatedRecords.length} attendance records by ${verifierName}`,
        })

        return updatedRecords
    }

    /**
     * Manually update an attendance record
     */
    static async manualUpdate({
        id,
        checkIn,
        checkOut,
        status,
        isHalfDay,
        remarks,
        updatedBy,
        updaterName
    }: {
        id: string
        checkIn?: string
        checkOut?: string
        status?: 'pending' | 'verified' | 'rejected'
        isHalfDay?: boolean
        remarks?: string
        updatedBy: string
        updaterName: string
    }) {
        const existing = await db.query.attendance.findFirst({
            where: eq(attendance.id, id)
        })

        if (!existing) {
            throwAppError('NOT_FOUND', 'Attendance record not found')
        }

        const recordDate = existing!.date
        const updateData: any = {
            updated_at: new Date()
        }

        if (checkIn) {
            const [h, m] = checkIn.split(':')
            const dateObj = new Date(recordDate)
            dateObj.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0)
            updateData.check_in = dateObj
        }

        if (checkOut) {
            const [h, m] = checkOut.split(':')
            const dateObj = new Date(recordDate)
            dateObj.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0)
            updateData.check_out = dateObj
        }

        if (status) updateData.status = status
        if (isHalfDay !== undefined) updateData.is_half_day = isHalfDay
        if (remarks) updateData.remarks = remarks

        const [data] = await db.update(attendance)
            .set(updateData)
            .where(eq(attendance.id, id))
            .returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to update attendance record')

        await db.insert(activities).values({
            user_id: data.profile_id,
            activity_type: 'data_edit',
            module: 'attendance',
            description: `Attendance record for ${data.date} was manually updated by ${updaterName}`,
        })

        return data
    }
}
