// ============================================
// lib/trpc/routers/auth.ts
// Enhanced Login Validation with Specific Error Types
// ============================================

import { router, publicProcedure, protectedProcedure } from '../server'
import { loginSchema, changePasswordSchema } from '@/lib/validations/auth'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { profiles, activities, designations } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { performLogout, preSeedSessionCache } from '@/lib/auth/optimized-context'
import { formatActivityDescription } from '@/lib/utils/activity-logger'

// Custom error types for specific validation scenarios
const AuthErrorTypes = {
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
  INCORRECT_PASSWORD: 'INCORRECT_PASSWORD',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const

export const authRouter = router({
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.supabase) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication service unavailable',
        })
      }

      try {
        // 0. PRE-AUTH OPTIMIZATION: Check if user is deactivated before expensive auth call
        const preCheck = await ctx.db.query.profiles.findFirst({
          where: eq(profiles.email, input.email),
          columns: { status: true, user_id: true }
        })

        if (preCheck?.status === 'deactive' || preCheck?.status === 'deleted') {
          const isDeleted = preCheck?.status === 'deleted'
          console.warn(`[Auth] Fast-rejected login attempt for ${preCheck?.status} email:`, input.email)

          // Clear any residual session cache for this user if we found their ID
          if (preCheck.user_id) {
            await performLogout(preCheck.user_id)
          }

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: isDeleted
              ? 'Your account is deleted. Please contact administrator.'
              : 'Your account has been deactivated. Please contact administrator.',
          })
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        console.error('[Auth] Pre-check failed, falling back to standard auth:', err)
      }

      try {
        const { data, error } = await ctx.supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        })

        console.log('[Auth] Login attempt:', {
          email: input.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
          success: !error && !!data.user,
          userId: data.user?.id,
          error: error?.message
        })

        if (error) {
          // Parse Supabase error to provide specific error types
          const errorMessage = error.message?.toLowerCase() || ''

          if (errorMessage.includes('invalid login credentials') ||
            errorMessage.includes('invalid credentials') ||
            errorMessage.includes('email not confirmed')) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Invalid email or password',
              cause: { type: AuthErrorTypes.INVALID_CREDENTIALS, field: 'both' }
            })
          }

          if (errorMessage.includes('email not found') ||
            errorMessage.includes('user not found') ||
            errorMessage.includes('signup_disabled')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Invalid email or password',  // Same message for all auth failures
              cause: { type: AuthErrorTypes.EMAIL_NOT_FOUND, field: 'email' }
            })
          }

          if (errorMessage.includes('invalid password') ||
            errorMessage.includes('wrong password') ||
            errorMessage.includes('password is incorrect')) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Invalid email or password',  // Same message for all auth failures
              cause: { type: AuthErrorTypes.INCORRECT_PASSWORD, field: 'password' }
            })
          }

          // Generic unauthorized error
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',  // Same message for all auth failures
            cause: { type: AuthErrorTypes.INVALID_CREDENTIALS, field: 'both' }
          })
        }

        // 1. FAST CHECK: Check user status from metadata first (Optimization)
        // This allows for "near-instant" rejection of deactivated users without high database load
        const metadataStatus = (data.user?.user_metadata as any)?.status
        if (metadataStatus === 'deactive' || metadataStatus === 'deleted') {
          const isDeleted = metadataStatus === 'deleted'
          console.warn(`[Auth] Blocked login via metadata for ${metadataStatus} user:`, data.user.id)

          // CRITICAL: Sign out and clear session even though Supabase auth succeeded
          await ctx.supabase.auth.signOut()
          await performLogout(data.user.id)

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: isDeleted
              ? 'Your account is deleted. Please contact administrator.'
              : 'Your account has been deactivated. Please contact administrator.',
          })
        }

        // Fetch profile and prepare activity log in parallel where possible
        // We need the profile for the role in activity log, so we fetch profile first
        // But we can return the response and log activity concurrently if we structure it right

        // Fetch profile and last logout in parallel for maximum performance
        const [profileData, lastLogoutResult] = await Promise.all([
          ctx.db.query.profiles.findFirst({
            where: eq(profiles.user_id, data.user.id),
            with: { designation: true }
          }),
          ctx.db.query.activities.findFirst({
            where: and(eq(activities.user_id, data.user.id), eq(activities.activity_type, 'logout')),
            orderBy: [desc(activities.created_at)]
          })
        ])

        const lastLogout = lastLogoutResult?.created_at || null

        // Profile fetch success, but we haven't checked status yet.
        // Activity logging will happen later if user is active.

        // Handle profile fetch failure - still allow login but with warning
        if (!profileData) {
          console.warn('[Auth] Profile fetch failed for user:', data.user.id)
          return {
            success: true,
            profile: null as any,
            user: {
              id: data.user.id,
              email: data.user.email
            },
            warning: 'Profile not found. Please contact administrator.'
          }
        }

        // Check user status
        if (profileData.status === 'deactive' || profileData.status === 'deleted') {
          const isDeleted = profileData.status === 'deleted'
          console.warn(`[Auth] Blocked login and clearing session for ${profileData.status} user:`, data.user.id)

          // CRITICAL: Sign out and clear session even though Supabase auth succeeded
          // This prevents a session cookie from being created/persisted for a deactive user
          await ctx.supabase.auth.signOut()
          await performLogout(data.user.id)

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: isDeleted
              ? 'Your account is deleted. Please contact administrator.'
              : 'Your account has been deactivated. Please contact administrator.',
          })
        }

        // Log successful login activity - FIRE AND FORGET (with error handling)
        // Only log after we've confirmed the user is active
        const logActivity = async () => {
          try {
            await ctx.db.insert(activities).values({
              user_id: profileData.id,
              activity_type: 'login',
              module: 'auth',
              description: formatActivityDescription({
                action: 'login',
                actorRole: profileData?.role || 'employee',
                actorEmail: data.user.email || '',
                module: 'auth'
              }),
            })
          } catch (err) {
            console.error('[AUTH-LOGIN] Background activity logging failed:', err)
          }
        }

        // Execute logging for active user in background
        logActivity()

        // Ensure role is present
        if (!profileData.role) {
          console.warn('[Auth] Profile missing role for user:', data.user.id)
          profileData.role = 'employee' // Default to employee role
        }

        // PRE-SEED CACHE: Pre-populate session cache for instant first dashboard load
        // This eliminates the ~600ms cache miss on the first protected procedure after login
        preSeedSessionCache(data.user, profileData as any).catch(err => {
          console.warn('[AUTH-LOGIN] Pre-seed cache failed (non-critical):', err)
        })

        return {
          success: true,
          profile: profileData,
          lastLogout: lastLogout,
          user: {
            id: data.user.id,
            email: data.user.email
          },
          warning: null as string | null
        }
      } catch (error) {
        // Handle network or other errors
        if (error instanceof TRPCError) {
          throw error
        }

        // Network or other errors
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Network error. Please check your connection and try again.',
          cause: { type: AuthErrorTypes.NETWORK_ERROR, field: 'none' }
        })
      }
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.supabase) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Authentication service unavailable',
      })
    }

    console.log('[AUTH-LOGOUT] Logout procedure executed for user:', ctx.user?.id)

    try {
      // Log the logout activity before clearing the session
      if (ctx.user) {
        // Use ctx.profile.role if available, otherwise fallback to user
        // ctx.profile should be populated by the optimized context
        const actorRole = ctx.profile?.role || 'employee'

        await ctx.db.insert(activities).values({
          user_id: ctx.profile?.id || ctx.user.id,
          activity_type: 'logout',
          module: 'auth',
          description: formatActivityDescription({
            action: 'logout',
            actorRole: actorRole,
            actorEmail: ctx.user.email || '',
            module: 'auth'
          }),
        })
      }

      // Sign out from Supabase (this clears auth cookies)
      const { error: signOutError } = await ctx.supabase.auth.signOut()
      if (signOutError) {
        console.error('[AUTH-LOGOUT] Error signing out from Supabase:', signOutError)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sign out from authentication service',
        })
      }

      // Clear session cache and perform comprehensive logout cleanup
      const logoutResult = await performLogout()
      if (!logoutResult.success) {
        console.warn('[AUTH-LOGOUT] Session cache cleanup had issues:', logoutResult.error)
        // Don't fail the logout if cache cleanup has issues
      }

      console.log('[AUTH-LOGOUT] Successfully completed logout for user:', ctx.user?.id)
      return { success: true, message: 'Successfully logged out' }

    } catch (error) {
      console.error('[AUTH-LOGOUT] Logout procedure failed:', error)

      // Even if there's an error, try to clear the session cache
      await performLogout()

      if (error instanceof TRPCError) {
        throw error
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Logout failed. Please try again.',
      })
    }
  }),

  logActivity: protectedProcedure
    .input(z.object({ type: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.supabase) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database service unavailable',
        })
      }

      await ctx.db.insert(activities).values({
        user_id: ctx.profile?.id || ctx.user.id,
        activity_type: input.type as any,
        module: 'auth',
        description: `User ${input.type}`,
      })

      return { success: true }
    }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.supabase || !ctx.user) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication service unavailable',
        })
      }

      const email = ctx.user.email
      if (!email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User email not available',
        })
      }

      // Verify current password
      const { error: verifyError } = await ctx.supabase.auth.signInWithPassword({
        email,
        password: input.currentPassword,
      })

      if (verifyError) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        })
      }

      // Update to new password
      const { data: updateData, error: updateError } = await ctx.supabase.auth.updateUser({
        password: input.newPassword,
      })

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateError.message || 'Failed to update password',
        })
      }

      // Log activity
      await ctx.db.insert(activities).values({
        user_id: ctx.profile?.id || ctx.user.id,
        activity_type: 'password_change',
        module: 'auth',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile?.role || 'employee',
          actorEmail: email,
          module: 'auth'
        }),
      })

      return { success: true, userId: ctx.user.id }
    }),
})
