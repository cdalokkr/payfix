/**
 * Date utilities with IST (India Standard Time) timezone support
 */

/**
 * Get today's date in IST (Asia/Kolkata) timezone
 * Returns date in YYYY-MM-DD format
 */
export function getLocalDateIST(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
}

/**
 * Get current time in IST timezone
 * Returns time in HH:MM:SS format
 */
export function getLocalTimeIST(): string {
    return new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

/**
 * Get current time in IST timezone in 12-hour format
 * Returns time like "06:59:08 PM"
 */
export function getLocalTimeIST12Hour(): string {
    return new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

/**
 * Get current datetime in IST timezone
 * Returns ISO-like string with IST offset
 */
export function getLocalDateTimeIST(): Date {
    const istString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    return new Date(istString)
}

/**
 * Format a Date object to YYYY-MM-DD string in IST timezone
 */
export function formatDateIST(date: Date): string {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
}

/**
 * Parse a biometric device timestamp. Device protocols commonly omit an
 * offset and report the tenant's local time; interpret that form as IST
 * instead of letting the server's timezone silently change the business date.
 */
export function parseBiometricTimestamp(value: string): Date {
    const trimmed = value.trim()
    const localDeviceTimestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)
    const date = new Date(
        localDeviceTimestamp
            ? `${trimmed.replace(' ', 'T')}+05:30`
            : trimmed
    )
    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid biometric device timestamp')
    }
    return date
}

/**
 * Get month start and end dates in IST timezone
 */
export function getMonthRangeIST(year?: number, month?: number): { start: string; end: string } {
    const now = getLocalDateTimeIST()
    const y = year ?? now.getFullYear()
    const m = month ?? now.getMonth()

    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0)

    return {
        start: formatDateIST(start),
        end: formatDateIST(end)
    }
}
