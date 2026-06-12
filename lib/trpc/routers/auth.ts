// ============================================
// lib/trpc/routers/auth.ts
// Enhanced Login Validation with Specific Error Types
// ============================================

import { router, publicProcedure, protectedProcedure } from '../server'
import { loginSchema, changePasswordSchema } from '@/lib/validations/auth'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { profiles, activities, designations, attendance } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { performLogout, preSeedSessionCache } from '@/lib/auth/optimized-context'
import { formatActivityDescription } from '@/lib/utils/activity-logger'
import { queryManager } from '@/lib/db/optimized-query-manager'

// Custom error types for specific validation scenarios
const AuthErrorTypes = {
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
  INCORRECT_PASSWORD: 'INCORRECT_PASSWORD',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export const authRouter = router({

  // Helper: walk the full error cause chain and collect all messages into one string
  // This handles cases like Drizzle wrapping Postgres errors in nested .cause properties
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
          columns: { status: true, id: true }
        })

        if (preCheck?.status === 'deactive' || preCheck?.status === 'deleted') {
          const isDeleted = preCheck?.status === 'deleted'
          console.warn(`[Auth] Fast-rejected login attempt for ${preCheck?.status} email:`, input.email)

          // Clear any residual session cache for this user if we found their ID
          if (preCheck.id) {
            await performLogout(preCheck.id)
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
        // Walk full error cause chain to find database-specific messages
        const fullChain = (() => {
          const msgs: string[] = []
          let current: any = err
          while (current) {
            if (current.message) msgs.push(current.message.toLowerCase())
            current = current.cause
          }
          return msgs.join(' | ')
        })()
        // Detect database-level failures that indicate the project is paused or unavailable
        if (
          fullChain.includes('tenant or user not found') ||
          fullChain.includes('project is paused') ||
          fullChain.includes('connection terminated') ||
          fullChain.includes('too many connections') ||
          fullChain.includes('xx000')
        ) {
          console.error('[Auth] Database unavailable (project likely paused):', fullChain)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database service is currently unavailable. The Supabase project might be paused or disconnected. Please check the Supabase dashboard.',
            cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
          })
        }
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

        // OPTIMIZATION: Warm up DB connection immediately after successful auth
        // This pre-establishes the connection pool before dashboard queries are fired
        if (!error && data.user) {
          queryManager.warmupConnection().catch(() => { })
        }

        if (error) {
          // Parse Supabase error to provide specific error types
          const errorMessage = error.message?.toLowerCase() || ''
          const status = (error as any).status

          // Check for network/fetch failures — but inspect cause to distinguish
          // project-paused (supabase DNS gone) vs user's actual network being down
          if (
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('failed to fetch') ||
            errorMessage.includes('network request failed') ||
            errorMessage.includes('enotfound') ||
            errorMessage.includes('econnrefused')
          ) {
            // Inspect the cause chain for supabase-specific hostnames
            const causeMsg = (error as any)?.cause?.message?.toLowerCase() || ''
            const isSupabaseHost = causeMsg.includes('supabase.co') || causeMsg.includes('supabase.in')

            if (isSupabaseHost) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Database service is currently unavailable. The Supabase project might be paused or disconnected. Please check the Supabase dashboard.',
                cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
              })
            }

            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Unable to connect to the server. Please check your internet connection.',
              cause: { type: AuthErrorTypes.NETWORK_ERROR, field: 'none' }
            })
          }

          // Check for service unavailability (5xx errors or database-specific messages)
          if (
            status >= 500 ||
            errorMessage.includes('service unavailable') ||
            errorMessage.includes('database') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('project is paused') ||
            errorMessage.includes('connection terminated') ||
            errorMessage.includes('too many connections')
          ) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Database service is currently unavailable. The project might be paused or disconnected.',
              cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
            })
          }

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
            where: eq(profiles.id, data.user.id),
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

        // PRE-SEED SESSION CACHE: Pre-populate session cache for instant first dashboard load
        preSeedSessionCache(data.user, profileData as any).catch(err => {
          console.warn('[AUTH-LOGIN] Pre-seed session cache failed (non-critical):', err)
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
        // Handle network or other errors outside of the signInWithPassword call
        if (error instanceof TRPCError) {
          throw error
        }

        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

        // Walk the full cause chain for deeper inspection
        const fullChain = (() => {
          const msgs: string[] = []
          let current: any = error
          while (current) {
            if (current.message) msgs.push(current.message.toLowerCase())
            current = current.cause
          }
          return msgs.join(' | ')
        })()

        // Check if the cause chain mentions supabase hostnames (project paused/down)
        if (
          fullChain.includes('supabase.co') ||
          fullChain.includes('supabase.in') ||
          fullChain.includes('tenant or user not found') ||
          fullChain.includes('project is paused') ||
          fullChain.includes('connection terminated')
        ) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database service is currently unavailable. The Supabase project might be paused or disconnected. Please check the Supabase dashboard.',
            cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
          })
        }

        // Network connectivity issues (no supabase host in chain = user's own network)
        if (
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('network request failed') ||
          errorMessage.includes('enotfound') ||
          errorMessage.includes('econnrefused')
        ) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unable to connect to the server. Please check your internet connection.',
            cause: { type: AuthErrorTypes.NETWORK_ERROR, field: 'none' }
          })
        }

        // Database/service unavailability
        if (
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('database') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('project is paused') ||
          errorMessage.includes('connection terminated') ||
          errorMessage.includes('too many connections')
        ) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database service is currently unavailable. The project might be paused or down.',
            cause: { type: AuthErrorTypes.SERVICE_UNAVAILABLE, field: 'none' }
          })
        }

        // Generic Network or other errors
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Network error or service unavailable. Please check your connection and try again.',
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
      // Log the logout activity & sign out from Supabase concurrently
      const activityPromise = ctx.user
        ? ctx.db.insert(activities).values({
            user_id: ctx.profile?.id || ctx.user.id,
            activity_type: 'logout',
            module: 'auth',
            description: formatActivityDescription({
              action: 'logout',
              actorRole: ctx.profile?.role || 'employee',
              actorEmail: ctx.user.email || '',
              module: 'auth'
            }),
          })
        : Promise.resolve();

      const [signOutResult] = await Promise.all([
        ctx.supabase.auth.signOut(),
        activityPromise
      ])

      const { error: signOutError } = signOutResult
      if (signOutError) {
        console.error('[AUTH-LOGOUT] Error signing out from Supabase:', signOutError)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sign out from authentication service',
        })
      }

      // Clear session cache and perform comprehensive logout cleanup for this specific user
      const logoutResult = await performLogout(ctx.user?.id)
      if (!logoutResult.success) {
        console.warn('[AUTH-LOGOUT] Session cache cleanup had issues:', logoutResult.error)
        // Don't fail the logout if cache cleanup has issues
      }

      console.log('[AUTH-LOGOUT] Successfully completed logout for user:', ctx.user?.id)
      return { success: true, message: 'Successfully logged out' }

    } catch (error) {
      console.error('[AUTH-LOGOUT] Logout procedure failed:', error)

      // Even if there's an error, try to clear the session cache for this specific user
      await performLogout(ctx.user?.id)

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

      // Log activity - fire and forget to prevent password change flow from failing if logging fails
      const logPasswordChangeActivity = async () => {
        try {
          await ctx.db.insert(activities).values({
            user_id: ctx.profile?.id || ctx.user.id,
            activity_type: 'profile_update',
            module: 'auth',
            description: formatActivityDescription({
              action: 'update',
              actorRole: ctx.profile?.role || 'employee',
              actorEmail: email,
              module: 'auth'
            }),
          })
        } catch (err) {
          console.error('[AUTH-PASSWORD-CHANGE] Background activity logging failed:', err)
        }
      }
      logPasswordChangeActivity()

      return { success: true, userId: ctx.user.id }
    }),
})
