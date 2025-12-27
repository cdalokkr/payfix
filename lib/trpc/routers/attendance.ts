// ============================================
// lib/trpc/routers/attendance.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, moderatorProcedure } from '../server'
import { TRPCError } from '@trpc/server'

export const attendanceRouter = router({
    // --- ATTENDANCE ---

    getAttendance: protectedProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            let query = ctx.supabase
                .from('attendance')
                .select('*, profile:profiles!profile_id(email, full_name)')

            // Role-based filtering
            if (ctx.profile.role === 'employee') {
                query = query.eq('profile_id', ctx.profile.id)
            } else if (input.profileId) {
                query = query.eq('profile_id', input.profileId)
            }

            if (input.startDate) query = query.gte('date', input.startDate)
            if (input.endDate) query = query.lte('date', input.endDate)

            const { data, error } = await query.order('date', { ascending: false })

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
            return data
        }),

    clockIn: protectedProcedure
        .mutation(async ({ ctx }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const today = new Date().toISOString().split('T')[0]

            // Check if already clocked in today
            const { data: existing } = await ctx.supabase
                .from('attendance')
                .select('id')
                .eq('profile_id', ctx.profile.id)
                .eq('date', today)
                .single()

            if (existing) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already clocked in for today.' })
            }

            const { data, error } = await ctx.supabase
                .from('attendance')
                .insert({
                    profile_id: ctx.profile.id,
                    date: today,
                    check_in: new Date().toISOString(),
                    status: 'pending'
                })
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

            // Log activity
            await ctx.supabase.from('activities').insert({
                user_id: ctx.profile.id,
                activity_type: 'data_create',
                module: 'attendance',
                description: `${ctx.profile.full_name || ctx.profile.email} clocked in at ${new Date().toLocaleTimeString()}`,
            })

            return data
        }),

    clockOut: protectedProcedure
        .mutation(async ({ ctx }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const today = new Date().toISOString().split('T')[0]

            const { data: attendance, error: fetchError } = await ctx.supabase
                .from('attendance')
                .select('id, check_in, check_out')
                .eq('profile_id', ctx.profile.id)
                .eq('date', today)
                .single()

            if (fetchError || !attendance) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'No clock-in record found for today.' })
            }

            if (attendance.check_out) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already clocked out for today.' })
            }

            const { data, error } = await ctx.supabase
                .from('attendance')
                .update({
                    check_out: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', attendance.id)
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

            // Log activity
            await ctx.supabase.from('activities').insert({
                user_id: ctx.profile.id,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `${ctx.profile.full_name || ctx.profile.email} clocked out at ${new Date().toLocaleTimeString()}`,
            })

            return data
        }),

    verifyAttendance: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            status: z.enum(['verified', 'rejected']),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { data, error } = await ctx.supabase
                .from('attendance')
                .update({
                    status: input.status,
                    remarks: input.remarks,
                    verified_by: ctx.profile.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', input.id)
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

            const today = new Date().toISOString().split('T')[0]

            // Log activity for real-time update
            await ctx.supabase.from('activities').insert({
                user_id: data.profile_id,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `Attendance record for ${today} was ${input.status} by ${ctx.profile.full_name || ctx.profile.email}`,
            })

            return data
        }),

    manualUpdate: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            checkIn: z.string().optional(),
            checkOut: z.string().optional(),
            status: z.enum(['pending', 'verified', 'rejected']).optional(),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const updateData: any = {
                updated_at: new Date().toISOString()
            }
            if (input.checkIn) updateData.check_in = input.checkIn
            if (input.checkOut) updateData.check_out = input.checkOut
            if (input.status) updateData.status = input.status
            if (input.remarks) updateData.remarks = input.remarks

            const { data, error } = await ctx.supabase
                .from('attendance')
                .update(updateData)
                .eq('id', input.id)
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

            // Log activity for real-time update
            await ctx.supabase.from('activities').insert({
                user_id: data.profile_id,
                activity_type: 'data_edit',
                module: 'attendance',
                description: `Attendance record for ${data.date} was manually updated by ${ctx.profile.full_name || ctx.profile.email}`,
            })

            return data
        }),

    // --- LEAVES ---

    getLeaves: protectedProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
        }))
        .query(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            let query = ctx.supabase
                .from('leaves')
                .select('*, profile:profiles!profile_id(email, full_name)')

            if (ctx.profile.role === 'employee') {
                query = query.eq('profile_id', ctx.profile.id)
            } else if (input.profileId) {
                query = query.eq('profile_id', input.profileId)
            }

            if (input.status !== 'all') {
                query = query.eq('status', input.status)
            }

            const { data, error } = await query.order('created_at', { ascending: false })

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
            return data
        }),

    applyLeave: protectedProcedure
        .input(z.object({
            leaveType: z.string().optional(),
            startDate: z.string(),
            endDate: z.string(),
            reason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { data, error } = await ctx.supabase
                .from('leaves')
                .insert({
                    profile_id: ctx.profile.id,
                    leave_type: input.leaveType,
                    start_date: input.startDate,
                    end_date: input.endDate,
                    reason: input.reason,
                    status: 'pending'
                })
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

            return data
        }),

    approveLeave: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            status: z.enum(['approved', 'rejected']),
            remarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { data, error } = await ctx.supabase
                .from('leaves')
                .update({
                    status: input.status,
                    remarks: input.remarks,
                    approved_by: ctx.profile.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', input.id)
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

            return data
        }),

    // --- SETTINGS ---

    getOfficeSettings: protectedProcedure
        .query(async ({ ctx }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { data, error } = await ctx.supabase
                .from('office_settings')
                .select('*')
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
            return data
        }),

    updateOfficeSettings: adminProcedure
        .input(z.object({
            defaultCheckIn: z.string(),
            defaultCheckOut: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { data, error } = await ctx.supabase
                .from('office_settings')
                .update({
                    default_check_in: input.defaultCheckIn,
                    default_check_out: input.defaultCheckOut,
                    updated_at: new Date().toISOString()
                })
                .eq('id', (await ctx.supabase.from('office_settings').select('id').single()).data?.id)
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
            return data
        }),

    getOfficeClosures: protectedProcedure
        .query(async ({ ctx }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { data, error } = await ctx.supabase
                .from('office_closures')
                .select('*')
                .order('date', { ascending: true })

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
            return data
        }),

    addOfficeClosure: adminProcedure
        .input(z.object({
            date: z.string(),
            reason: z.string(),
            type: z.enum(['holiday', 'closed']),
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { data, error } = await ctx.supabase
                .from('office_closures')
                .insert({
                    date: input.date,
                    reason: input.reason,
                    type: input.type
                })
                .select()
                .single()

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
            return data
        }),

    deleteOfficeClosure: adminProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new Error('Supabase client not available')

            const { error } = await ctx.supabase
                .from('office_closures')
                .delete()
                .eq('id', input.id)

            if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
            return { success: true }
        }),
})
