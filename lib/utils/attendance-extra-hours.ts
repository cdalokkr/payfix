/**
 * Utility to calculate extra hours (overtime) based on individual office location or shift setup.
 *
 * Rules:
 * 1. Shifts and office locations have check-in time (e.g. "10:00:00"),
 *    check-out time (e.g. "19:00:00"), and grace/buffer period (x minutes, default: 15).
 * 2. If employee arrives <= x minutes before shift start time, that time is NOT counted in extra hours.
 * 3. If employee arrives > x minutes before shift start time, the actual duration worked before shift start is counted.
 * 4. If employee leaves <= x minutes after shift end time, that time is NOT counted in extra hours.
 * 5. If employee leaves > x minutes after shift end time, the actual duration worked after shift end is counted.
 * 6. Bounded Overlap: Overtime after shift end is strictly bounded by when the employee actually checked in:
 *    actualLateMinutes = max(0, outMinutes - max(inMinutes, scheduledEndMinutes))
 * 7. Bounded Early: Overtime before shift start is strictly bounded by when the employee actually left:
 *    actualEarlyMinutes = max(0, min(outMinutes, scheduledStartMinutes) - inMinutes)
 * 8. Extra hours can NEVER exceed total actual working hours.
 * 9. Momentary punches (less than half day / duty threshold) cannot accumulate overtime.
 */

export interface OfficeTimingRule {
    checkInTime?: string | null  // "HH:mm:ss" or "HH:mm" (default: "10:00:00")
    checkOutTime?: string | null // "HH:mm:ss" or "HH:mm" (default: "19:00:00")
    bufferMinutes?: number | null // x threshold (default: 15)
    check_in_time?: string | null
    check_out_time?: string | null
    buffer_minutes?: number | null
    daily_working_hours?: Record<string, { checkIn?: string; checkOut?: string; check_in?: string; check_out?: string }> | null
    dailyWorkingHours?: Record<string, { checkIn?: string; checkOut?: string; check_in?: string; check_out?: string }> | null
    off_days?: number[] | null
    offDays?: number[] | null
    absent_deduction_multiplier?: number | null
    absentDeductionMultiplier?: number | null
    duration_hours?: number | string | null
    durationHours?: number | string | null
}

