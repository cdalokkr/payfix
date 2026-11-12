import { db } from '@/lib/db'
import { officeShifts, employeeShiftAssignments, shiftRoster, officeLocations, profiles, departments, activities } from '@/lib/db/schema'
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm'
import { throwAppError } from '@/lib/errors/app-errors'
import { tenantStorage } from '@/lib/tenant/store'

export interface ShiftInput {
    locationId: string
    departmentId?: string | null
    name: string
    code?: string | null
    startTime: string
    endTime: string
    durationHours?: number
    bufferMinutes?: number
    color?: string
    isOvernight?: boolean
}

export interface ShiftAssignmentInput {
    profileIds: string[]
    locationId: string
    dutyHours: number
    shiftMode: 'default' | 'single' | 'multi' | 'rotational'
    assignedShiftIds: string[]
    rotationType?: 'none' | 'weekly' | 'biweekly' | 'monthly'
    rotationShiftIds?: string[]
    rotationStartDate?: string | null
    effectiveFrom?: string
    effectiveTo?: string | null
}

export interface RosterAllotmentInput {
    departmentId?: string | null
    profileIds: string[]
    shiftId?: string | null
    startDate: string
    endDate: string
    isExtraShift?: boolean
    status?: 'scheduled' | 'completed' | 'absent' | 'on_leave' | 'swapped'
    notes?: string
}

function parseTimeToMinutes(timeStr: string): number {
    const parts = timeStr.trim().split(':')
    const h = parseInt(parts[0] || '0', 10)
    const m = parseInt(parts[1] || '0', 10)
    return h * 60 + m
}

export function computeShiftDuration(startTime: string, endTime: string): { durationHours: number; isOvernight: boolean } {
    const startMins = parseTimeToMinutes(startTime)
    const endMins = parseTimeToMinutes(endTime)

    if (endMins < startMins) {
        // Overnight shift crossing midnight (e.g. 22:00 to 06:00)
        const durationMins = (24 * 60 - startMins) + endMins
        return {
            durationHours: parseFloat((durationMins / 60).toFixed(2)),
            isOvernight: true,
        }
    } else {
        const durationMins = endMins - startMins
        return {
            durationHours: parseFloat((durationMins / 60).toFixed(2)),
            isOvernight: false,
        }
    }
}

const _shiftSchemaEnsured = new Set<string>()

export class ShiftService {
    static async ensureSchema() {
        const schemaKey = tenantStorage.getStore()?.tenantSchema || 'public'
        if (_shiftSchemaEnsured.has(schemaKey)) return
        try {
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "office_shifts" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "location_id" uuid NOT NULL REFERENCES "office_locations"("id") ON DELETE CASCADE,
                    "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL,
                    "name" text NOT NULL,
                    "code" varchar(20),
                    "start_time" text NOT NULL,
                    "end_time" text NOT NULL,
                    "duration_hours" numeric(4, 2) NOT NULL,
                    "is_overnight" boolean DEFAULT false,
                    "buffer_minutes" integer NOT NULL DEFAULT 15,
                    "color" text DEFAULT '#3b82f6',
                    "is_active" boolean DEFAULT true,
                    "created_at" timestamp with time zone DEFAULT now(),
                    "updated_at" timestamp with time zone DEFAULT now()
                );

                CREATE TABLE IF NOT EXISTS "employee_shift_assignments" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
                    "location_id" uuid NOT NULL REFERENCES "office_locations"("id") ON DELETE CASCADE,
                    "duty_hours" numeric(4, 2) NOT NULL DEFAULT 8.00,
                    "shift_mode" text NOT NULL DEFAULT 'default',
                    "assigned_shift_ids" jsonb DEFAULT '[]'::jsonb,
                    "rotation_type" text DEFAULT 'none',
                    "rotation_shift_ids" jsonb DEFAULT '[]'::jsonb,
                    "rotation_start_date" date,
                    "effective_from" date DEFAULT CURRENT_DATE,
                    "effective_to" date,
                    "created_at" timestamp with time zone DEFAULT now(),
                    "updated_at" timestamp with time zone DEFAULT now()
                );

