/**
 * Utility to calculate extra hours (overtime) based on individual office location shift setup.
 *
 * Rules:
 * 1. Each office location can have its own check-in time (e.g. "10:00:00"),
 *    check-out time (e.g. "19:00:00"), and grace/buffer period (x minutes, e.g. 15).
 * 2. If employee arrives <= x minutes before office start time, that time is NOT counted in extra hours.
 * 3. If employee arrives > x minutes before office start time, the ENTIRE duration before office start is counted as extra hours.
 * 4. If employee leaves <= x minutes after office end time, that time is NOT counted in extra hours.
 * 5. If employee leaves > x minutes after office end time, the ENTIRE duration after office end is counted as extra hours.
 */

export interface OfficeTimingRule {
    checkInTime?: string | null  // "HH:mm:ss" or "HH:mm" (default: "10:00:00")
    checkOutTime?: string | null // "HH:mm:ss" or "HH:mm" (default: "19:00:00")
    bufferMinutes?: number | null // x threshold (default: 15)
}

export function parseTimeToMinutes(timeStr?: string | null, defaultMinutes: number = 0): number {
    if (!timeStr) return defaultMinutes
    const parts = timeStr.trim().split(':')
    const hours = parseInt(parts[0] || '0', 10)
    const minutes = parseInt(parts[1] || '0', 10)
    const seconds = parseInt(parts[2] || '0', 10)
    return hours * 60 + minutes + seconds / 60
}

export function calculateAttendanceExtraHours({
    checkIn,
    checkOut,
    officeTiming,
}: {
    checkIn?: string | Date | null
    checkOut?: string | Date | null
    officeTiming?: OfficeTimingRule | null
}): {
    extraHours: number
    earlyExtraHours: number
    lateExtraHours: number
    ruleApplied: {
        startTime: string
        endTime: string
        bufferMinutes: number
    }
} {
    const startTimeStr = officeTiming?.checkInTime || '10:00:00'
    const endTimeStr = officeTiming?.checkOutTime || '19:00:00'
    const bufferMinutes = Number(officeTiming?.bufferMinutes ?? 15)

    const ruleApplied = {
        startTime: startTimeStr,
        endTime: endTimeStr,
        bufferMinutes,
    }

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

    // Convert actual in time to minutes from start of day in local time
    const inMinutes = inDate.getHours() * 60 + inDate.getMinutes() + inDate.getSeconds() / 60
    const scheduledStartMinutes = parseTimeToMinutes(startTimeStr, 10 * 60)

    let earlyExtraMinutes = 0
    // Check if employee checked in BEFORE office start time
    if (inMinutes < scheduledStartMinutes) {
        const earlyDiffMinutes = scheduledStartMinutes - inMinutes
        // If arrived > bufferMinutes early: entire early duration is counted as extra
        if (earlyDiffMinutes > bufferMinutes) {
            earlyExtraMinutes = earlyDiffMinutes
        }
    }

    let lateExtraMinutes = 0
    if (checkOut) {
        const outDate = new Date(checkOut)
        if (!isNaN(outDate.getTime())) {
            const outMinutes = outDate.getHours() * 60 + outDate.getMinutes() + outDate.getSeconds() / 60
            const scheduledEndMinutes = parseTimeToMinutes(endTimeStr, 19 * 60)

            // Check if employee checked out AFTER office end time
            if (outMinutes > scheduledEndMinutes) {
                const lateDiffMinutes = outMinutes - scheduledEndMinutes
                // If left > bufferMinutes late: entire late duration is counted as extra
                if (lateDiffMinutes > bufferMinutes) {
                    lateExtraMinutes = lateDiffMinutes
                }
            }
        }
    }

    const earlyExtraHours = earlyExtraMinutes / 60
    const lateExtraHours = lateExtraMinutes / 60
    const totalExtraHours = earlyExtraHours + lateExtraHours

    return {
        extraHours: parseFloat(totalExtraHours.toFixed(2)),
        earlyExtraHours: parseFloat(earlyExtraHours.toFixed(2)),
        lateExtraHours: parseFloat(lateExtraHours.toFixed(2)),
        ruleApplied,
    }
}
