import { db } from '@/lib/db'
import { attendance, attendanceSessions, biometricRawLogs, activities, officeSettings, officeClosures, officeLocations, notifications, leaves, profiles } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'
import { SmartCache } from '@/lib/cache/smart-cache'
import { getLocalDateIST, getLocalTimeIST12Hour } from '@/lib/utils/date-utils'
import { differenceInMinutes } from 'date-fns'

import { tenantStorage } from '@/lib/tenant/store'

// ─ One-time flag per tenant schema — skips repeated CREATE TABLE IF NOT EXISTS round-trips
const _attendanceSchemaEnsured = new Set<string>()

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
        // Resolve date range
        let finalStartDate = startDate || getLocalDateIST()
        let finalEndDate = endDate || getLocalDateIST()

        if (mode === 'default' && !startDate && !endDate) {
            finalStartDate = getLocalDateIST()
            finalEndDate = getLocalDateIST()
        }

        // Parse date objects safely to construct the dates list
        const startParts = finalStartDate.split('-').map(Number)
        const endParts = finalEndDate.split('-').map(Number)
        const start = new Date(startParts[0], startParts[1] - 1, startParts[2])
        const end = new Date(endParts[0], endParts[1] - 1, endParts[2])

        // Cap date range to prevent infinite loops (max 31 days)
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays > 31) {
            start.setDate(end.getDate() - 31)
        }

        const dates: string[] = []
        const curr = new Date(start)
        while (curr <= end) {
            const y = curr.getFullYear()
            const m = String(curr.getMonth() + 1).padStart(2, '0')
            const d = String(curr.getDate()).padStart(2, '0')
            dates.push(`${y}-${m}-${d}`)
            curr.setDate(curr.getDate() + 1)
        }

        if (dates.length === 0) return []

        // Resolve profiles
        const isEmployee = role === 'employee'
        const filterProfileId = isEmployee ? profileId : profileId
        
        if (isEmployee && !filterProfileId) {
            throwAppError('UNAUTHORIZED', 'Profile ID is required for employee role')
        }

        const [targetProfiles, settings, allClosures] = await Promise.all([
            db.query.profiles.findMany({
                where: filterProfileId ? eq(profiles.id, filterProfileId) : eq(profiles.status, 'active'),
                columns: {
                    id: true,
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
            }),
            SmartCache.getOfficeSettingsCached(),
            SmartCache.getOfficeClosuresCached()
        ])

        if (targetProfiles.length === 0) return []
        const employeeIds = targetProfiles.map(p => p.id)

        const offDays = settings?.off_days || [0]
        const closures = allClosures.filter(c => c.date >= dates[0] && c.date <= dates[dates.length - 1])
        const closuresMap = new Map(closures.map(c => [c.date, c.reason]))

        // Fetch leaves (both approved and pending) for employees in range & actual attendance records concurrently
        const [leavesList, actualRecords] = await Promise.all([
            db.query.leaves.findMany({
                where: and(
                    inArray(leaves.profile_id, employeeIds),
                    inArray(leaves.status, ['approved', 'pending']),
                    lte(leaves.start_date, dates[dates.length - 1]),
                    gte(leaves.end_date, dates[0])
                )
            }),
            db.query.attendance.findMany({
                where: and(
                    inArray(attendance.profile_id, employeeIds),
                    gte(attendance.date, dates[0]),
                    lte(attendance.date, dates[dates.length - 1])
                )
            })
        ])

        // Build a profile lookup map from targetProfiles to stitch profiles in memory (avoiding redundant DB joins)
        const profilesMap = new Map<string, any>(targetProfiles.map((p: any) => [p.id, p]))

        const actualMap = new Map<string, any>()
        for (const r of actualRecords) {
            const profile = profilesMap.get(r.profile_id)
            actualMap.set(`${r.profile_id}_${r.date}`, {
                ...r,
                profile: profile ? {
                    id: profile.id,
                    email: profile.email,
                    full_name: profile.full_name,
                    role: profile.role,
                    avatar_url: profile.avatar_url,
                    sex: profile.sex,
                    designation: profile.designation
                } : null
            })
        }

        const results: any[] = []

        for (const dateStr of dates) {
            for (const profile of targetProfiles) {
                const key = `${profile.id}_${dateStr}`
                const actual = actualMap.get(key)
                if (actual) {
                    results.push({
                        ...actual,
                        working_hours: actual.working_hours ? Number(actual.working_hours) : null
                    })
                } else {
                    const matchedLeave = leavesList.find(l => 
                        l.profile_id === profile.id && 
                        dateStr >= l.start_date && 
                        dateStr <= l.end_date
                    )
                    const dateObj = new Date(dateStr)
                    const dayOfWeek = dateObj.getDay()
                    const isWeeklyOff = offDays.includes(dayOfWeek)
                    const holidayReason = closuresMap.get(dateStr)

                    let status: string = 'absent'
                    let isHalfDay = false
                    let remarks = 'System Generated (Absent)'

                    if (matchedLeave) {
                        if (matchedLeave.status === 'approved') {
                            status = 'verified'
                            remarks = `Leave: ${matchedLeave.leave_type || 'Casual'} (approved)`
                        } else {
                            status = 'leave'
                            remarks = `Leave: ${matchedLeave.leave_type || 'Casual'} (pending)`
                        }
                        isHalfDay = matchedLeave.is_half_day || false
                    } else if (holidayReason) {
                        status = 'verified'
                        remarks = `Holiday: ${holidayReason}`
                    } else if (isWeeklyOff) {
                        status = 'verified'
                        remarks = 'Weekly Off'
                    }

                    results.push({
                        id: `virtual_${profile.id}_${dateStr}`,
                        profile_id: profile.id,
                        date: dateStr,
                        check_in: null,
                        check_out: null,
                        working_hours: null,
                        status: status,
                        remarks: remarks,
                        verified_by: null,
                        is_extra_day: false,
                        is_half_day: isHalfDay,
                        source: 'bulk',
                        device_id: null,
                        selfie_url: null,
                        checkin_latitude: null,
                        checkin_longitude: null,
                        checkin_location_name: null,
                        face_match_score: null,
                        created_at: new Date(`${dateStr}T00:00:00.000Z`),
                        updated_at: new Date(`${dateStr}T00:00:00.000Z`),
                        profile: {
                            id: profile.id,
                            email: profile.email,
                            full_name: profile.full_name,
                            role: profile.role,
                            avatar_url: profile.avatar_url,
                            sex: profile.sex,
                            designation: profile.designation
                        }
                    })
                }
            }
        }

        // Sort: date descending, then full name ascending
        return results.sort((a, b) => 
            b.date.localeCompare(a.date) || 
            (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '')
        )
    }

    static async ensureAttendanceSchema() {
        const schemaKey = tenantStorage.getStore()?.tenantSchema || 'public'
        if (_attendanceSchemaEnsured.has(schemaKey)) return // Skip if already ensured this process lifetime
        try {
            await db.execute(sql`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
                        CREATE TYPE "attendance_source" AS ENUM ('mobile', 'biometric', 'manual', 'bulk', 'kiosk');
                    ELSE
                        ALTER TYPE "attendance_source" ADD VALUE IF NOT EXISTS 'kiosk';
                    END IF;
                END $$;

                ALTER TABLE IF EXISTS "attendance" 
                ADD COLUMN IF NOT EXISTS "first_check_in" timestamp with time zone,
                ADD COLUMN IF NOT EXISTS "last_check_out" timestamp with time zone,
                ADD COLUMN IF NOT EXISTS "total_sessions" integer DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "current_session_status" text DEFAULT 'checked_out',
                ADD COLUMN IF NOT EXISTS "location_id" uuid;

                CREATE TABLE IF NOT EXISTS "attendance_sessions" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "attendance_id" uuid REFERENCES "attendance"("id") ON DELETE CASCADE,
                    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
                    "date" date NOT NULL,
                    "session_number" integer NOT NULL DEFAULT 1,
                    "check_in" timestamp with time zone NOT NULL,
                    "check_out" timestamp with time zone,
                    "working_hours" numeric,
                    "source" text DEFAULT 'mobile',
                    "device_id" text,
                    "location_id" uuid,
                    "selfie_url" text,
                    "checkin_latitude" numeric(10, 7),
                    "checkin_longitude" numeric(10, 7),
                    "checkin_location_name" text,
                    "checkout_latitude" numeric(10, 7),
                    "checkout_longitude" numeric(10, 7),
                    "checkout_location_name" text,
                    "status" text NOT NULL DEFAULT 'active',
                    "created_at" timestamp with time zone DEFAULT now(),
                    "updated_at" timestamp with time zone DEFAULT now()
                );

                CREATE TABLE IF NOT EXISTS "biometric_raw_logs" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "profile_id" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
                    "biometric_user_id" text NOT NULL,
                    "device_id" text,
                    "location_id" uuid,
                    "punch_time" timestamp with time zone NOT NULL,
                    "punch_type" integer,
                    "raw_payload" jsonb,
                    "created_at" timestamp with time zone DEFAULT now()
                );
            `);
            _attendanceSchemaEnsured.add(schemaKey)
        } catch (e) {
            // Ignore schema check error if already up to date
        }
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
        longitude,
        source = 'mobile',
        deviceId,
        locationId,
        selfieUrl
    }: {
        profileId: string
        fullName?: string
        email: string
        localDate?: string
        isExtraDay?: boolean
        latitude?: number
        longitude?: number
        source?: string
        deviceId?: string
        locationId?: string
        selfieUrl?: string
    }) {
        await AttendanceService.ensureAttendanceSchema()
        const today = localDate || getLocalDateIST()
        const dayOfWeek = new Date(today).getDay()

        const settings = await SmartCache.getOfficeSettingsCached()
        const closures = await SmartCache.getOfficeClosuresCached()

        const isOffDay = settings?.off_days?.includes(dayOfWeek)
        const isHoliday = closures?.some(c => c.date === today)

        // For off days and holidays, they are automatically clocked in as pending extra days
        const autoExtraDay = isOffDay || isHoliday

        // Check if an active session exists for this user today
        const activeSession = await db.query.attendanceSessions.findFirst({
            where: and(
                eq(attendanceSessions.profile_id, profileId),
                eq(attendanceSessions.date, today),
                eq(attendanceSessions.status, 'active')
            )
        })

        if (activeSession) {
            throwAppError('ALREADY_CLOCKED_IN', 'An active attendance session is currently in progress. Please clock out first.')
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
        } else if (source === 'mobile') {
            // Strict Geofencing: If office locations exist, location is MANDATORY for mobile punches
            if (activeLocations.length > 0) {
                throwAppError('FORBIDDEN', 'Location access is required to clock in at an office location.')
            }
        }

        const now = new Date()

        // Fetch parent attendance record
        let parentRecord = await db.query.attendance.findFirst({
            where: and(
                eq(attendance.profile_id, profileId),
                eq(attendance.date, today)
            )
        })

        const currentTotalSessions = (parentRecord?.total_sessions || 0) + 1

        const validSource = (source === 'kiosk' ? 'biometric' : (source || 'mobile')) as any

        if (!parentRecord) {
            const [newParent] = await db.insert(attendance).values({
                profile_id: profileId,
                date: today,
                check_in: now,
                first_check_in: now,
                total_sessions: 1,
                current_session_status: 'checked_in',
                status: 'pending',
                source: validSource,
                device_id: deviceId || null,
                location_id: locationId || null,
                selfie_url: selfieUrl || null,
                is_extra_day: isExtraDay || autoExtraDay,
                checkin_latitude: latitude ? String(latitude) : null,
                checkin_longitude: longitude ? String(longitude) : null,
                checkin_location_name: locationName
            }).returning()
            parentRecord = newParent
        } else {
            const [updatedParent] = await db.update(attendance).set({
                total_sessions: currentTotalSessions,
                current_session_status: 'checked_in',
                first_check_in: parentRecord.first_check_in || parentRecord.check_in || now,
                updated_at: now
            }).where(eq(attendance.id, parentRecord.id)).returning()
            parentRecord = updatedParent
        }

        // Insert session + activity in parallel (independent writes)
        await Promise.all([
            db.insert(attendanceSessions).values({
                attendance_id: parentRecord.id,
                profile_id: profileId,
                date: today,
                session_number: currentTotalSessions,
                check_in: now,
                status: 'active',
                source: source || 'mobile',
                device_id: deviceId || null,
                location_id: locationId || null,
                selfie_url: selfieUrl || null,
                checkin_latitude: latitude ? String(latitude) : null,
                checkin_longitude: longitude ? String(longitude) : null,
                checkin_location_name: locationName
            }),
            db.insert(activities).values({
                user_id: profileId,
                activity_type: 'data_create',
                module: 'attendance',
                description: `Clocked in (Session #${currentTotalSessions}) at ${getLocalTimeIST12Hour()}${isExtraDay ? ' (Extra Work)' : ''}${locationName ? ` from ${locationName}` : ''}`,
            })
        ])

        return parentRecord
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
        await AttendanceService.ensureAttendanceSchema()
        const today = localDate || getLocalDateIST()
        const now = new Date()

        // Find active session
        const activeSession = await db.query.attendanceSessions.findFirst({
            where: and(
                eq(attendanceSessions.profile_id, profileId),
                eq(attendanceSessions.status, 'active')
            ),
            orderBy: [desc(attendanceSessions.created_at)]
        })

        const record = await db.query.attendance.findFirst({
            where: and(
                eq(attendance.profile_id, profileId),
                eq(attendance.date, today)
            )
        })

        if (!record && !activeSession) {
            throwAppError('NO_CLOCK_IN_FOUND', 'No clock-in record found to clock out.')
        }

        const attendanceId = activeSession?.attendance_id || record?.id

        if (activeSession) {
            const diffMins = differenceInMinutes(now, new Date(activeSession.check_in))
            const sessionHours = (diffMins / 60).toFixed(2)

            await db.update(attendanceSessions).set({
                check_out: now,
                working_hours: sessionHours,
                status: 'completed',
                updated_at: now
            }).where(eq(attendanceSessions.id, activeSession.id))
        }

        // Calculate cumulative working hours across all completed sessions for this parent record
        let totalHoursStr = record?.working_hours || '0'
        if (attendanceId) {
            const completedSessions = await db.query.attendanceSessions.findMany({
                where: and(
                    eq(attendanceSessions.attendance_id, attendanceId),
                    eq(attendanceSessions.status, 'completed')
                )
            })

            const totalMins = completedSessions.reduce((acc, s) => {
                return acc + (s.working_hours ? Math.round(Number(s.working_hours) * 60) : 0)
            }, 0)

            totalHoursStr = (totalMins / 60).toFixed(2)
        }

        const [[data]] = await Promise.all([
            db.update(attendance).set({
                check_out: now,
                last_check_out: now,
                working_hours: totalHoursStr,
                current_session_status: 'checked_out',
                updated_at: now
            }).where(eq(attendance.id, attendanceId!)).returning(),
            db.insert(activities).values({
                user_id: profileId,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `Clocked out at ${getLocalTimeIST12Hour()}`,
            })
        ])

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to update clock-out record')

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
        let recordId = id
        if (id.startsWith('virtual_')) {
            const parts = id.split('_')
            const profileId = parts[1]
            const recordDate = parts[2]

            const existing = await db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, profileId),
                    eq(attendance.date, recordDate)
                )
            })

            if (existing) {
                recordId = existing.id
            } else {
                const settings = await SmartCache.getOfficeSettingsCached()
                const closures = await SmartCache.getOfficeClosuresCached()
                const dayOfWeek = new Date(recordDate).getDay()
                const isOffDay = settings?.off_days?.includes(dayOfWeek)
                const isHoliday = closures?.some(c => c.date === recordDate)
                const isExtraDay = (isOffDay || isHoliday) ? true : false

                const [inserted] = await db.insert(attendance).values({
                    profile_id: profileId,
                    date: recordDate,
                    check_in: null,
                    check_out: null,
                    status: 'pending',
                    remarks: remarks || 'System generated from virtual log verification',
                    source: 'bulk',
                    is_extra_day: isExtraDay,
                    is_half_day: isHalfDay ?? false,
                    updated_at: new Date()
                }).returning()
                recordId = inserted.id
            }
        }

        const [data] = await db.update(attendance).set({
            status,
            remarks,
            is_half_day: isHalfDay ?? false,
            verified_by: verifiedBy,
            updated_at: new Date()
        }).where(eq(attendance.id, recordId)).returning()

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to verify attendance')

        // Sync leaf records status in leaves table
        const matchingLeaves = await db.query.leaves.findMany({
            where: and(
                eq(leaves.profile_id, data.profile_id),
                lte(leaves.start_date, data.date),
                gte(leaves.end_date, data.date)
            )
        })
        for (const l of matchingLeaves) {
            const newLeaveStatus = status === 'verified' ? 'approved' : 'rejected'
            await db.update(leaves).set({
                status: newLeaveStatus,
                remarks: remarks || `Leave status updated to ${newLeaveStatus} via attendance verification by ${verifierName}`,
                approved_by: verifiedBy,
                updated_at: new Date()
            }).where(eq(leaves.id, l.id))
        }

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
        const resolvedIds: string[] = []

        for (const id of ids) {
            if (id.startsWith('virtual_')) {
                const parts = id.split('_')
                const profileId = parts[1]
                const recordDate = parts[2]

                const existing = await db.query.attendance.findFirst({
                    where: and(
                        eq(attendance.profile_id, profileId),
                        eq(attendance.date, recordDate)
                    )
                })

                if (existing) {
                    resolvedIds.push(existing.id)
                } else {
                    const settings = await SmartCache.getOfficeSettingsCached()
                    const closures = await SmartCache.getOfficeClosuresCached()
                    const dayOfWeek = new Date(recordDate).getDay()
                    const isOffDay = settings?.off_days?.includes(dayOfWeek)
                    const isHoliday = closures?.some(c => c.date === recordDate)
                    const isExtraDay = (isOffDay || isHoliday) ? true : false

                    const [inserted] = await db.insert(attendance).values({
                        profile_id: profileId,
                        date: recordDate,
                        check_in: null,
                        check_out: null,
                        status: 'pending',
                        remarks: remarks || 'System generated from virtual log bulk verification',
                        source: 'bulk',
                        is_extra_day: isExtraDay,
                        updated_at: new Date()
                    }).returning()
                    resolvedIds.push(inserted.id)
                }
            } else {
                resolvedIds.push(id)
            }
        }

        if (resolvedIds.length === 0) return []

        const updatedRecords = await db.update(attendance).set({
            status,
            remarks,
            verified_by: verifiedBy,
            updated_at: new Date()
        }).where(inArray(attendance.id, resolvedIds)).returning()

        if (!updatedRecords.length) throwAppError('NOT_FOUND', 'No records found to update')

        // Sync leaf records status in leaves table
        for (const r of updatedRecords) {
            const matchingLeaves = await db.query.leaves.findMany({
                where: and(
                    eq(leaves.profile_id, r.profile_id),
                    lte(leaves.start_date, r.date),
                    gte(leaves.end_date, r.date)
                )
            })
            for (const l of matchingLeaves) {
                const newLeaveStatus = status === 'verified' ? 'approved' : 'rejected'
                await db.update(leaves).set({
                    status: newLeaveStatus,
                    remarks: remarks || `Leave status updated to ${newLeaveStatus} via bulk attendance verification by ${verifierName}`,
                    approved_by: verifiedBy,
                    updated_at: new Date()
                }).where(eq(leaves.id, l.id))
            }
        }

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
        isExtraDay,
        remarks,
        updatedBy,
        updaterName
    }: {
        id: string
        checkIn?: string | null
        checkOut?: string | null
        status?: 'pending' | 'verified' | 'rejected'
        isHalfDay?: boolean
        isExtraDay?: boolean
        remarks?: string
        updatedBy: string
        updaterName: string
    }) {
        let recordId = id
        let recordDate = ''
        let profileId = ''

        if (id.startsWith('virtual_')) {
            const parts = id.split('_')
            profileId = parts[1]
            recordDate = parts[2]

            const dbRecord = await db.query.attendance.findFirst({
                where: and(
                    eq(attendance.profile_id, profileId),
                    eq(attendance.date, recordDate)
                )
            })

            if (dbRecord) {
                recordId = dbRecord.id
                recordDate = dbRecord.date
            }
        } else {
            const dbRecord = await db.query.attendance.findFirst({
                where: eq(attendance.id, id)
            })
            if (!dbRecord) {
                throwAppError('NOT_FOUND', 'Attendance record not found')
            }
            recordId = dbRecord.id
            recordDate = dbRecord.date
            profileId = dbRecord.profile_id
        }

        const updateData: any = {
            updated_at: new Date()
        }

        if (checkIn !== undefined) {
            if (!checkIn) {
                updateData.check_in = null
            } else {
                const parts = checkIn.split(':')
                const h = parts[0].padStart(2, '0')
                const m = (parts[1] || '00').padStart(2, '0')
                updateData.check_in = new Date(`${recordDate}T${h}:${m}:00+05:30`)
            }
        }

        if (checkOut !== undefined) {
            if (!checkOut) {
                updateData.check_out = null
            } else {
                const parts = checkOut.split(':')
                const h = parts[0].padStart(2, '0')
                const m = (parts[1] || '00').padStart(2, '0')
                updateData.check_out = new Date(`${recordDate}T${h}:${m}:00+05:30`)
            }
        }

        updateData.source = 'manual'
        if (status) updateData.status = status
        if (isHalfDay !== undefined) updateData.is_half_day = isHalfDay
        if (isExtraDay !== undefined) updateData.is_extra_day = isExtraDay
        if (remarks) updateData.remarks = remarks

        let data: any

        if (id.startsWith('virtual_') && recordId === id) {
            const settings = await SmartCache.getOfficeSettingsCached()
            const closures = await SmartCache.getOfficeClosuresCached()
            const dayOfWeek = new Date(recordDate).getDay()
            const isOffDay = settings?.off_days?.includes(dayOfWeek)
            const isHoliday = closures?.some(c => c.date === recordDate)
            const autoExtraDay = (isOffDay || isHoliday) ? true : false

            const resolvedExtraDay = isExtraDay !== undefined ? isExtraDay : autoExtraDay

            const [inserted] = await db.insert(attendance).values({
                profile_id: profileId,
                date: recordDate,
                check_in: updateData.check_in || null,
                check_out: updateData.check_out || null,
                status: status || 'pending',
                is_half_day: isHalfDay ?? false,
                is_extra_day: resolvedExtraDay,
                remarks: remarks || `Manually created from virtual log by ${updaterName}`,
                source: 'manual',
                updated_at: new Date()
            }).returning()
            data = inserted
        } else {
            const [updated] = await db.update(attendance)
                .set(updateData)
                .where(eq(attendance.id, recordId))
                .returning()
            data = updated
        }

        if (!data) throwAppError('DATABASE_ERROR', 'Failed to update attendance record')

        // Sync leaves table state
        const matchingLeaves = await db.query.leaves.findMany({
            where: and(
                eq(leaves.profile_id, data.profile_id),
                lte(leaves.start_date, data.date),
                gte(leaves.end_date, data.date)
            )
        })
        for (const l of matchingLeaves) {
            const newLeaveStatus = (data.status === 'verified' || data.status === 'leave') ? 'approved' : 'rejected'
            await db.update(leaves).set({
                status: newLeaveStatus,
                remarks: remarks || `Leave status updated to ${newLeaveStatus} via manual attendance update by ${updaterName}`,
                approved_by: updatedBy,
                updated_at: new Date()
            }).where(eq(leaves.id, l.id))
        }

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
            status?: string       // "absent", "leave", etc.
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

            // Fetch all existing leave records for the profile IDs and dates in a single query with strict column projection
            const existingLeaves: any[] = []
            if (profileIds.length > 0 && dates.length > 0) {
                const minDate = dates.reduce((a, b) => a < b ? a : b)
                const maxDate = dates.reduce((a, b) => a > b ? a : b)
                const fetchedLeaves = await db.select({
                    id: leaves.id,
                    profile_id: leaves.profile_id,
                    start_date: leaves.start_date,
                    end_date: leaves.end_date,
                    status: leaves.status
                })
                .from(leaves)
                .where(and(
                    inArray(leaves.profile_id, profileIds),
                    gte(leaves.end_date, minDate),
                    lte(leaves.start_date, maxDate)
                ))
                existingLeaves.push(...fetchedLeaves)
            }

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
            const leavesToInsert: any[] = []
            const leaveIdsToDelete: string[] = []
            const leavesToUpdate: Array<{ id: string; values: any }> = []
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

                    // --- Leaves Sync Logic ---
                    const matchedLeave = existingLeaves.find(l => 
                        l.profile_id === record.profileId && 
                        record.date >= l.start_date && 
                        record.date <= l.end_date
                    )

                    if (record.status === 'leave') {
                        if (matchedLeave) {
                            if (matchedLeave.start_date === record.date && matchedLeave.end_date === record.date) {
                                leavesToUpdate.push({
                                    id: matchedLeave.id,
                                    values: {
                                        status: 'approved',
                                        is_half_day: record.isHalfDay,
                                        remarks: record.remarks || `Daily attendance leave override updated by Excel upload`,
                                        approved_by: uploadedBy,
                                        updated_at: new Date()
                                    }
                                })
                            }
                        } else {
                            leavesToInsert.push({
                                profile_id: record.profileId,
                                leave_type: record.isHalfDay ? 'Half Day Leave' : 'Casual Leave',
                                start_date: record.date,
                                end_date: record.date,
                                is_half_day: record.isHalfDay,
                                reason: record.remarks || `Daily attendance leave override via Excel upload`,
                                status: 'approved',
                                remarks: record.remarks || `Daily attendance leave override via Excel upload by ${uploaderName}`,
                                approved_by: uploadedBy,
                                created_at: new Date(),
                                updated_at: new Date()
                            })
                        }
                    } else {
                        // If daily status is not leave, check if there's a single-day leave on this exact date to remove
                        if (matchedLeave && matchedLeave.start_date === record.date && matchedLeave.end_date === record.date) {
                            leaveIdsToDelete.push(matchedLeave.id)
                        }
                    }

                    // Handle blank row check-in/out times (Absent/Holiday/Leave/Weekly Off/Holiday fallback)
                    if (!checkInDate && !checkOutDate && record.status !== 'absent' && record.status !== 'leave' && record.status !== 'weekly_off' && record.status !== 'holiday') {
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
                        status: record.status || 'pending', // 'absent', 'leave', or 'pending'
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
                            details: record.status === 'absent' || record.status === 'leave' || record.status === 'weekly_off' || record.status === 'holiday'
                                ? `Marked Explicit ${record.status.toUpperCase()}`
                                : `Check-In: ${record.checkIn || 'None'}, Check-Out: ${record.checkOut || 'None'}${record.isHalfDay ? ' (Half Day)' : ''}`
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
            if (
                idsToDelete.length > 0 || 
                recordsToUpsert.length > 0 || 
                notificationsToInsert.length > 0 ||
                leavesToInsert.length > 0 ||
                leaveIdsToDelete.length > 0 ||
                leavesToUpdate.length > 0
            ) {
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
                    if (leaveIdsToDelete.length > 0) {
                        await tx.delete(leaves).where(inArray(leaves.id, leaveIdsToDelete))
                    }
                    if (leavesToInsert.length > 0) {
                        await tx.insert(leaves).values(leavesToInsert)
                    }
                    for (const item of leavesToUpdate) {
                        await tx.update(leaves).set(item.values).where(eq(leaves.id, item.id))
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

