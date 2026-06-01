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
        uploaderName,
        preview = false
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
        preview?: boolean
    }): Promise<{
        inserted: number
        skipped: number
        errors: string[]
        toInsert?: number
        toUpdate?: number
        toDelete?: number
        previewDetails?: Array<{
            profileId: string
            date: string
            action: 'Insert' | 'Update' | 'Clear' | 'Skip'
            details: string
            reason?: string
        }>
    }> {
        let inserted = 0
        let skipped = 0
        const errors: string[] = []
        const previewDetails: Array<{
            profileId: string
            date: string
            action: 'Insert' | 'Update' | 'Clear' | 'Skip'
            details: string
            reason?: string
        }> = []

        try {
            // Pre-fetch office settings and closures for holiday & weekly-off detection
            const settings = await SmartCache.getOfficeSettingsCached()
            const closures = await SmartCache.getOfficeClosuresCached()
            const offDays = settings?.off_days || [0]
            const holidaysSet = new Set(closures?.map(c => c.date) || [])

            const profileIds = [...new Set(records.map(r => r.profileId))]
            const dates = [...new Set(records.map(r => r.date))]

            // Fetch all existing attendance records for the profile IDs and dates in a single query with strict column projection
            const existingMap = new Map<string, any>()
            if (profileIds.length > 0 && dates.length > 0) {
                const existingRecords = await db.select({
                    id: attendance.id,
                    profile_id: attendance.profile_id,
                    date: attendance.date
                })
                .from(attendance)
                .where(and(
                    inArray(attendance.profile_id, profileIds),
                    inArray(attendance.date, dates)
                ))
                for (const r of existingRecords) {
                    existingMap.set(`${r.profile_id}_${r.date}`, r)
                }
            }

            const recordsToUpsert: any[] = []
            const idsToDelete: string[] = []
            const notificationsToInsert: any[] = []
            const broadcastTasks: Array<{
                employeeId: string
                message: string
                title: string
                type: string
                action: string
            }> = []

            // Track changes by employee to send exactly 1 consolidated notification and event per employee
            const employeeStats = new Map<string, {
                insertedCount: number
                updatedCount: number
                clearedCount: number
            }>()

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

                    const existing = existingMap.get(`${record.profileId}_${record.date}`)

                    // Handle blank row check-in/out times (Absent/Holiday/Leave fallback)
                    if (!checkInDate && !checkOutDate) {
                        if (existing) {
                            idsToDelete.push(existing.id)

                            const stats = employeeStats.get(record.profileId) || { insertedCount: 0, updatedCount: 0, clearedCount: 0 }
                            stats.clearedCount++
                            employeeStats.set(record.profileId, stats)

                            inserted++
                            if (preview) {
                                previewDetails.push({
                                    profileId: record.profileId,
                                    date: record.date,
                                    action: 'Clear',
                                    details: 'Check-in and Check-out blank, existing log will be deleted'
                                })
                            }
                        } else {
                            skipped++
                            if (preview) {
                                previewDetails.push({
                                    profileId: record.profileId,
                                    date: record.date,
                                    action: 'Skip',
                                    details: '',
                                    reason: 'Blank check-in and check-out times'
                                })
                            }
                        }
                        continue
                    }

                    // For high speed, we collect everything into a single bulk upsert list
                    recordsToUpsert.push({
                        profile_id: record.profileId,
                        date: record.date,
                        check_in: checkInDate,
                        check_out: checkOutDate,
                        status: 'pending', // Requires re-verification
                        source: 'bulk',
                        is_half_day: record.isHalfDay,
                        is_extra_day: isExtraDay, // Sunday/holiday extra working day
                        remarks: record.remarks || `Bulk uploaded by ${uploaderName}`,
                        updated_at: new Date()
                    })

                    const stats = employeeStats.get(record.profileId) || { insertedCount: 0, updatedCount: 0, clearedCount: 0 }
                    if (existing) {
                        stats.updatedCount++
                    } else {
                        stats.insertedCount++
                    }
                    employeeStats.set(record.profileId, stats)

                    inserted++
                    if (preview) {
                        previewDetails.push({
                            profileId: record.profileId,
                            date: record.date,
                            action: existing ? 'Update' : 'Insert',
                            details: `Check-In: ${record.checkIn || 'None'}, Check-Out: ${record.checkOut || 'None'}${record.isHalfDay ? ' (Half Day)' : ''}`
                        })
                    }
                } catch (err: any) {
                    errors.push(`Failed to prepare record for date ${record.date}: ${err.message}`)
                    if (preview) {
                        previewDetails.push({
                            profileId: record.profileId,
                            date: record.date,
                            action: 'Skip',
                            details: '',
                            reason: err.message || 'Validation error'
                        })
                    }
                }
            }

            // If preview mode, return predicted insertion, update, and deletion numbers instantly without writing anything
            if (preview) {
                const toInsertCount = recordsToUpsert.filter(r => !existingMap.has(`${r.profile_id}_${r.date}`)).length
                const toUpdateCount = recordsToUpsert.filter(r => existingMap.has(`${r.profile_id}_${r.date}`)).length
                return {
                    inserted: 0,
                    skipped: skipped,
                    errors,
                    toInsert: toInsertCount,
                    toUpdate: toUpdateCount,
                    toDelete: idsToDelete.length,
                    previewDetails
                }
            }

            // Generate exactly ONE consolidated notification and broadcast task per employee
            for (const [employeeId, stats] of employeeStats.entries()) {
                const totalChanges = stats.insertedCount + stats.updatedCount + stats.clearedCount
                if (totalChanges === 0) continue

                let notifyMessage = ''
                let title = 'Attendance Uploaded'
                let type = 'attendance_update'

                if (stats.clearedCount > 0 && stats.insertedCount === 0 && stats.updatedCount === 0) {
                    notifyMessage = `Your attendance records for ${stats.clearedCount} days have been cleared via bulk upload by ${uploaderName}.`
                    title = 'Attendance Cleared'
                    type = 'attendance_clear'
                } else if (stats.insertedCount > 0 && stats.updatedCount === 0 && stats.clearedCount === 0) {
                    notifyMessage = `New attendance records for ${stats.insertedCount} days have been created via bulk upload by ${uploaderName}.`
                    title = 'Attendance Created'
                    type = 'attendance_create'
                } else {
                    notifyMessage = `Your attendance records have been updated for ${totalChanges} days via bulk upload by ${uploaderName}.`
                }

                notificationsToInsert.push({
                    user_id: employeeId,
                    title,
                    message: notifyMessage,
                    type,
                    link: '/mobile/history'
                })

                broadcastTasks.push({
                    employeeId,
                    message: notifyMessage,
                    title,
                    type,
                    action: 'bulk-update-complete'
                })
            }

            // Run all database operations inside a single database transaction
            if (idsToDelete.length > 0 || recordsToUpsert.length > 0 || notificationsToInsert.length > 0) {
                await db.transaction(async (tx) => {
                    if (idsToDelete.length > 0) {
                        await tx.delete(attendance).where(inArray(attendance.id, idsToDelete))
                    }
                    if (recordsToUpsert.length > 0) {
                        await tx.insert(attendance)
                            .values(recordsToUpsert)
                            .onConflictDoUpdate({
                                target: [attendance.profile_id, attendance.date],
                                set: {
                                    check_in: sql`EXCLUDED.check_in`,
                                    check_out: sql`EXCLUDED.check_out`,
                                    source: sql`EXCLUDED.source`,
                                    status: sql`EXCLUDED.status`,
                                    is_half_day: sql`EXCLUDED.is_half_day`,
                                    is_extra_day: sql`EXCLUDED.is_extra_day`,
                                    remarks: sql`EXCLUDED.remarks`,
                                    updated_at: sql`EXCLUDED.updated_at`
                                }
                            })
                    }
                    if (notificationsToInsert.length > 0) {
                        await tx.insert(notifications).values(notificationsToInsert)
                    }
                })
            }

            // Trigger background broadcasts asynchronously without blocking the main HTTP execution thread
            if (broadcastTasks.length > 0) {
                setImmediate(() => {
                    (async () => {
                        try {
                            const { broadcastServerEvent } = await import('@/lib/events/server-broadcaster')
                            
                            // If there are many employees affected, broadcast a single dashboard_sync event
                            // instead of hundreds of individual employee events to prevent socket connection exhaustion and rate limits.
                            if (broadcastTasks.length > 5) {
                                console.log(`[SERVER-BROADCAST] Large bulk upload (${broadcastTasks.length} employees). Broadcasting single dashboard_sync event.`)
                                await broadcastServerEvent('dashboard_sync', {
                                    action: 'bulk-upload-complete',
                                    message: `Bulk upload completed for ${broadcastTasks.length} employees.`,
                                    timestamp: new Date().toISOString()
                                })
                            } else {
                                // Run the few broadcasts sequentially in background to avoid concurrent connection spikes
                                for (const task of broadcastTasks) {
                                    try {
                                        await broadcastServerEvent('attendance_update', {
                                            action: 'bulk-update-complete',
                                            employeeId: task.employeeId,
                                            message: task.message
                                        }, task.employeeId)

                                        await broadcastServerEvent('new_notification', {
                                            title: task.title,
                                            message: task.message,
                                            type: task.type,
                                            link: '/mobile/history',
                                            targetUserId: task.employeeId
                                        }, task.employeeId)
                                    } catch (taskErr) {
                                        console.error(`Failed to broadcast for employee ${task.employeeId}:`, taskErr)
                                    }
                                }
                            }
                        } catch (broadcastErr) {
                            console.error('Failed to broadcast in background:', broadcastErr)
                        }
                    })()
                })
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

