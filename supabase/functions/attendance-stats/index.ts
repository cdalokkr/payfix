// @ts-nocheck
// Note: This is a Supabase Edge Function that runs in Deno runtime.
// TypeScript errors about Deno imports are expected in Node.js environments.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'

interface AttendanceRecord {
    id: string
    status: string
    is_half_day: boolean
    is_extra_day: boolean
    working_hours: number | null
    date: string
    profile_id: string
}

interface StatsRequest {
    profile_id?: string
    role: string
    start_date?: string
    end_date?: string
}

serve(async (req: Request) => {
    // Handle CORS preflight
    const corsResponse = handleCors(req)
    if (corsResponse) return corsResponse

    try {
        const supabase = createSupabaseClient()

        // Parse query params for GET, or body for POST
        let params: StatsRequest
        if (req.method === 'GET') {
            const url = new URL(req.url)
            params = {
                profile_id: url.searchParams.get('profile_id') || undefined,
                role: url.searchParams.get('role') || 'employee',
                start_date: url.searchParams.get('start_date') || undefined,
                end_date: url.searchParams.get('end_date') || undefined
            }
        } else {
            params = await req.json()
        }

        const { profile_id, role, start_date, end_date } = params

        // Get current month boundaries if not specified
        const now = new Date()
        const monthStart = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const monthEnd = end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

        // Build query based on role
        let query = supabase
            .from('attendance')
            .select('id, status, is_half_day, is_extra_day, working_hours, date, profile_id')
            .gte('date', monthStart)
            .lte('date', monthEnd)

        // If employee, only get their records
        if (role === 'employee' && profile_id) {
            query = query.eq('profile_id', profile_id)
        }

        const { data: records, error } = await query

        if (error) {
            return errorResponse(`Database error: ${error.message}`, 500)
        }

        const typedRecords = (records || []) as AttendanceRecord[]

        // Calculate statistics
        const stats = {
            total: typedRecords.length,
            pending: typedRecords.filter((r: AttendanceRecord) => r.status === 'pending').length,
            verified: typedRecords.filter((r: AttendanceRecord) => r.status === 'verified').length,
            rejected: typedRecords.filter((r: AttendanceRecord) => r.status === 'rejected').length,
            half_days: typedRecords.filter((r: AttendanceRecord) => r.is_half_day).length,
            extra_days: typedRecords.filter((r: AttendanceRecord) => r.is_extra_day).length,
            total_hours: typedRecords.reduce((sum: number, r: AttendanceRecord) => sum + (Number(r.working_hours) || 0), 0),
        }

        // Calculate extra hours (hours beyond standard 8 per day)
        const standardHoursPerDay = 8
        const verifiedRecords = typedRecords.filter((r: AttendanceRecord) => r.status === 'verified')
        const totalStandardHours = verifiedRecords.length * standardHoursPerDay
        stats.total_hours = verifiedRecords.reduce((sum: number, r: AttendanceRecord) => sum + (Number(r.working_hours) || 0), 0)
        const extraHours = Math.max(0, stats.total_hours - totalStandardHours)

        return successResponse({
            stats: {
                ...stats,
                extra_hours: Math.round(extraHours * 100) / 100
            },
            period: { start: monthStart, end: monthEnd },
            cached_at: new Date().toISOString()
        })

    } catch (err: unknown) {
        console.error('Edge Function Error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        return errorResponse(`Server error: ${errorMessage}`, 500)
    }
})