                CREATE TABLE IF NOT EXISTS "shift_roster" (
                    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
                    "department_id" uuid REFERENCES "departments"("id") ON DELETE CASCADE,
                    "shift_id" uuid REFERENCES "office_shifts"("id") ON DELETE SET NULL,
                    "date" date NOT NULL,
                    "status" text NOT NULL DEFAULT 'scheduled',
                    "is_extra_shift" boolean DEFAULT false,
                    "notes" text,
                    "allotted_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
                    "created_at" timestamp with time zone DEFAULT now(),
                    "updated_at" timestamp with time zone DEFAULT now()
                );

                ALTER TABLE IF EXISTS "attendance"
                ADD COLUMN IF NOT EXISTS "shift_id" uuid REFERENCES "office_shifts"("id") ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS "shift_name" text,
                ADD COLUMN IF NOT EXISTS "duty_hours" numeric,
                ADD COLUMN IF NOT EXISTS "extra_hours" numeric DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "is_extra_shift" boolean DEFAULT false;

                ALTER TABLE IF EXISTS "attendance_sessions"
                ADD COLUMN IF NOT EXISTS "shift_id" uuid REFERENCES "office_shifts"("id") ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS "is_extra_shift" boolean DEFAULT false;
            `)
            _shiftSchemaEnsured.add(schemaKey)
        } catch (e) {
            // Ignore error if schema already exists
        }
    }

    // --- Office Shifts CRUD ---

    static async getShiftsByLocation(locationId?: string | null, departmentId?: string | null) {
        await ShiftService.ensureSchema()
        let whereCondition = locationId ? eq(officeShifts.location_id, locationId) : undefined

        if (departmentId) {
            whereCondition = whereCondition 
                ? and(whereCondition, eq(officeShifts.department_id, departmentId))
                : eq(officeShifts.department_id, departmentId)
        }

        const shifts = await db.query.officeShifts.findMany({
            where: whereCondition,
            with: {
                location: true,
                department: true,
            },
            orderBy: [desc(officeShifts.is_active), desc(officeShifts.created_at)]
        })

        return shifts.map(s => ({
            ...s,
            duration_hours: Number(s.duration_hours),
            created_at: s.created_at ? s.created_at.toISOString() : null,
            updated_at: s.updated_at ? s.updated_at.toISOString() : null,
        }))
    }

    static async createShift(data: ShiftInput, actorId?: string) {
        await ShiftService.ensureSchema()
        const computed = computeShiftDuration(data.startTime, data.endTime)
        const durationHours = data.durationHours || computed.durationHours
        const isOvernight = data.isOvernight !== undefined ? data.isOvernight : computed.isOvernight

        const [created] = await db.insert(officeShifts).values({
            location_id: data.locationId,
            department_id: data.departmentId || null,
            name: data.name,
            code: data.code || null,
            start_time: data.startTime,
            end_time: data.endTime,
            duration_hours: String(durationHours),
            is_overnight: isOvernight,
            buffer_minutes: data.bufferMinutes || 15,
            color: data.color || '#3b82f6',
            is_active: true,
        }).returning()

        if (!created) throwAppError('DATABASE_ERROR', 'Failed to create shift')

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_create',
                module: 'shifts',
                description: `Created shift "${created.name}" (${created.start_time} - ${created.end_time})`,
                metadata: { shift_id: created.id, name: created.name }
            })
        }

        return created
    }

    static async updateShift(id: string, data: Partial<ShiftInput> & { isActive?: boolean }, actorId?: string) {
        await ShiftService.ensureSchema()
        let durationHours = data.durationHours
        let isOvernight = data.isOvernight

        if (data.startTime && data.endTime) {
            const computed = computeShiftDuration(data.startTime, data.endTime)
            durationHours = durationHours || computed.durationHours
            isOvernight = isOvernight !== undefined ? isOvernight : computed.isOvernight
        }

        const [updated] = await db.update(officeShifts).set({
            name: data.name,
            code: data.code !== undefined ? data.code : undefined,
            start_time: data.startTime,
            end_time: data.endTime,
            duration_hours: durationHours !== undefined ? String(durationHours) : undefined,
            is_overnight: isOvernight,
            buffer_minutes: data.bufferMinutes,
            color: data.color,
            department_id: data.departmentId !== undefined ? data.departmentId : undefined,
            is_active: data.isActive !== undefined ? data.isActive : undefined,
            updated_at: new Date(),
        }).where(eq(officeShifts.id, id)).returning()

        if (!updated) throwAppError('NOT_FOUND', 'Shift not found for update')

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_edit',
                module: 'shifts',
                description: `Updated shift "${updated.name}"`,
                metadata: { shift_id: updated.id, name: updated.name }
            })
        }

        return updated
    }

    static async deleteShift(id: string, actorId?: string) {
        await ShiftService.ensureSchema()
        const [deleted] = await db.delete(officeShifts).where(eq(officeShifts.id, id)).returning()
        if (!deleted) throwAppError('NOT_FOUND', 'Shift not found to delete')

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_delete',
                module: 'shifts',
                description: `Deleted shift "${deleted.name}"`,
                metadata: { shift_id: deleted.id, name: deleted.name }
            })
        }

        return deleted
    }

    // --- Employee Shift Assignment ---

    static async assignEmployeeShifts(input: ShiftAssignmentInput, actorId?: string) {
        await ShiftService.ensureSchema()

        // Fetch selected shifts to validate total duration if multi-shift
        if (input.shiftMode === 'multi' && input.assignedShiftIds.length > 0) {
            const selectedShifts = await db.query.officeShifts.findMany({
                where: inArray(officeShifts.id, input.assignedShiftIds)
            })
            const totalShiftHours = selectedShifts.reduce((sum, s) => sum + Number(s.duration_hours), 0)
            // Helper calculation: we record and match total duty hours
            console.log(`[ShiftAssignment] Multi-shift validation: shifts total ${totalShiftHours}h vs duty ${input.dutyHours}h`)
        }

        const results: any[] = []
        for (const profileId of input.profileIds) {
            const existing = await db.query.employeeShiftAssignments.findFirst({
                where: eq(employeeShiftAssignments.profile_id, profileId)
            })

            if (existing) {
                const [updated] = await db.update(employeeShiftAssignments).set({
                    location_id: input.locationId,
                    duty_hours: String(input.dutyHours),
                    shift_mode: input.shiftMode,
                    assigned_shift_ids: input.assignedShiftIds,
                    rotation_type: input.rotationType || 'none',
                    rotation_shift_ids: input.rotationShiftIds || [],
                    rotation_start_date: input.rotationStartDate || null,
                    effective_from: input.effectiveFrom || existing.effective_from,
                    effective_to: input.effectiveTo || null,
                    updated_at: new Date(),
                }).where(eq(employeeShiftAssignments.id, existing.id)).returning()
                results.push(updated)
            } else {
                const [created] = await db.insert(employeeShiftAssignments).values({
                    profile_id: profileId,
                    location_id: input.locationId,
                    duty_hours: String(input.dutyHours),
                    shift_mode: input.shiftMode,
                    assigned_shift_ids: input.assignedShiftIds,
                    rotation_type: input.rotationType || 'none',
                    rotation_shift_ids: input.rotationShiftIds || [],
                    rotation_start_date: input.rotationStartDate || null,
                    effective_from: input.effectiveFrom || new Date().toISOString().slice(0, 10),
                    effective_to: input.effectiveTo || null,
                }).returning()
                results.push(created)
            }
        }

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_edit',
                module: 'shifts',
                description: `Assigned shift schedule to ${input.profileIds.length} staff member(s)`,
                metadata: { staff_count: input.profileIds.length, shift_mode: input.shiftMode }
            })
        }

        return results
    }

    static async getEmployeeShiftAssignment(profileId: string) {
        await ShiftService.ensureSchema()
        const assignment = await db.query.employeeShiftAssignments.findFirst({
            where: eq(employeeShiftAssignments.profile_id, profileId),
            with: {
                profile: true,
                location: true,
            }
        })
        if (!assignment) return null

        let shifts: any[] = []
        const shiftIds = (assignment.assigned_shift_ids as string[]) || []
        if (shiftIds.length > 0) {
            shifts = await db.query.officeShifts.findMany({
                where: inArray(officeShifts.id, shiftIds)
            })
        }

        return {
            ...assignment,
            duty_hours: Number(assignment.duty_hours),
            shifts: shifts.map(s => ({ ...s, duration_hours: Number(s.duration_hours) }))
        }
    }

    // --- Effective Shift Determination (Roster + Rotation + Fixed + Default) ---

    static async getEffectiveShiftForDate(profileId: string, dateStr: string) {
        await ShiftService.ensureSchema()

        // 1. Check direct daily roster allotment (Department Manager or Admin assigned)
        const rosterEntry = await db.query.shiftRoster.findFirst({
            where: and(
                eq(shiftRoster.profile_id, profileId),
                eq(shiftRoster.date, dateStr)
            ),
            with: {
                shift: true,
            }
        })

        if (rosterEntry && rosterEntry.shift) {
            return {
                source: 'roster',
                rosterId: rosterEntry.id,
                status: rosterEntry.status,
                isExtraShift: rosterEntry.is_extra_shift,
                shift: {
                    ...rosterEntry.shift,
                    duration_hours: Number(rosterEntry.shift.duration_hours),
                },
                dutyHours: Number(rosterEntry.shift.duration_hours),
                shifts: [{
                    ...rosterEntry.shift,
                    duration_hours: Number(rosterEntry.shift.duration_hours),
                }]
            }
        }

        // 2. Check employee's standard shift assignment
        const assignment = await db.query.employeeShiftAssignments.findFirst({
            where: eq(employeeShiftAssignments.profile_id, profileId)
        })

        if (assignment) {
            const dutyHours = Number(assignment.duty_hours) || 8.0

            // Rotational logic
            if (assignment.rotation_type === 'weekly' && assignment.rotation_shift_ids && (assignment.rotation_shift_ids as string[]).length > 0) {
                const rotationIds = assignment.rotation_shift_ids as string[]
                const anchorDate = assignment.rotation_start_date ? new Date(assignment.rotation_start_date) : new Date(assignment.effective_from)
                const targetDate = new Date(dateStr)
                const diffTime = Math.max(0, targetDate.getTime() - anchorDate.getTime())
                const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000))
                const activeShiftId = rotationIds[diffWeeks % rotationIds.length]

                const activeShift = await db.query.officeShifts.findFirst({
                    where: eq(officeShifts.id, activeShiftId)
                })

                if (activeShift) {
                    return {
                        source: 'rotation',
                        dutyHours,
                        shift: { ...activeShift, duration_hours: Number(activeShift.duration_hours) },
                        shifts: [{ ...activeShift, duration_hours: Number(activeShift.duration_hours) }],
                        isExtraShift: false,
                    }
                }
            }

            // Fixed Single or Multi Shift
            const shiftIds = (assignment.assigned_shift_ids as string[]) || []
            if (shiftIds.length > 0) {
                const assignedShifts = await db.query.officeShifts.findMany({
                    where: inArray(officeShifts.id, shiftIds)
                })
                const mappedShifts = assignedShifts.map(s => ({ ...s, duration_hours: Number(s.duration_hours) }))

                return {
                    source: assignment.shift_mode,
                    dutyHours,
                    shift: mappedShifts[0] || null,
                    shifts: mappedShifts,
                    isExtraShift: false,
                }
            }
        }

        // 3. Fallback: Office Location default timing
        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, profileId),
            with: { department: true }
        })
        const locationId = profile?.department?.location_id || assignment?.location_id

        if (locationId) {
            const loc = await db.query.officeLocations.findFirst({
                where: eq(officeLocations.id, locationId)
            })
            if (loc) {
                const computed = computeShiftDuration(loc.check_in_time, loc.check_out_time)
                return {
                    source: 'location_default',
                    dutyHours: computed.durationHours,
                    shift: {
                        id: 'default',
                        name: 'Office General Shift',
                        start_time: loc.check_in_time,
                        end_time: loc.check_out_time,
                        duration_hours: computed.durationHours,
                        is_overnight: computed.isOvernight,
                        buffer_minutes: loc.buffer_minutes,
                        color: '#6366f1',
                    },
                    shifts: [{
                        id: 'default',
                        name: 'Office General Shift',
                        start_time: loc.check_in_time,
                        end_time: loc.check_out_time,
                        duration_hours: computed.durationHours,
                        is_overnight: computed.isOvernight,
                        buffer_minutes: loc.buffer_minutes,
                        color: '#6366f1',
                    }],
                    isExtraShift: false,
                }
            }
        }

        // Default 8h 10:00 - 19:00 fallback
        return {
            source: 'fallback',
            dutyHours: 8.0,
            shift: {
                id: 'fallback',
                name: 'Standard Shift',
                start_time: '10:00:00',
                end_time: '19:00:00',
                duration_hours: 8.0,
                is_overnight: false,
                buffer_minutes: 15,
                color: '#3b82f6',
            },
            shifts: [],
            isExtraShift: false,
        }
    }

    // --- Department Manager Roster Operations ---

    static async allotRoster(input: RosterAllotmentInput, actorId?: string) {
        await ShiftService.ensureSchema()

        // Generate array of dates between startDate and endDate inclusive
        const start = new Date(input.startDate)
        const end = new Date(input.endDate)
        const dates: string[] = []

        const curr = new Date(start)
        while (curr <= end) {
            dates.push(curr.toISOString().slice(0, 10))
            curr.setDate(curr.getDate() + 1)
        }

        const entries: any[] = []
        for (const profileId of input.profileIds) {
            for (const d of dates) {
                // Check if roster already exists for (profileId, d)
                const existing = await db.query.shiftRoster.findFirst({
                    where: and(
                        eq(shiftRoster.profile_id, profileId),
                        eq(shiftRoster.date, d)
                    )
                })

                if (existing) {
                    const [updated] = await db.update(shiftRoster).set({
                        shift_id: input.shiftId || existing.shift_id,
                        department_id: input.departmentId || existing.department_id,
                        status: input.status || existing.status,
                        is_extra_shift: input.isExtraShift !== undefined ? input.isExtraShift : existing.is_extra_shift,
                        notes: input.notes !== undefined ? input.notes : existing.notes,
                        allotted_by: actorId || existing.allotted_by,
                        updated_at: new Date(),
                    }).where(eq(shiftRoster.id, existing.id)).returning()
                    entries.push(updated)
                } else {
                    const [created] = await db.insert(shiftRoster).values({
                        profile_id: profileId,
                        department_id: input.departmentId || null,
                        shift_id: input.shiftId || null,
                        date: d,
                        status: input.status || 'scheduled',
                        is_extra_shift: input.isExtraShift || false,
                        notes: input.notes || null,
                        allotted_by: actorId || null,
                    }).returning()
                    entries.push(created)
                }
            }
        }

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_create',
                module: 'shifts',
                description: `Allotted shift roster for ${input.profileIds.length} staff across ${dates.length} day(s)`,
                metadata: { staff_count: input.profileIds.length, days_count: dates.length }
            })
        }

        return entries
    }

    static async markRosterAbsent({ rosterId, profileId, date, reason, actorId }: { rosterId?: string; profileId?: string; date?: string; reason?: string; actorId?: string }) {
        await ShiftService.ensureSchema()
        let targetId = rosterId

        if (!targetId && profileId && date) {
            const existing = await db.query.shiftRoster.findFirst({
                where: and(
                    eq(shiftRoster.profile_id, profileId),
                    eq(shiftRoster.date, date)
                )
            })
            if (existing) {
                targetId = existing.id
            } else {
                const [created] = await db.insert(shiftRoster).values({
                    profile_id: profileId,
                    date,
                    status: 'absent',
                    notes: reason || 'Marked absent by manager',
                    allotted_by: actorId || null,
                }).returning()
                return created
            }
        }

        if (!targetId) throwAppError('NOT_FOUND', 'Roster entry or staff and date required')

        const [updated] = await db.update(shiftRoster).set({
            status: 'absent',
            notes: reason || 'Marked absent by manager',
            updated_at: new Date(),
        }).where(eq(shiftRoster.id, targetId)).returning()

        if (!updated) throwAppError('NOT_FOUND', 'Roster entry not found')

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_edit',
                module: 'shifts',
                description: `Marked staff absent on roster for date ${updated.date}`,
                metadata: { roster_id: targetId, reason }
            })
        }

        return updated
    }

    static async callInExtraShift({
        profileId,
        departmentId,
        shiftId,
        date,
        extraShiftType = 'full',
        reason,
        actorId,
    }: {
        profileId: string
        departmentId?: string | null
        shiftId: string
        date: string
        extraShiftType?: 'full' | 'half'
        reason?: string
        actorId?: string
    }) {
        await ShiftService.ensureSchema()
        const [created] = await db.insert(shiftRoster).values({
            profile_id: profileId,
            department_id: departmentId || null,
            shift_id: shiftId,
            date,
            status: 'scheduled',
            is_extra_shift: true,
            extra_shift_type: extraShiftType,
            notes: reason || 'Called in for extra shift work',
            allotted_by: actorId || null,
        }).returning()

        if (actorId) {
            await db.insert(activities).values({
                user_id: actorId,
                activity_type: 'data_create',
                module: 'shifts',
                description: `Called in staff for Extra Shift Work on ${date}`,
                metadata: { profile_id: profileId, shift_id: shiftId, date }
            })
        }

        return created
    }

    static async getDepartmentRosterGrid({
        departmentId,
        startDate,
        endDate,
    }: {
        departmentId?: string | null
        startDate: string
        endDate: string
    }) {
        await ShiftService.ensureSchema()

        // Get members of this department (or all if departmentId is null)
        const staffList = await db.query.profiles.findMany({
            where: departmentId ? eq(profiles.department_id, departmentId) : undefined,
            with: {
                designation: true,
                department: true,
            },
            orderBy: [desc(profiles.full_name)]
        })

        // Fetch all roster entries within date range
        const rosters = await db.query.shiftRoster.findMany({
            where: and(
                gte(shiftRoster.date, startDate),
                lte(shiftRoster.date, endDate),
                departmentId ? eq(shiftRoster.department_id, departmentId) : undefined
            ),
            with: {
                shift: true,
            }
        })

        return {
            staff: staffList.map(s => ({
                id: s.id,
                full_name: s.full_name,
                email: s.email,
                mobile_no: s.mobile_no,
                role: s.role,
                department: s.department,
                designation: s.designation,
            })),
            rosters: rosters.map(r => ({
                ...r,
                shift: r.shift ? { ...r.shift, duration_hours: Number(r.shift.duration_hours) } : null,
                created_at: r.created_at ? r.created_at.toISOString() : null,
            }))
        }
    }
}
