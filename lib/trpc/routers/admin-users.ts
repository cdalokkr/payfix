// ============================================
// lib/trpc/routers/admin-users.ts
// ============================================
import { z } from 'zod'
import { router, adminProcedure } from '../server'
import { createUserSchema } from '../../validations/auth'
import { Profile, Module } from '../../../types'
import { formatActivityDescription, ChangedField } from '@/lib/utils/activity-logger'
import { getDefaultAvatarUrl, isDefaultAvatar } from '@/lib/utils/avatar-helper'
import { invalidateUserSession } from '@/lib/auth/optimized-context'
import { masterDb } from '@/lib/db/master-connection'
import { tenants, tenantPlans } from '@/lib/db/master-schema'
import { TRPCError } from '@trpc/server'
import { profiles, designations, activities, userStatusHistory } from '@/lib/db/schema'
import { eq, or, ilike, and, ne, desc, count, sql, SQL } from 'drizzle-orm'

function requireTenantId(ctx: { tenant?: { trusted?: boolean; tenantId?: string } | null }): string {
  if (!ctx.tenant?.trusted || !ctx.tenant.tenantId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'A valid workspace context is required.',
    })
  }

  return ctx.tenant.tenantId
}

export const adminUsersRouter = router({
  getUsers: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        role: z.enum(['admin', 'moderator', 'employee', 'all']).default('all'),
        status: z.enum(['active', 'deactive', 'deleted', 'all']).default('all'),
        getAll: z.boolean().default(false), // New parameter to get all users at once
        // Cache-scope marker supplied by the server-rendered page. It is
        // checked against the trusted context and never used to select a DB.
        tenantScope: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startTime = performance.now()
      const tenantId = requireTenantId(ctx)

      if (input.tenantScope && input.tenantScope !== tenantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Workspace context does not match the requested data scope.',
        })
      }

      let filters: (SQL | undefined)[] = [
        eq(profiles.tenant_id, tenantId),
        ne(profiles.id, ctx.profile.id),
      ]

      if (input.status !== 'all') {
        filters.push(eq(profiles.status, input.status))
      } else {
        filters.push(ne(profiles.status, 'deleted'))
      }

      if (input.search) {
        filters.push(
          or(
            ilike(profiles.email, `%${input.search}%`),
            ilike(profiles.full_name, `%${input.search}%`)
          )
        )
      }

      if (input.role !== 'all') {
        filters.push(eq(profiles.role, input.role))
      }

      const where = filters.length > 0 ? and(...filters) : undefined

      // Get count and users concurrently
      const limit = input.getAll ? undefined : input.limit
      const offset = input.getAll ? undefined : (input.page - 1) * input.limit

      const [totalCountResult, users] = await Promise.all([
        ctx.db
          .select({ value: count() })
          .from(profiles)
          .where(where),
        ctx.db.query.profiles.findMany({
          columns: {
            face_embedding: false, // Exclude heavy face embedding column for faster fetch
          },
          where,
          with: {
            designation: true,
          },
          orderBy: [desc(profiles.created_at)],
          limit,
          offset,
        })
      ])

      const total = totalCountResult[0].value

      const duration = performance.now() - startTime
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DRIZZLE-PERF] admin-users.getUsers: ${duration.toFixed(2)}ms`)
      }

      return {
        users: users.map(u => ({
          ...u,
          created_at: u.created_at ? u.created_at.toISOString() : null,
          updated_at: u.updated_at ? u.updated_at.toISOString() : null,
          user_id: u.id, // profiles.id = auth.users.id
          role: u.role as any, // Cast for frontend UserRole
          status: u.status as any, // Cast for frontend status enum
          designation: u.designation ? {
            ...u.designation,
            created_at: u.designation.created_at ? u.designation.created_at.toISOString() : null,
            updated_at: u.designation.updated_at ? u.designation.updated_at.toISOString() : null,
            role: u.designation.role as any,
          } : null
        })),
        total,
        pages: input.getAll ? 1 : Math.ceil(total / input.limit),
      }
    }),

  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(['admin', 'moderator', 'employee']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      const [data] = await ctx.db
        .update(profiles)
        .set({ role: input.role })
        .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)))
        .returning()

      if (!data) throw new Error('User not found')

      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: input.userId, // Fallback
          module: 'users',
          changedFields: [{ name: 'Role', value: input.role }]
        }),
        metadata: { target_user_id: input.userId, changed_fields: ['role'] },
      })

      // Invalidate session cache
      invalidateUserSession(input.userId)

      return data
    }),

  toggleUserStatus: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        status: z.enum(['active', 'deactive']),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      // Get current status for history tracking
      const currentProfile = await ctx.db.query.profiles.findFirst({
        where: and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)),
        columns: {
          status: true,
          id: true,
          email: true,
        }
      })

      if (!currentProfile) {
        throw new Error('User not found')
      }

      if (currentProfile.status === input.status) {
        return currentProfile
      }

      // Update status
      const [data] = await ctx.db
        .update(profiles)
        .set({ status: input.status })
        .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)))
        .returning()

      // Record in history table
      await ctx.db.insert(userStatusHistory).values({
        profile_id: input.userId,
        // target_user_id is in migration but I didn't add it to schema yet?
        // Let's check my expanded schema.
        // I added profile_id, old_status, new_status, reason, changed_by.
        // The original logic had target_user_id (Auth UID) too.
        // Let's stick to what I have in schema.ts.
        old_status: currentProfile.status,
        new_status: input.status,
        reason: input.reason,
        changed_by: ctx.profile.id,
      })

      // Log activity
      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: currentProfile.email || '',
          module: 'users',
          changedFields: [{ name: 'Account Status', value: input.status }]
        }),
        metadata: {
          target_user_id: input.userId,
          action: input.status === 'active' ? 'activated' : 'deactivated',
          reason: input.reason
        },
      })

      // Invalidate session cache
      invalidateUserSession(input.userId)

      return data
    }),

  // Consolidated update user mutation - handles both profile and role updates
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
        middleName: z.string().max(50, 'Middle name too long').optional().or(z.literal('')),
        lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
        email: z.string().email('Invalid email address'),
        mobileNo: z.string()
          .regex(/^(\+?\d{1,3})?[-.\s]?(\(?\d{1,4}\)?)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{0,4}$/, 'Invalid mobile number format')
          .optional()
          .or(z.literal('')),
        dateOfBirth: z.string()
          .refine((val) => {
            if (!val) return true // optional field
            const date = new Date(val)
            const now = new Date()
            const age = now.getFullYear() - date.getFullYear()
            return date <= now && age >= 13 && age <= 120
          }, { message: 'Please enter a valid date of birth (13-120 years old)' })
          .optional()
          .or(z.literal('')),
        role: z.enum(['admin', 'moderator', 'employee']),
        allowedModules: z.array(z.string()).optional(),
        designationId: z.string().uuid().nullable().optional(),
        sex: z.enum(['male', 'female']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      // Check if email is already taken
      const existingProfile = await ctx.db.query.profiles.findFirst({
        where: and(
          eq(profiles.tenant_id, tenantId),
          eq(profiles.email, input.email),
          ne(profiles.id, input.userId),
        )
      })

      if (existingProfile) {
        throw new Error(`A user with email ${input.email} already exists`)
      }

      // Fetch target user's current data
      const currentProfile = await ctx.db.query.profiles.findFirst({
        where: and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)),
        columns: {
          id: true,
          email: true,
          avatar_url: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          mobile_no: true,
          date_of_birth: true,
          role: true,
          designation_id: true,
        }
      })

      if (!currentProfile) throw new Error('User not found')

      // Update auth email if changed (profiles.id = auth.users.id)
      if (currentProfile.email !== input.email && currentProfile.id && ctx.supabase) {
        const { error: authError } = await ctx.supabase.auth.admin.updateUserById(
          currentProfile.id,
          { email: input.email, email_confirm: true }
        )
        if (authError) throw new Error(`Auth update failed: ${authError.message}`)
      }

      const constructFullName = (f: string, m?: string, l?: string) =>
        [f, m, l].filter(s => s && s.trim()).join(' ')

      const fullName = constructFullName(input.firstName, input.middleName, input.lastName)

      const updateData: any = {
        first_name: input.firstName,
        middle_name: input.middleName ?? '',
        last_name: input.lastName,
        email: input.email,
        mobile_no: input.mobileNo ?? '',
        date_of_birth: input.dateOfBirth ?? '',
        sex: input.sex,
        role: input.role,
        designation_id: input.designationId,
        allowed_modules: input.allowedModules,
        full_name: fullName,
        updated_at: new Date(),
      }

      if (!currentProfile.avatar_url || isDefaultAvatar(currentProfile.avatar_url)) {
        updateData.avatar_url = getDefaultAvatarUrl(input.sex)
      }

      const [data] = await ctx.db
        .update(profiles)
        .set(updateData)
        .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)))
        .returning()

      // Log changes
      const changedFieldsFriendly: ChangedField[] = []
      if (currentProfile.first_name !== input.firstName) changedFieldsFriendly.push({ name: 'First Name', value: input.firstName })
      if (currentProfile.email !== input.email) changedFieldsFriendly.push({ name: 'Email', value: input.email })
      if (currentProfile.role !== input.role) changedFieldsFriendly.push({ name: 'Role', value: input.role })

      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: currentProfile.email || input.email,
          module: 'users',
          changedFields: changedFieldsFriendly
        }),
        metadata: { target_user_id: input.userId },
      })

      invalidateUserSession(input.userId)
      return data
    }),

  // Keep the old individual mutations for backward compatibility
  updateUserProfile: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        firstName: z.string().optional(),
        middleName: z.string().optional(),
        lastName: z.string().optional(),
        mobileNo: z.string().optional(),
        dateOfBirth: z.string().optional(),
        sex: z.enum(['male', 'female']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      const updateData: any = {
        updated_at: new Date()
      }
      if (input.firstName !== undefined) updateData.first_name = input.firstName
      if (input.middleName !== undefined) updateData.middle_name = input.middleName
      if (input.lastName !== undefined) updateData.last_name = input.lastName
      if (input.mobileNo !== undefined) updateData.mobile_no = input.mobileNo
      if (input.dateOfBirth !== undefined) updateData.date_of_birth = input.dateOfBirth
      if (input.sex !== undefined) updateData.sex = input.sex

      const [data] = await ctx.db
        .update(profiles)
        .set(updateData)
        .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)))
        .returning()

      if (!data) throw new Error('User not found')

      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: input.userId,
          module: 'users',
          changedFields: Object.keys(updateData).filter(k => k !== 'updated_at').map((k) => {
            let name = k;
            switch (k) {
              case 'first_name': name = 'First Name'; break;
              case 'middle_name': name = 'Middle Name'; break;
              case 'last_name': name = 'Last Name'; break;
              case 'mobile_no': name = 'Mobile Number'; break;
              case 'date_of_birth': name = 'Date of Birth'; break;
              case 'sex': name = 'Sex'; break;
            }
            return { name, value: (updateData as any)[k] };
          })
        }),
        metadata: { target_user_id: input.userId, changed_fields: Object.keys(updateData).filter(k => k !== 'updated_at') },
      })

      // Invalidate session cache to reflect profile changes immediately
      invalidateUserSession(input.userId)

      return data
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().uuid(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      const targetUser = await ctx.db.query.profiles.findFirst({
        where: and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)),
        columns: { email: true, status: true, id: true }
      })

      if (!targetUser) throw new Error('User not found')

      await ctx.db
        .update(profiles)
        .set({ status: 'deleted', updated_at: new Date() })
        .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)))

      await ctx.db.insert(userStatusHistory).values({
        profile_id: input.userId,
        old_status: targetUser.status,
        new_status: 'deleted',
        reason: input.reason || 'User profile deleted by admin',
        changed_by: ctx.profile.id,
      })

      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_delete',
        module: 'users',
        description: formatActivityDescription({
          action: 'delete',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: targetUser.email || 'unknown',
          module: 'users'
        }),
        metadata: { deleted_user_id: input.userId },
      })

      invalidateUserSession(input.userId)
      return { success: true }
    }),

  createUser: adminProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      if (!ctx.supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase client not available' })

      // 1. Enforce Plan Limits check if tenant context is present
      if (tenantId) {
        try {
          const tenantRow = await masterDb
            .select()
            .from(tenants)
            .leftJoin(tenantPlans, eq(tenants.plan_id, tenantPlans.id))
            .where(eq(tenants.id, tenantId))
            .limit(1);

          if (tenantRow[0]) {
            const { tenants: tenantRecord, tenant_plans: planRecord } = tenantRow[0];

            // Determine employee and moderator limits (with custom overrides support)
            const maxEmployees = tenantRecord.max_employees_override !== null
              ? tenantRecord.max_employees_override
              : (planRecord?.max_employees ?? 5); // default 5 for trial fallback

            const maxModerators = tenantRecord.max_moderators_override !== null
              ? tenantRecord.max_moderators_override
              : (planRecord?.max_moderators ?? 2); // default 2 for trial fallback

            if (input.role === 'employee') {
              const currentEmployees = await ctx.db
                .select({ count: count() })
                .from(profiles)
                .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.role, 'employee')));

              const empCount = currentEmployees[0]?.count || 0;
              if (empCount >= maxEmployees) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Employee limit reached. Your plan allows a maximum of ${maxEmployees} employees.`,
                });
              }
            } else if (input.role === 'moderator') {
              const currentModerators = await ctx.db
                .select({ count: count() })
                .from(profiles)
                .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.role, 'moderator')));

              const modCount = currentModerators[0]?.count || 0;
              if (modCount >= maxModerators) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Moderator limit reached. Your plan allows a maximum of ${maxModerators} moderators.`,
                });
              }
            }
          }
        } catch (limitErr) {
          if (limitErr instanceof TRPCError) throw limitErr;
          console.error('[CreateUser] Error verifying plan limits:', limitErr);
          // Don't block user creation on unexpected central db lookup failures, but log it
        }
      }

      // Check if user already exists using Drizzle
      const existingProfile = await ctx.db.query.profiles.findFirst({
        where: and(eq(profiles.tenant_id, tenantId), eq(profiles.email, input.email)),
        columns: { id: true }
      })

      if (existingProfile) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `A user with email ${input.email} already exists`,
        });
      }

      // Create auth user (Keep Supabase for Auth)
      const { data: authData, error: authError } = await ctx.supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      })

      if (authError) throw new Error(`Failed to create auth user: ${authError.message}`)

      const constructFullName = (f: string, m?: string, l?: string) =>
        [f, m, l].filter(s => s && s.trim()).join(' ')

      const fullName = constructFullName(input.firstName, input.middleName, input.lastName)

      // Create the profile using Drizzle
      const [profileData] = await ctx.db.insert(profiles).values({
        id: authData.user!.id,
         tenant_id: tenantId,
        email: input.email,
        first_name: input.firstName,
        middle_name: input.middleName,
        last_name: input.lastName,
        full_name: fullName,
        mobile_no: input.mobileNo,
        date_of_birth: input.dateOfBirth,
        sex: input.sex,
        role: input.role,
        designation_id: input.designationId,
        allowed_modules: input.allowedModules,
        avatar_url: getDefaultAvatarUrl(input.sex),
        status: 'active',
      }).returning()

      if (!profileData) {
        // Rollback: delete the auth user if profile creation fails
        await ctx.supabase.auth.admin.deleteUser(authData.user!.id)
        throw new Error('Profile creation error: No data returned')
      }

      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_create',
        module: 'users',
        description: formatActivityDescription({
          action: 'create',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: input.email,
          module: 'users'
        }),
        metadata: { new_user_id: authData.user!.id },
      })

      return profileData
    }),

  migrateAvatars: adminProcedure
    .mutation(async ({ ctx }) => {
      const tenantId = requireTenantId(ctx)
      // Fetch all users with null avatar_url using Drizzle
      const profilesToUpdate = await ctx.db.query.profiles.findMany({
        where: and(eq(profiles.tenant_id, tenantId), sql`${profiles.avatar_url} IS NULL`),
        columns: { id: true, sex: true }
      })

      if (profilesToUpdate.length === 0) {
        return { updated: 0 }
      }

      let updatedCount = 0
      for (const profile of profilesToUpdate) {
        await ctx.db
          .update(profiles)
          .set({ avatar_url: getDefaultAvatarUrl(profile.sex) })
          .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.id, profile.id)))
        updatedCount++
      }

      return { updated: updatedCount }
    }),

  checkEmailAvailability: adminProcedure
    .input(
      z.object({
        email: z.string().email('Invalid email address'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      const data = await ctx.db.query.profiles.findFirst({
        where: and(eq(profiles.tenant_id, tenantId), eq(profiles.email, input.email)),
        columns: { id: true }
      })

      return {
        available: !data,
        email: input.email
      }
    }),

  updateProfilePicture: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        avatarUrl: z.string().min(1, 'Avatar URL is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      const [data] = await ctx.db
        .update(profiles)
        .set({
          avatar_url: input.avatarUrl,
          updated_at: new Date(),
        })
        .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)))
        .returning()

      if (!data) throw new Error('User not found')

      // Log the activity
      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'profile_update',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: data.email,
          module: 'users',
          changedFields: [{ name: 'Profile Picture', value: 'Updated' }]
        }),
        metadata: {
          target_user_id: input.userId,
          updated_field: 'avatar_url',
        },
      })

      // Invalidate session cache to reflect avatar change immediately
      invalidateUserSession(input.userId)

      return data
    }),


  resetPassword: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      if (!ctx.supabase) throw new Error('Supabase client not available')

      // 1. Get the user's profile to find the auth user_id using Drizzle
      const profile = await ctx.db.query.profiles.findFirst({
        where: and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)),
        columns: { id: true, email: true }
      })

      if (!profile || !profile.id) {
        throw new Error('User profile not found')
      }

      // 2. Update the password in Supabase Auth
      const { error: authError } = await ctx.supabase.auth.admin.updateUserById(
        profile.id,
        { password: input.password }
      )

      if (authError) throw new Error(`Failed to reset password: ${authError.message}`)

      // 3. Log the activity
      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: profile.email,
          module: 'users',
          changedFields: [{ name: 'Password', value: 'Reset' }]
        }),
        metadata: { target_user_id: input.userId, updated_field: 'password' },
      })

      // 4. Invalidate session to ensure security
      invalidateUserSession(profile.id)

      return { success: true }
    }),
})
