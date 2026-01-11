/**
 * Supabase Edge Function Client
 * 
 * Provides a typed interface for calling edge functions from the Next.js app.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

interface EdgeFunctionOptions {
    authToken?: string
}

/**
 * Call a Supabase Edge Function
 */
async function callEdgeFunction<T>(
    functionName: string,
    payload: object,
    options?: EdgeFunctionOptions
): Promise<{ data: T | null; error: string | null }> {
    const url = `${SUPABASE_URL}/functions/v1/${functionName}`

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
    }

    if (options?.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (!response.ok || result.success === false) {
            return { data: null, error: result.error || 'Unknown error' }
        }

        return { data: result.data as T, error: null }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error'
        return { data: null, error: message }
    }
}

// =============================================================================
// TYPED FUNCTION CALLS
// =============================================================================

export interface AttendanceClockPayload {
    action: 'clock_in' | 'clock_out'
    profile_id: string
    full_name?: string
    email: string
    local_date?: string
    is_extra_day?: boolean
}

export interface AttendanceClockResult {
    record: {
        id: string
        profile_id: string
        date: string
        check_in: string
        check_out?: string
        status: string
    }
    action: 'clock_in' | 'clock_out'
}

/**
 * Clock in/out via Edge Function for faster response
 */
export async function edgeAttendanceClock(
    payload: AttendanceClockPayload,
    authToken?: string
) {
    return callEdgeFunction<AttendanceClockResult>('attendance-clock', payload, { authToken })
}

export interface BroadcastNotificationPayload {
    user_ids: string[]
    title: string
    message: string
    type: string
    link?: string
    broadcast_channel?: string
}

export interface BroadcastNotificationResult {
    inserted: number
    broadcasted_to: number
}

/**
 * Broadcast notifications via Edge Function
 */
export async function edgeBroadcastNotification(
    payload: BroadcastNotificationPayload,
    authToken?: string
) {
    return callEdgeFunction<BroadcastNotificationResult>('broadcast-notification', payload, { authToken })
}

export interface AttendanceStatsPayload {
    profile_id?: string
    role: string
    start_date?: string
    end_date?: string
}

export interface AttendanceStatsResult {
    stats: {
        total: number
        pending: number
        verified: number
        rejected: number
        half_days: number
        extra_days: number
        total_hours: number
        extra_hours: number
    }
    period: { start: string; end: string }
    cached_at: string
}

/**
 * Get attendance stats via Edge Function
 */
export async function edgeAttendanceStats(
    payload: AttendanceStatsPayload,
    authToken?: string
) {
    return callEdgeFunction<AttendanceStatsResult>('attendance-stats', payload, { authToken })
}

// Export all functions
export const EdgeFunctions = {
    attendanceClock: edgeAttendanceClock,
    broadcastNotification: edgeBroadcastNotification,
    attendanceStats: edgeAttendanceStats,
}

export default EdgeFunctions
