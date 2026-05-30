import { db } from '@/lib/db'
import { attendance, activities, officeSettings, officeClosures, officeLocations, notifications } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'
import { SmartCache } from '@/lib/cache/smart-cache'
import { getLocalDateIST, getLocalTimeIST12Hour } from '@/lib/utils/date-utils'

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
        isExtraDay,
        latitude,
        longitude
    }: {
        profileId: string
        fullName?: string
        email: string
        localDate?: string
        isExtraDay?: boolean
        latitude?: number
        longitude?: number
    }) {
        const today = localDate || getLocalDateIST()
        const dayOfWeek = new Date(today).getDay()

        const settings = await SmartCache.getOfficeSettingsCached()
        const closures = await SmartCache.getOfficeClosuresCached()

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

        // Resolve location name & Validate Geofence
        let locationName: string | null = null

        // Get active office locations (for potential validation)
        const activeLocations = await SmartCache.getOfficeLocationsCached()

        if (latitude && longitude) {
            try {
                // Dynamically import geo-utils
                const { getDistanceFromLatLonInMeters } = await import('@/lib/utils/geo-utils')

                // Check distance against each
                for (const office of activeLocations) {
                    const dist = getDistanceFromLatLonInMeters(
                        latitude,
                        longitude,
                        Number(office.latitude),
                        Number(office.longitude)
                    )

                    if (dist <= (office.radius_meters || 200)) {
                        locationName = office.name
                        break
                    }
                }

                if (!locationName) {
                    // Strict Geofencing: If office locations exist, user MUST be at an office
                    if (activeLocations.length > 0) {
                        throwAppError('FORBIDDEN', 'You are outside the allowed office location range.')
                    }
                    locationName = 'Remote'
                }
            } catch (err: any) {
                if (err?.code === 'FORBIDDEN') throw err
                console.error('Error resolving location:', err)
                locationName = 'Unknown'
            }
        } else {
            // Strict Geofencing: If office locations exist, location is MANDATORY
            if (activeLocations.length > 0) {
                throwAppError('FORBIDDEN', 'Location access is required to clock in at an office location.')
            }
        }

        const [data] = await db.insert(attendance).values({
            profile_id: profileId,
            date: today,
            check_in: new Date(),
            status: 'pending',
            is_extra_day: isExtraDay || false,
            checkin_latitude: latitude ? String(latitude) : null,
            checkin_longitude: longitude ? String(longitude) : null,
            checkin_location_name: locationName
        }).returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to create clock-in record')

        await db.insert(activities).values({
            user_id: profileId,
            activity_type: 'data_create',
            module: 'attendance',
            description: `Clocked in at ${getLocalTimeIST12Hour()}${isExtraDay ? ' (Extra Work)' : ''}${locationName ? ` from ${locationName}` : ''}`,
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
            description: `Clocked out at ${getLocalTimeIST12Hour()}`,
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
            const parts = checkIn.split(':')
            const h = parts[0].padStart(2, '0')
            const m = (parts[1] || '00').padStart(2, '0')
            updateData.check_in = new Date(`${recordDate}T${h}:${m}:00+05:30`)
        }

        if (checkOut) {
            const parts = checkOut.split(':')
            const h = parts[0].padStart(2, '0')
            const m = (parts[1] || '00').padStart(2, '0')
            updateData.check_out = new Date(`${recordDate}T${h}:${m}:00+05:30`)
        }

        updateData.source = 'manual'
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

    /**
     * Bulk upload daily attendance records from Excel
     * Skips existing records for same employee+date
     */
    static async bulkUploadDailyAttendance({
        records,
        uploadedBy,
        uploaderName
    }: {
        records: Array<{
            profileId: string
            date: string
            checkIn: string       // "HH:MM"
            checkOut: string      // "HH:MM" or empty
            isHalfDay: boolean
            remarks?: string
        }>
        uploadedBy: string
        uploaderName: string
    }): Promise<{ inserted: number, skipped: number, errors: string[] }> {
        let inserted = 0
        let skipped = 0
        const errors: string[] = []

        try {
            // Pre-fetch office settings and closures for holiday & weekly-off detection
            const settings = await SmartCache.getOfficeSettingsCached()
            const closures = await SmartCache.getOfficeClosuresCached()
            const offDays = settings?.off_days || [0]
            const holidaysSet = new Set(closures?.map(c => c.date) || [])

            for (const record of records) {
                try {
                    // Check if date is Sunday (off day) or Holiday
                    const dateObjForDay = new Date(record.date)
                    const dayOfWeek = dateObjForDay.getDay()
                    const isOffDay = offDays.includes(dayOfWeek)
                    const isHoliday = holidaysSet.has(record.date)
                    const isExtraDay = (isOffDay || isHoliday) ? true : false

                    // Build check_in and check_out timestamps
                    let checkInDate: Date | null = null
                    let checkOutDate: Date | null = null

                    if (record.checkIn) {
                        const parts = record.checkIn.split(':')
                        const h = parts[0].padStart(2, '0')
                        const m = (parts[1] || '00').padStart(2, '0')
                        checkInDate = new Date(`${record.date}T${h}:${m}:00+05:30`)
                    }

                    if (record.checkOut) {
                        const parts = record.checkOut.split(':')
                        const h = parts[0].padStart(2, '0')
                        const m = (parts[1] || '00').padStart(2, '0')
                        checkOutDate = new Date(`${record.date}T${h}:${m}:00+05:30`)
                    }

                    // Check if record already exists for this employee+date
                    const existing = await db.query.attendance.findFirst({
                        where: and(
                            eq(attendance.profile_id, record.profileId),
                            eq(attendance.date, record.date)
                        ),
                        columns: { id: true }
                    })

                    // Handle blank row check-in/out times (Absent/Holiday/Leave fallback)
                    if (!checkInDate && !checkOutDate) {
                        if (existing) {
                            // Delete record so calendar/history falls back to Sunday/Holiday/Leave/Absent
                            await db.delete(attendance).where(eq(attendance.id, existing.id))
                            
                            // Insert notification for the employee
                            const notifyMessage = `Your attendance record for ${record.date} has been cleared via bulk upload by ${uploaderName}.`
                            try {
                                await db.insert(notifications).values({
                                    user_id: record.profileId,
                                    title: 'Attendance Cleared',
                                    message: notifyMessage,
                                    type: 'attendance_clear',
                                    link: '/mobile/history'
                                })

                                // Broadcast server event for real-time history reload
                                const { broadcastServerEvent } = await import('@/lib/events/server-broadcaster')
                                broadcastServerEvent('attendance_update', {
                                    action: 'bulk-clear',
                                    employeeId: record.profileId,
                                    date: record.date
                                }, record.profileId)

                                broadcastServerEvent('new_notification', {
                                    title: 'Attendance Cleared',
                                    message: notifyMessage,
                                    type: 'attendance_clear',
                                    link: '/mobile/history',
                                    targetUserId: record.profileId
                                }, record.profileId)
                            } catch (notifyErr) {
                                console.error('Failed to notify employee in bulk clear:', notifyErr)
                            }

                            inserted++
                        } else {
                            skipped++
                        }
                        continue
                    }

                    // Handle update logic
                    if (existing) {
                        // Update existing record with new times and reset status to pending for re-verification
                        await db.update(attendance).set({
                            check_in: checkInDate,
                            check_out: checkOutDate,
                            source: 'bulk',
                            status: 'pending', // Requires re-verification
                            is_half_day: record.isHalfDay,
                            is_extra_day: isExtraDay, // Sunday/holiday extra working day
                            remarks: record.remarks || `Bulk updated by ${uploaderName}`,
                            updated_at: new Date()
                        }).where(eq(attendance.id, existing.id))

                        // Insert notification for the employee
                        const notifyMessage = `Your attendance record for ${record.date} has been updated via bulk upload by ${uploaderName}.`
                        try {
                            await db.insert(notifications).values({
                                    user_id: record.profileId,
                                    title: 'Attendance Updated',
                                    message: notifyMessage,
                                    type: 'attendance_update',
                                    link: '/mobile/history'
                            })

                            // Broadcast server event for real-time history reload
                            const { broadcastServerEvent } = await import('@/lib/events/server-broadcaster')
                            broadcastServerEvent('attendance_update', {
                                action: 'bulk-update',
                                employeeId: record.profileId,
                                date: record.date,
                                remarks: record.remarks || `Bulk updated by ${uploaderName}`
                            }, record.profileId)

                            broadcastServerEvent('new_notification', {
                                title: 'Attendance Updated',
                                message: notifyMessage,
                                type: 'attendance_update',
                                link: '/mobile/history',
                                targetUserId: record.profileId
                            }, record.profileId)
                        } catch (notifyErr) {
                            console.error('Failed to notify employee in bulk update:', notifyErr)
                        }

                        inserted++
                        continue
                    }

                    // Handle creation logic
                    await db.insert(attendance).values({
                        profile_id: record.profileId,
                        date: record.date,
                        check_in: checkInDate,
                        check_out: checkOutDate,
                        status: 'pending',
                        source: 'bulk',
                        is_half_day: record.isHalfDay,
                        is_extra_day: isExtraDay, // Sunday/holiday extra working day
                        remarks: record.remarks || `Bulk uploaded by ${uploaderName}`,
                    })

                    // Insert notification for the employee
                    const notifyMessage = `New attendance record for ${record.date} has been created via bulk upload by ${uploaderName}.`
                    try {
                        await db.insert(notifications).values({
                            user_id: record.profileId,
                            title: 'Attendance Created',
                            message: notifyMessage,
                            type: 'attendance_create',
                            link: '/mobile/history'
                        })

                        // Broadcast server event for real-time history reload
                        const { broadcastServerEvent } = await import('@/lib/events/server-broadcaster')
                        broadcastServerEvent('attendance_update', {
                            action: 'bulk-create',
                            employeeId: record.profileId,
                            date: record.date,
                            remarks: record.remarks || `Bulk uploaded by ${uploaderName}`
                        }, record.profileId)

                        broadcastServerEvent('new_notification', {
                            title: 'Attendance Created',
                            message: notifyMessage,
                            type: 'attendance_create',
                            link: '/mobile/history',
                            targetUserId: record.profileId
                        }, record.profileId)
                    } catch (notifyErr) {
                        console.error('Failed to notify employee in bulk insert:', notifyErr)
                    }

                    inserted++
                } catch (err: any) {
                    errors.push(`Failed to insert/update record for date ${record.date}: ${err.message}`)
                }
            }
        } catch (setupErr: any) {
            errors.push(`General setup error in daily bulk upload: ${setupErr.message}`)
        }

        // Log activity
        if (inserted > 0) {
            await db.insert(activities).values({
                user_id: uploadedBy,
                activity_type: 'data_create',
                module: 'attendance',
                description: `Bulk uploaded ${inserted} daily attendance records (${skipped} skipped) by ${uploaderName}`,
            })
        }

        return { inserted, skipped, errors }
    }
}

