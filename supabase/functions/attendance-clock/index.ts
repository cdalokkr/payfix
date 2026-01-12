// @ts-nocheck
// Note: This is a Supabase Edge Function that runs in Deno runtime.
// TypeScript errors about Deno imports are expected in Node.js environments.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'

interface ClockRequest {
    action: 'clock_in' | 'clock_out'
    profile_id: string
    full_name?: string
    email: string
    local_date?: string
    is_extra_day?: boolean
}

serve(async (req: Request) => {
    // Handle CORS preflight
    const corsResponse = handleCors(req)
    if (corsResponse) return corsResponse

    try {
        const supabase = createSupabaseClient()
        const body: ClockRequest = await req.json()

        const { action, profile_id, full_name, email, local_date, is_extra_day } = body

        if (!profile_id || !email || !action) {
            return errorResponse('Missing required fields: profile_id, email, action', 400)
        }

        const today = local_date || new Date().toISOString().split('T')[0]
        const dayOfWeek = new Date(today).getDay()

        // Get office settings and closures in parallel
        const [settingsResult, closuresResult] = await Promise.all([
            supabase.from('office_settings').select('off_days').limit(1).single(),
            supabase.from('office_closures').select('date, reason').eq('date', today).maybeSingle()
        ])

        const settings = settingsResult.data
        const closure = closuresResult.data

        // Check if it's a holiday
        if (closure) {
            return errorResponse(`Office is closed for ${closure.reason || 'Holiday'}.`, 400)
        }

        // Check if it's an off day
        const isOffDay = settings?.off_days?.includes(dayOfWeek)
        if (isOffDay && !is_extra_day && action === 'clock_in') {
            return errorResponse('Today is a weekly off day. Use "Extra Work" to clock in if authorized.', 400)
        }

        if (action === 'clock_in') {
            // Check existing record
            const { data: existing } = await supabase
                .from('attendance')
                .select('id')
                .eq('profile_id', profile_id)
                .eq('date', today)
                .maybeSingle()

            if (existing) {
                return errorResponse('Already clocked in for today.', 400)
            }

            // Create clock-in record
            const { data, error } = await supabase
                .from('attendance')
                .insert({
                    profile_id,
                    date: today,
                    check_in: new Date().toISOString(),
                    status: 'pending',
                    is_extra_day: is_extra_day || false
                })
                .select()
                .single()

            if (error) {
                return errorResponse(`Database error: ${error.message}`, 500)
            }

            // Log activity
            await supabase.from('activities').insert({
                user_id: profile_id,
                activity_type: 'data_create',
                module: 'attendance',
                description: `Clocked in at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}${is_extra_day ? ' (Extra Work)' : ''}`
            })

            return successResponse({ record: data, action: 'clock_in' })

        } else if (action === 'clock_out') {
            // Find today's record or unclosed record
            let { data: record } = await supabase
                .from('attendance')
                .select('id, check_in, check_out, date')
                .eq('profile_id', profile_id)
                .eq('date', today)
                .maybeSingle()

            if (!record) {
                // Try to find any unclosed record
                const { data: unclosed } = await supabase
                    .from('attendance')
                    .select('id, check_in, check_out, date')
                    .eq('profile_id', profile_id)
                    .is('check_out', null)
                    .order('date', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                record = unclosed
            }

            if (!record) {
                return errorResponse('No clock-in record found to clock out.', 400)
            }

            if (record.check_out) {
                return errorResponse('Already clocked out for this session.', 400)
            }

            // Update with clock-out
            const { data, error } = await supabase
                .from('attendance')
                .update({
                    check_out: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', record.id)
                .select()
                .single()

            if (error) {
                return errorResponse(`Database error: ${error.message}`, 500)
            }

            // Log activity
            await supabase.from('activities').insert({
                user_id: profile_id,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `Clocked out at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`
            })

            return successResponse({ record: data, action: 'clock_out' })
        }

        return errorResponse('Invalid action. Use "clock_in" or "clock_out".', 400)

    } catch (err: unknown) {
        console.error('Edge Function Error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        return errorResponse(`Server error: ${errorMessage}`, 500)
    }
})
