// ============================================
// lib/trpc/routers/profile.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure } from '../server'
import { profiles, activities, designations } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { profileUpdateSchema } from '@/lib/validations/auth'
import { invalidateUserSession } from '@/lib/auth/optimized-context'
import { invalidateDashboardCache } from './admin-dashboard-optimized'


export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    // Always fetch fresh profile data with designation join
    const data = await ctx.db.query.profiles.findFirst({
      where: eq(profiles.user_id, ctx.user.id),
      with: { designation: true }
    })

    if (!data) {
      console.error('Profile not found for user:', ctx.user.id)
      return ctx.profile
    }

    console.log('[Profile] Fetch result:', {
      userId: ctx.user.id,
      email: data.email,
      role: data.role,
      designation_id: data.designation_id,
      designation_name: (data as any).designation?.name || (data.role === 'admin' ? 'Administrator' : 'Staff')
    })

    return data as any as import('@/types').Profile
  }),

  update: protectedProcedure
    .input(profileUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const updateData: any = {
        updated_at: new Date()
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

      const [updatedProfile] = await ctx.db.update(profiles)
        .set(updateData)
        .where(eq(profiles.user_id, ctx.user.id))
        .returning()

      if (!updatedProfile) throw new Error('Failed to update profile')

      await ctx.db.insert(activities).values({
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

      return updatedProfile
    }),


  updateProfilePicture: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      avatarUrl: z.string().min(1, 'Avatar URL is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Security check: only allow updating own profile picture
      if (input.userId !== ctx.profile.id && ctx.profile.role !== 'admin') {
        throw new Error('Unauthorized to update this profile picture')
      }

      const [updatedProfile] = await ctx.db.update(profiles)
        .set({
          avatar_url: input.avatarUrl,
          updated_at: new Date(),
        })
        .where(eq(profiles.id, input.userId))
        .returning()

      if (!updatedProfile) throw new Error('Failed to update profile picture')

      // Log activity
      await ctx.db.insert(activities).values({
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
      if (updatedProfile.user_id) {
        invalidateUserSession(updatedProfile.user_id)
      }

      return updatedProfile
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
      const data = await ctx.db.query.activities.findMany({
        where: eq(activities.user_id, ctx.profile.id),
        orderBy: [desc(activities.created_at)],
        limit: input.limit
      })
      return data || []
    }),

  getLastSession: protectedProcedure.query(async ({ ctx }) => {
    const [loginResult, logoutResult, profileResult, totalResult] = await Promise.all([
      ctx.db.query.activities.findFirst({
        where: and(eq(activities.user_id, ctx.profile.id), eq(activities.activity_type, 'login')),
        orderBy: [desc(activities.created_at)]
      }),
      ctx.db.query.activities.findFirst({
        where: and(eq(activities.user_id, ctx.profile.id), eq(activities.activity_type, 'logout')),
        orderBy: [desc(activities.created_at)]
      }),
      ctx.db.query.profiles.findFirst({
        where: eq(profiles.id, ctx.profile.id),
        columns: { created_at: true }
      }),
      ctx.db.select({ value: count() }).from(activities).where(eq(activities.user_id, ctx.profile.id))
    ])

    return {
      lastLogin: loginResult?.created_at || null,
      lastLogout: logoutResult?.created_at || null,
      joinedAt: profileResult?.created_at || null,
      totalActivities: totalResult[0].value || 0,
    }
  }),
})