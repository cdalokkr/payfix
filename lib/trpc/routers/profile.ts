// ============================================
// lib/trpc/routers/profile.ts
// ============================================
import { z } from 'zod'
import { router, protectedProcedure } from '../server'
import { profiles, activities, designations, profilePhotoRequests } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { profileUpdateSchema } from '@/lib/validations/auth'
import { invalidateUserSession } from '@/lib/auth/optimized-context'
import { invalidateDashboardCache } from './admin-dashboard-optimized'
import { ProfileService } from '@/lib/services/profile.service'
import { TRPCError } from '@trpc/server'

export const profileRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    return ctx.profile as any as import('@/types').Profile
  }),

  getTenantInfo: protectedProcedure.query(({ ctx }) => {
    return ctx.tenant;
  }),

  update: protectedProcedure
    .input(profileUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await ProfileService.updateProfile({
          id: ctx.user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          middleName: input.middleName,
          avatarUrl: input.avatar_url,
          mobileNo: input.mobileNo,
          dateOfBirth: input.dateOfBirth,
          sex: input.sex,
          fullName: input.full_name
        })
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update profile'
        })
      }
    }),

  updateProfilePicture: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      avatarUrl: z.string().min(1, 'Avatar URL is required'),
      avatarStatus: z.enum(['default', 'custom']).optional().default('custom'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Security check: only allow updating own profile picture
      if (input.userId !== ctx.profile.id && ctx.profile.role !== 'admin') {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized to update this profile picture'
        })
      }

      try {
        return await ProfileService.updateProfilePicture({
          userId: input.userId,
          avatarUrl: input.avatarUrl,
          avatarStatus: input.avatarStatus,
          actorId: ctx.profile.id
        })
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update profile picture'
        })
      }
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

  // =====================================================
  // PROFILE PHOTO REQUESTS (Approval Workflow)
  // =====================================================

  getMyPendingPhotoRequest: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ProfileService.getPendingPhotoRequest(ctx.profile.id)
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to retrieve pending photo request'
      })
    }
  }),

  getMyLastRejectedRequest: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ProfileService.getLastRejectedRequest(ctx.profile.id)
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to retrieve last rejected photo request'
      })
    }
  }),

  createPhotoUpdateRequest: protectedProcedure
    .input(z.object({
      pendingPhotoUrl: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ProfileService.createPhotoUpdateRequest({
          profileId: ctx.profile.id,
          pendingPhotoUrl: input.pendingPhotoUrl
        })
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to request profile photo update'
        })
      }
    }),

  getPendingPhotoRequests: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.profile.role !== 'admin' && ctx.profile.role !== 'moderator') {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
    }
    try {
      return await ProfileService.getPendingPhotoRequests()
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to retrieve pending photo requests'
      })
    }
  }),

  getPhotoRequestStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.profile.role !== 'admin' && ctx.profile.role !== 'moderator') {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
    }
    try {
      return await ProfileService.getPhotoRequestStats()
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to retrieve photo request stats'
      })
    }
  }),

  getAllPhotoRequests: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.profile.role !== 'admin' && ctx.profile.role !== 'moderator') {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
    }
    try {
      return await ProfileService.getAllPhotoRequests()
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to retrieve photo requests'
      })
    }
  }),

  reviewPhotoRequest: protectedProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      action: z.enum(['approve', 'reject']),
      rejectionReason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.profile.role !== 'admin' && ctx.profile.role !== 'moderator') {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
      }
      try {
        return await ProfileService.reviewPhotoRequest({
          requestId: input.requestId,
          action: input.action,
          rejectionReason: input.rejectionReason,
          reviewerId: ctx.profile.id
        })
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to review photo request'
        })
      }
    }),

  /**
   * Save a browser-extracted 128-d face descriptor (from face-api.js) to the
   * profiles.face_embedding column. Tenant-isolated via the db proxy.
   */
  saveFaceEmbedding: protectedProcedure
    .input(z.object({
      embedding: z.array(z.number()).length(128, 'Face embedding must be exactly 128 dimensions'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .update(profiles)
          .set({ face_embedding: input.embedding })
          .where(eq(profiles.id, ctx.profile.id))

        return { success: true, message: 'Face embedding saved successfully.' }
      } catch (err: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to save face embedding'
        })
      }
    }),
})