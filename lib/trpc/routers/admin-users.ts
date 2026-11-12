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
import { profiles, designations, activities, userStatusHistory, employeeSettings } from '@/lib/db/schema'
import { createSupabaseAdminClient } from '@/lib/auth/supabase-admin'
import { eq, or, ilike, and, ne, desc, count, sql, SQL, inArray } from 'drizzle-orm'

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

      // When fetching all users for client-side table operations, skip the separate count() query
      let total: number
      let users: any[]

      if (input.getAll) {
        users = await ctx.db.query.profiles.findMany({
          columns: {
            face_embedding: false, // Exclude heavy face embedding column for faster fetch
          },
          where,
          with: {
            designation: true,
            department: true,
            settings: true,
          },
          orderBy: [desc(profiles.created_at)],
        })
        total = users.length
      } else {
        const [totalCountResult, usersResult] = await Promise.all([
          ctx.db
            .select({ value: count() })
            .from(profiles)
            .where(where),
          ctx.db.query.profiles.findMany({
            columns: {
              face_embedding: false,
            },
            where,
            with: {
              designation: true,
              department: true,
              settings: true,
            },
            orderBy: [desc(profiles.created_at)],
            limit: input.limit,
            offset: (input.page - 1) * input.limit,
          })
        ])
        total = totalCountResult[0].value
        users = usersResult
      }

      const duration = performance.now() - startTime
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DRIZZLE-PERF] admin-users.getUsers: ${duration.toFixed(2)}ms`)
      }

      return {
        users: users.map(u => ({
          ...u,
          biometricDeviceId: u.settings?.biometric_device_user_id || null,
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
          } : null,
          department: u.department ? {
            ...u.department,
            created_at: u.department.created_at ? u.department.created_at.toISOString() : null,
            updated_at: u.department.updated_at ? u.department.updated_at.toISOString() : null,
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
        email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
        mobileNo: z.string()
          .regex(/^(\+?\d{1,3})?[-.\s]?(\(?\d{1,4}\)?)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{0,4}$/, 'Invalid mobile number format')
          .optional()
          .nullable()
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
        departmentId: z.string().uuid().nullable().optional(),
        designationId: z.string().uuid().nullable().optional(),
        biometricDeviceId: z.string().optional().nullable().or(z.literal('')),
        sex: z.enum(['male', 'female']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      // Check if email is already taken
      if (input.email?.trim()) {
        const existingProfile = await ctx.db.query.profiles.findFirst({
          where: and(
            eq(profiles.tenant_id, tenantId),
            eq(profiles.email, input.email.trim().toLowerCase()),
            ne(profiles.id, input.userId),
          )
        })

        if (existingProfile) {
          throw new Error(`A user with email ${input.email} already exists`)
        }
      }

      // Check if mobile is already taken by another user
      if (input.mobileNo?.trim()) {
        const existingMobile = await ctx.db.query.profiles.findFirst({
          where: and(
            eq(profiles.tenant_id, tenantId),
            eq(profiles.mobile_no, input.mobileNo.trim()),
            ne(profiles.id, input.userId),
          )
        })

        if (existingMobile) {
          throw new Error(`A user with mobile number ${input.mobileNo} already exists`)
        }
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
      if (input.email && currentProfile.email !== input.email && currentProfile.id) {
        const supabaseAdmin = createSupabaseAdminClient()
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          currentProfile.id,
          { email: input.email, email_confirm: true }
        )
        if (authError) throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Auth update failed: ${authError.message}`,
        })
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
        department_id: input.departmentId ?? null,
        designation_id: input.designationId ?? null,
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
        biometricDeviceId: z.string().optional().nullable().or(z.literal('')),
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

      // Handle Biometric Device User ID update
      if (input.biometricDeviceId !== undefined) {
        const cleanBioId = input.biometricDeviceId?.trim() || null
        if (cleanBioId) {
          const tenantProfiles = await ctx.db.query.profiles.findMany({
            where: and(eq(profiles.tenant_id, tenantId), ne(profiles.id, input.userId)),
            columns: { id: true, full_name: true }
          })
          const otherIds = tenantProfiles.map(p => p.id)
          if (otherIds.length > 0) {
            const conflict = await ctx.db.query.employeeSettings.findFirst({
              where: and(
                eq(employeeSettings.biometric_device_user_id, cleanBioId),
                inArray(employeeSettings.profile_id, otherIds)
              )
            })
            if (conflict) {
              const conflictUser = tenantProfiles.find(p => p.id === conflict.profile_id)
              throw new TRPCError({
                code: 'CONFLICT',
                message: `Biometric Machine ID "${cleanBioId}" is already assigned to "${conflictUser?.full_name || 'another user'}". Every user must have a unique ID on the biometric machine.`,
              })
            }
          }
        }

        await ctx.db
          .insert(employeeSettings)
          .values({
            profile_id: input.userId,
            biometric_device_user_id: cleanBioId,
            updated_at: new Date()
          })
          .onConflictDoUpdate({
            target: employeeSettings.profile_id,
            set: {
              biometric_device_user_id: cleanBioId,
              updated_at: new Date()
            }
          })
      }

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
                .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.role, 'employee'), ne(profiles.status, 'deleted')));

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
                .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.role, 'moderator'), ne(profiles.status, 'deleted')));

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

      const normalizedMobile = input.mobileNo.trim()
      const existingMobile = await ctx.db.query.profiles.findFirst({
        where: and(
          eq(profiles.tenant_id, tenantId),
          eq(profiles.mobile_no, normalizedMobile)
        ),
        columns: { id: true }
      })
      if (existingMobile) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `A user with mobile number ${input.mobileNo} already exists`,
        });
      }

      const hasEmail = !!(input.email && input.email.trim())
      const normalizedEmail = hasEmail 
        ? input.email!.trim().toLowerCase() 
        : `mobile_${normalizedMobile}@${tenantId || 'payfix'}.internal`

      if (hasEmail) {
        // Check if user already exists using Drizzle (exact case-normalized comparison without wildcard issues)
        const existingProfile = await ctx.db.query.profiles.findFirst({
          where: and(
            eq(profiles.tenant_id, tenantId),
            sql`LOWER(${profiles.email}) = ${normalizedEmail}`
          ),
          columns: { id: true }
        })

        if (existingProfile) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `A user with email ${input.email} already exists`,
          });
        }
      }

      const constructFullName = (f: string, m?: string, l?: string) =>
        [f, m, l].filter(s => s && s.trim()).join(' ')

      const fullName = constructFullName(input.firstName, input.middleName, input.lastName)

      // Create auth user using dedicated Supabase admin client
      const supabaseAdmin = createSupabaseAdminClient()
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          status: 'active',
        },
      })

      if (authError) {
        if (authError.message?.toLowerCase().includes('already') || authError.status === 422) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `A user with email ${normalizedEmail} already exists`,
          });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to create auth user: ${authError.message}`,
        });
      }

      if (!authData?.user) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create auth user: No user returned',
        });
      }

      // Create the profile using Drizzle
      let profileData: any
      try {
        const [inserted] = await ctx.db.insert(profiles).values({
          id: authData.user.id,
          tenant_id: tenantId,
          email: normalizedEmail,
          first_name: input.firstName,
          middle_name: input.middleName,
          last_name: input.lastName,
          full_name: fullName,
          mobile_no: normalizedMobile,
          date_of_birth: input.dateOfBirth,
          sex: input.sex,
          role: input.role,
          department_id: input.departmentId || null,
          designation_id: input.designationId || null,
          allowed_modules: input.allowedModules,
          avatar_url: getDefaultAvatarUrl(input.sex),
          status: 'active',
        }).returning()

        profileData = inserted
      } catch (insertError: any) {
        // Rollback: delete the auth user if profile insertion fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        } catch (rollbackErr) {
          console.error('[CreateUser] Failed to rollback auth user:', rollbackErr)
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: insertError?.message ? `Failed to create user profile: ${insertError.message}` : 'Failed to create user profile',
        })
      }

      if (!profileData) {
        // Rollback: delete the auth user if profile creation fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        } catch (rollbackErr) {
          console.error('[CreateUser] Failed to rollback auth user:', rollbackErr)
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Profile creation error: No data returned',
        })
      }

      // Upsert biometric device ID in employeeSettings if provided
      if (input.biometricDeviceId && input.biometricDeviceId.trim()) {
        const cleanBioId = input.biometricDeviceId.trim()
        const tenantProfiles = await ctx.db.query.profiles.findMany({
          where: eq(profiles.tenant_id, tenantId),
          columns: { id: true, full_name: true }
        })
        const otherIds = tenantProfiles.map(p => p.id)
        if (otherIds.length > 0) {
          const conflict = await ctx.db.query.employeeSettings.findFirst({
            where: and(
              eq(employeeSettings.biometric_device_user_id, cleanBioId),
              inArray(employeeSettings.profile_id, otherIds)
            )
          })
          if (conflict) {
            const conflictUser = tenantProfiles.find(p => p.id === conflict.profile_id)
            throw new TRPCError({
              code: 'CONFLICT',
              message: `Biometric Machine ID "${cleanBioId}" is already assigned to "${conflictUser?.full_name || 'another user'}". Every user must have a unique ID on the biometric machine.`,
            })
          }
        }

        try {
          await ctx.db
            .insert(employeeSettings)
            .values({
              profile_id: authData.user.id,
              biometric_device_user_id: cleanBioId,
              updated_at: new Date()
            })
            .onConflictDoUpdate({
              target: employeeSettings.profile_id,
              set: {
                biometric_device_user_id: cleanBioId,
                updated_at: new Date()
              }
            })
        } catch (setErr) {
          console.error('[CreateUser] Warning: Failed to set biometric ID in employeeSettings:', setErr)
        }
      }

      await ctx.db.insert(activities).values({
        user_id: ctx.profile.id,
        activity_type: 'data_create',
        module: 'users',
        description: formatActivityDescription({
          action: 'create',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: normalizedEmail,
          module: 'users'
        }),
        metadata: { new_user_id: authData.user.id },
      })

      return profileData
    }),

  bulkCreateUsers: adminProcedure
    .input(
      z.object({
        users: z.array(
          z.object({
            name: z.string().min(1, 'Name is required'),
            mobileNo: z.string().min(10, 'Mobile must be at least 10 digits'),
            dateOfBirth: z.string().optional().nullable().or(z.literal('')),
            sex: z.enum(['male', 'female']),
            email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
            departmentId: z.string().uuid().optional().nullable(),
            designationId: z.string().uuid().optional().nullable(),
            role: z.enum(['admin', 'moderator', 'employee']).default('employee'),
          })
        )
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = requireTenantId(ctx)
      const inputUsers = input.users
      if (!inputUsers || inputUsers.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No users provided for bulk import.',
        })
      }

      // 1. Check Plan Limits
      try {
        const tenantRow = await masterDb
          .select()
          .from(tenants)
          .leftJoin(tenantPlans, eq(tenants.plan_id, tenantPlans.id))
          .where(eq(tenants.id, tenantId))
          .limit(1)

        if (tenantRow[0]) {
          const { tenants: tenantRecord, tenant_plans: planRecord } = tenantRow[0]
          const maxEmployees = tenantRecord.max_employees_override !== null
            ? tenantRecord.max_employees_override
            : (planRecord?.max_employees ?? 10)

          const currentEmployees = await ctx.db
            .select({ count: count() })
            .from(profiles)
            .where(and(eq(profiles.tenant_id, tenantId), eq(profiles.role, 'employee'), ne(profiles.status, 'deleted')))

          const empCount = currentEmployees[0]?.count || 0
          const newEmployeesCount = inputUsers.filter(u => u.role === 'employee').length

          if (empCount + newEmployeesCount > maxEmployees) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Plan limit exceeded. Your plan allows ${maxEmployees} employees (currently active: ${empCount}, attempting to add: ${newEmployeesCount}).`,
            })
          }
        }
      } catch (limitErr) {
        if (limitErr instanceof TRPCError) throw limitErr
        console.error('[BulkCreateUsers] Plan limit check notice:', limitErr)
      }

      const supabaseAdmin = createSupabaseAdminClient()
      const DEFAULT_PASSWORD = '#User@1234$'

      // Fetch existing mobiles and emails in this tenant to fast-validate
      const existingProfiles = await ctx.db.query.profiles.findMany({
        where: eq(profiles.tenant_id, tenantId),
        columns: { mobile_no: true, email: true }
      })
      const existingMobileSet = new Set(existingProfiles.map(p => p.mobile_no?.replace(/\D/g, '').slice(-10)).filter(Boolean))
      const existingEmailSet = new Set(existingProfiles.map(p => p.email?.toLowerCase()).filter(Boolean))

      let createdCount = 0
      const skippedRecords: Array<{ name: string; mobileNo: string; email?: string; reason: string }> = []
      const createdUsers: Array<{ id: string; name: string; email: string; mobileNo: string }> = []

      for (const u of inputUsers) {
        const rawName = u.name.trim()
        const parts = rawName.split(/\s+/)
        const firstName = parts[0] || rawName
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName
        const fullName = rawName

        const normalizedMobile = u.mobileNo.replace(/\D/g, '').slice(-10)
        if (normalizedMobile.length < 10) {
          skippedRecords.push({
            name: rawName,
            mobileNo: u.mobileNo,
            email: u.email || undefined,
            reason: 'Invalid mobile number (must be 10 digits)'
          })
          continue
        }

        if (existingMobileSet.has(normalizedMobile)) {
          skippedRecords.push({
            name: rawName,
            mobileNo: normalizedMobile,
            email: u.email || undefined,
            reason: `Mobile number ${normalizedMobile} is already registered`
          })
          continue
        }

        const hasEmail = !!(u.email && u.email.trim())
        const normalizedEmail = hasEmail 
          ? u.email!.trim().toLowerCase() 
          : `mobile_${normalizedMobile}@${tenantId || 'payfix'}.internal`

        if (hasEmail && existingEmailSet.has(normalizedEmail)) {
          skippedRecords.push({
            name: rawName,
            mobileNo: normalizedMobile,
            email: u.email || undefined,
            reason: `Email ${u.email} is already registered`
          })
          continue
        }

        // Create Supabase Auth user with #User@1234$ and must_change_password=true
        try {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              status: 'active',
              must_change_password: true,
            },
          })

          if (authError || !authData?.user) {
            skippedRecords.push({
              name: rawName,
              mobileNo: normalizedMobile,
              email: u.email || undefined,
              reason: authError?.message || 'Failed to create auth user'
            })
            continue
          }

          // Insert into profiles
          try {
            await ctx.db.insert(profiles).values({
              id: authData.user.id,
              tenant_id: tenantId,
              email: normalizedEmail,
              first_name: firstName,
              middle_name: '',
              last_name: lastName,
              full_name: fullName,
              mobile_no: normalizedMobile,
              date_of_birth: u.dateOfBirth && u.dateOfBirth.trim() ? u.dateOfBirth.trim() : null,
              sex: u.sex,
              role: u.role,
              department_id: u.departmentId || null,
              designation_id: u.designationId || null,
              avatar_url: getDefaultAvatarUrl(u.sex),
              status: 'active',
              must_change_password: true,
            })

            existingMobileSet.add(normalizedMobile)
            if (hasEmail) existingEmailSet.add(normalizedEmail)

            createdCount++
            createdUsers.push({
              id: authData.user.id,
              name: fullName,
              email: normalizedEmail,
              mobileNo: normalizedMobile,
            })
          } catch (dbErr: any) {
            // Rollback auth user
            try {
              await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            } catch (delErr) {
              console.error('[BulkCreateUsers] Rollback auth error:', delErr)
            }
            skippedRecords.push({
              name: rawName,
              mobileNo: normalizedMobile,
              email: u.email || undefined,
              reason: dbErr?.message || 'Database profile insertion failed'
            })
          }
        } catch (err: any) {
          skippedRecords.push({
            name: rawName,
            mobileNo: normalizedMobile,
            email: u.email || undefined,
            reason: err?.message || 'Unexpected error'
          })
        }
      }

      // Log bulk creation activity
      if (createdCount > 0) {
        await ctx.db.insert(activities).values({
          user_id: ctx.profile.id,
          activity_type: 'data_create',
          module: 'users',
          description: `Bulk imported ${createdCount} users with default password (#User@1234$) and first-time password reset enabled`,
          metadata: {
            created_count: createdCount,
            skipped_count: skippedRecords.length,
          }
        })
      }

      return {
        successCount: createdCount,
        skippedCount: skippedRecords.length,
        skippedRecords,
        createdUsers,
      }
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

      // 1. Get the user's profile to find the auth user_id using Drizzle
      const profile = await ctx.db.query.profiles.findFirst({
        where: and(eq(profiles.tenant_id, tenantId), eq(profiles.id, input.userId)),
        columns: { id: true, email: true }
      })

      if (!profile || !profile.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User profile not found',
        })
      }

      // 2. Update the password in Supabase Auth using dedicated admin client
      const supabaseAdmin = createSupabaseAdminClient()
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password: input.password }
      )

      if (authError) throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Failed to reset password: ${authError.message}`,
      })

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
