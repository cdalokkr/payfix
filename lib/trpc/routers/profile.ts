// ============================================
// lib/trpc/routers/profile.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure } from '../server'
import { profileUpdateSchema } from '@/lib/validations/auth'
import { invalidateUserSession } from '@/lib/auth/optimized-context'
import { invalidateDashboardCache } from './admin-dashboard-optimized'


export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    // Always fetch fresh profile data with designation join
    if (!ctx.supabase) {
      throw new Error('Database service unavailable')
    }

    const { data, error } = await ctx.supabase
      .from('profiles')
      .select('id, user_id, email, full_name, avatar_url, role, first_name, middle_name, last_name, mobile_no, date_of_birth, sex, created_at, updated_at, designation_id, allowed_modules, designation:designations(*)')
      .eq('user_id', ctx.user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      // Fall back to ctx.profile if fresh fetch fails
      return ctx.profile
    }

    // Handle designation array (Supabase returns single relations as array)
    if (data && (data as any).designation && Array.isArray((data as any).designation)) {
      (data as any).designation = (data as any).designation[0] || null
    }

    console.log('[Profile] Fetch result:', {
      userId: ctx.user.id,
      email: data?.email,
      role: data?.role,
      designation_id: data?.designation_id,
      designation_name: (data as any)?.designation?.name || (data?.role === 'admin' ? 'Administrator' : 'Staff')
    })

    return data as any as import('@/types').Profile
  }),

  update: protectedProcedure
    .input(profileUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.supabase) {
        throw new Error('Database service unavailable')
      }

      const updateData: Partial<{
        first_name: string;
        last_name: string;
        middle_name: string;
        avatar_url: string;
        mobile_no: string;
        date_of_birth: string;
        sex: 'male' | 'female';
        full_name: string;
        updated_at: string;
      }> = {
        updated_at: new Date().toISOString()
      }


      if (input.firstName) updateData.first_name = input.firstName
      if (input.lastName) updateData.last_name = input.lastName
      if (input.middleName !== undefined) updateData.middle_name = input.middleName
      if (input.avatar_url !== undefined) updateData.avatar_url = input.avatar_url
      if (input.mobileNo !== undefined) updateData.mobile_no = input.mobileNo
      if (input.dateOfBirth !== undefined) updateData.date_of_birth = input.dateOfBirth
      if (input.sex !== undefined) updateData.sex = input.sex

      // Derive full_name if names changed
      if (input.firstName || input.lastName) {
        const first = input.firstName || ctx.profile.first_name || ''
        const last = input.lastName || ctx.profile.last_name || ''
        updateData.full_name = `${first} ${last}`.trim()
      } else if (input.full_name) {
        updateData.full_name = input.full_name
      }

      const { data, error } = await ctx.supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', ctx.user.id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'profile_update',
        module: 'profile',
        description: 'User updated profile information',
        metadata: {
          updated_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
          timestamp: new Date().toISOString()
        }
      })

      // Invalidate session cache to reflect profile changes immediately
      invalidateUserSession(ctx.user.id)

      return data
    }),


  updateProfilePicture: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      avatarUrl: z.string().min(1, 'Avatar URL is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Database service unavailable')
      }

      // Security check: only allow updating own profile picture
      if (input.userId !== ctx.profile.id && ctx.profile.role !== 'admin') {
        throw new Error('Unauthorized to update this profile picture')
      }

      const { data, error } = await ctx.supabase
        .from('profiles')
        .update({
          avatar_url: input.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.userId)
        .select()
        .single()

      if (error) throw new Error(error.message)

      // Log activity
      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'profile_update',
        module: 'profile',
        description: 'User updated profile picture',
        metadata: {
          updated_field: 'avatar_url',
          timestamp: new Date().toISOString()
        }
      })

      // Invalidate session cache to reflect avatar change immediately
      if (data?.user_id) {
        invalidateUserSession(data.user_id)
      }

      return data
    }),

  invalidateCache: protectedProcedure
    .input(
      z.object({
        pattern: z.string().optional(),
        reason: z.string().optional()
      }).optional()
    )
    .mutation(async ({ input }) => {
      const pattern = input?.pattern
      const reason = input?.reason || 'manual invalidation'

      // Clear all dashboard-related cache entries and increment version
      const invalidatedCount = invalidateDashboardCache(pattern)

      return {
        success: true,
        invalidatedCount,
        timestamp: new Date().toISOString(),
        reason
      }
    }),


  getActivities: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Database service unavailable')
      }

      const { data } = await ctx.supabase
        .from('activities')
        .select('*')
        .eq('user_id', ctx.profile.id)
        .order('created_at', { ascending: false })
        .limit(input.limit)

      return data || []
    }),

  getLastSession: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.supabase) {
      throw new Error('Database service unavailable')
    }

    // Get last login
    const { data: loginData } = await ctx.supabase
      .from('activities')
      .select('created_at')
      .eq('user_id', ctx.profile.id)
      .eq('activity_type', 'login')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get last logout
    const { data: logoutData } = await ctx.supabase
      .from('activities')
      .select('created_at')
      .eq('user_id', ctx.profile.id)
      .eq('activity_type', 'logout')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get account creation date
    const { data: profileData } = await ctx.supabase
      .from('profiles')
      .select('created_at')
      .eq('id', ctx.profile.id)
      .single()

    // Get total activities count
    const { count: totalActivities } = await ctx.supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.profile.id)

    return {
      lastLogin: loginData?.created_at || null,
      lastLogout: logoutData?.created_at || null,
      joinedAt: profileData?.created_at || null,
      totalActivities: totalActivities || 0,
    }
  }),
})