export interface ShiftTimingRule {
    startTime?: string | null  // "HH:mm:ss" or "HH:mm"
    endTime?: string | null    // "HH:mm:ss" or "HH:mm"
    start_time?: string | null
    end_time?: string | null
    durationHours?: number | string | null
    duration_hours?: number | string | null
    dutyHours?: number | string | null
    duty_hours?: number | string | null
    bufferMinutes?: number | null
    buffer_minutes?: number | null
    isOvernight?: boolean | null
    is_overnight?: boolean | null
    name?: string | null
    code?: string | null
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function parseTimeToMinutes(timeStr?: string | null, defaultMinutes: number = 0): number {
    if (!timeStr) return defaultMinutes
    const parts = timeStr.trim().split(':')
    const hours = parseInt(parts[0] || '0', 10)
    const minutes = parseInt(parts[1] || '0', 10)
    const seconds = parseInt(parts[2] || '0', 10)
    return hours * 60 + minutes + (isNaN(seconds) ? 0 : seconds / 60)
}

/**
 * Returns the time of day in minutes (0 to 1439) in IST (Asia/Kolkata) timezone.
 * Ensures consistent calculation whether running on client browser, local machine, or UTC cloud servers.
 */
function getDateMinutesIST(dateObj: Date): number {
    try {
        const timeStr = dateObj.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
        return parseTimeToMinutes(timeStr)
    } catch {
        return dateObj.getHours() * 60 + dateObj.getMinutes() + dateObj.getSeconds() / 60
    }
}

export function calculateAttendanceExtraHours({
    checkIn,
    checkOut,
    officeTiming,
    shiftTiming,
    date,
    workingHours,
    dutyHours,
}: {
    checkIn?: string | Date | null
    checkOut?: string | Date | null
    officeTiming?: OfficeTimingRule | any | null
    shiftTiming?: ShiftTimingRule | any | null
    date?: string | Date | null
    workingHours?: number | null
    dutyHours?: number | null
}): {
    extraHours: number
    earlyExtraHours: number
    lateExtraHours: number
    ruleApplied: {
        startTime: string
        endTime: string
        bufferMinutes: number
        source: 'shift' | 'office_daily' | 'office_default' | 'fallback'
    }
} {
    // 1. Resolve Day-of-week and Schedule Start & End Times
    const refDate = checkIn ? new Date(checkIn) : (date ? new Date(date) : null)
    let startTimeStr: string | undefined
    let endTimeStr: string | undefined
    let source: 'shift' | 'office_daily' | 'office_default' | 'fallback' = 'fallback'

    // Priority 1: Shift Timing (e.g. Afternoon shift 1:00 PM - 7:00 PM, Night shift, etc.)
    const shiftStart = shiftTiming?.start_time || shiftTiming?.startTime
    const shiftEnd = shiftTiming?.end_time || shiftTiming?.endTime
    if (shiftStart && shiftEnd) {
        startTimeStr = shiftStart
        endTimeStr = shiftEnd
        source = 'shift'
    }

    // Priority 2: Office Location Daily Custom Timing (e.g. Monday-Saturday branch schedule)
    if (!startTimeStr && refDate && !isNaN(refDate.getTime()) && officeTiming) {
        const dayIdx = refDate.getDay()
        const dayName = DAY_NAMES[dayIdx]
        const dailySchedule = officeTiming.daily_working_hours || officeTiming.dailyWorkingHours
        if (dailySchedule && typeof dailySchedule === 'object') {
            const dayEntry = dailySchedule[dayName] || dailySchedule[dayIdx]
            if (dayEntry) {
                startTimeStr = dayEntry.checkIn || dayEntry.check_in
                endTimeStr = dayEntry.checkOut || dayEntry.check_out
                if (startTimeStr && endTimeStr) {
                    source = 'office_daily'
                }
            }
        }
    }

    // Priority 3: Office Location Default Timing
    if (!startTimeStr && officeTiming) {
        const locIn = officeTiming.check_in_time || officeTiming.checkInTime
        const locOut = officeTiming.check_out_time || officeTiming.checkOutTime
        if (locIn && locOut) {
            startTimeStr = locIn
            endTimeStr = locOut
            source = 'office_default'
        }
    }

    // Fallback: 10:00 AM to 07:00 PM
    if (!startTimeStr) startTimeStr = '10:00:00'
    if (!endTimeStr) endTimeStr = '19:00:00'

    const bufferMinutes = Number(
        shiftTiming?.buffer_minutes ?? 
        shiftTiming?.bufferMinutes ?? 
        officeTiming?.buffer_minutes ?? 
        officeTiming?.bufferMinutes ?? 
        15
    )

    const isOvernight = Boolean(shiftTiming?.is_overnight || shiftTiming?.isOvernight)

    const ruleApplied = {
        startTime: startTimeStr,
        endTime: endTimeStr,
        bufferMinutes,
        source
    }

    // Without check-in, no work was performed
    if (!checkIn) {
        return {
            extraHours: 0,
            earlyExtraHours: 0,
            lateExtraHours: 0,
            ruleApplied,
        }
    }

    const inDate = new Date(checkIn)
    if (isNaN(inDate.getTime())) {
        return {
            extraHours: 0,
            earlyExtraHours: 0,
            lateExtraHours: 0,
            ruleApplied,
        }
    }

    // Check-out required to finalize physical overtime duration
    if (!checkOut) {
        return {
            extraHours: 0,
            earlyExtraHours: 0,
            lateExtraHours: 0,
            ruleApplied,
        }
    }

    const outDate = new Date(checkOut)
    if (isNaN(outDate.getTime())) {
        return {
            extraHours: 0,
            earlyExtraHours: 0,
            lateExtraHours: 0,
            ruleApplied,
        }
    }

    // Parse times in minutes from midnight (in IST timezone)
    const inMinutes = getDateMinutesIST(inDate)
    let outMinutes = getDateMinutesIST(outDate)
    const scheduledStartMinutes = parseTimeToMinutes(startTimeStr, 10 * 60)
    let scheduledEndMinutes = parseTimeToMinutes(endTimeStr, 19 * 60)

    // Handle overnight shifts (e.g., 22:00 to 06:00 next day)
    if (scheduledEndMinutes < scheduledStartMinutes || isOvernight) {
        scheduledEndMinutes += 1440 // +24 hours
        if (outMinutes < inMinutes) {
            outMinutes += 1440
        }
    }

    // Effective total working minutes
    const effectiveWorkingMinutes = (workingHours != null && workingHours > 0)
        ? workingHours * 60
        : Math.max(0, outMinutes - inMinutes)

    // Minimum duty threshold check:
    // If an employee only punched for a momentary duration (e.g., 4 minutes = 0.05h)
    // and did not complete at least half-day / threshold duty, they cannot accumulate overtime
    const resolvedDuty = dutyHours 
        ?? (shiftTiming?.duty_hours ? Number(shiftTiming.duty_hours) : null)
        ?? (shiftTiming?.dutyHours ? Number(shiftTiming.dutyHours) : null)
        ?? (shiftTiming?.duration_hours ? Number(shiftTiming.duration_hours) : null)
        ?? (shiftTiming?.durationHours ? Number(shiftTiming.durationHours) : null)
        ?? (officeTiming?.duration_hours ? Number(officeTiming.duration_hours) : null)
        ?? 8

    if (effectiveWorkingMinutes < Math.min(240, resolvedDuty * 0.5 * 60)) {
        return {
            extraHours: 0,
            earlyExtraHours: 0,
            lateExtraHours: 0,
            ruleApplied,
        }
    }

    // 1. Calculate Early Extra Time (Arrived before shift start)
    // Bounded strictly between inMinutes and scheduledStartMinutes, but no later than outMinutes
    let earlyExtraMinutes = 0
    if (inMinutes < scheduledStartMinutes) {
        const actualEarlyOverlap = Math.max(0, Math.min(outMinutes, scheduledStartMinutes) - inMinutes)
        if (actualEarlyOverlap > bufferMinutes) {
            earlyExtraMinutes = actualEarlyOverlap
        }
    }

    // 2. Calculate Late Extra Time (Stayed after shift end)
    // Bounded strictly between outMinutes and scheduledEndMinutes, but no earlier than inMinutes
    let lateExtraMinutes = 0
    if (outMinutes > scheduledEndMinutes) {
        const actualLateOverlap = Math.max(0, outMinutes - Math.max(inMinutes, scheduledEndMinutes))
        if (actualLateOverlap > bufferMinutes) {
            lateExtraMinutes = actualLateOverlap
        }
    }

    // 3. Cap by total actual working minutes (overtime can never exceed total work done)
    let totalExtraMinutes = earlyExtraMinutes + lateExtraMinutes
    if (effectiveWorkingMinutes > 0 && totalExtraMinutes > effectiveWorkingMinutes) {
        totalExtraMinutes = effectiveWorkingMinutes
    }

    const earlyExtraHours = parseFloat((earlyExtraMinutes / 60).toFixed(2))
    const lateExtraHours = parseFloat((lateExtraMinutes / 60).toFixed(2))
    const totalExtraHours = parseFloat((totalExtraMinutes / 60).toFixed(2))

    return {
        extraHours: totalExtraHours,
        earlyExtraHours,
        lateExtraHours,
        ruleApplied,
    }
}
