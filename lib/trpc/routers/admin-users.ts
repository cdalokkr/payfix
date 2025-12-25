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
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      let query = ctx.supabase
        .from('profiles')
        .select('*, designation:designations(*)', { count: 'exact' })
        .neq('id', ctx.profile.id)

      if (input.status !== 'all') {
        query = query.eq('status', input.status)
      } else {
        query = query.neq('status', 'deleted')
      }

      if (input.search) {
        query = query.or(`email.ilike.%${input.search}%,full_name.ilike.%${input.search}%`)
      }

      if (input.role !== 'all') {
        query = query.eq('role', input.role)
      }

      if (input.getAll) {
        // Fetch all users without pagination
        const { data, count } = await query.order('created_at', { ascending: false })

        // Flatten designation
        const processedUsers = data?.map(user => {
          if (user.designation && Array.isArray(user.designation)) {
            return { ...user, designation: user.designation[0] || null }
          }
          return user
        })

        return {
          users: processedUsers || [],
          total: count || 0,
          pages: 1, // Single page when getting all
        }
      } else {
        // Paginated fetching
        const { data, count } = await query
          .order('created_at', { ascending: false })
          .range((input.page - 1) * input.limit, input.page * input.limit - 1)

        // Flatten designation
        const processedUsers = data?.map(user => {
          if (user.designation && Array.isArray(user.designation)) {
            return { ...user, designation: user.designation[0] || null }
          }
          return user
        })

        return {
          users: processedUsers || [],
          total: count || 0,
          pages: Math.ceil((count || 0) / input.limit),
        }
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
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      const { data, error } = await ctx.supabase
        .from('profiles')
        .update({ role: input.role })
        .eq('id', input.userId)
        .select()
        .single()

      if (error) throw new Error(error.message)

      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || ctx.user.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: input.userId, // Fallback
          module: 'users',
          changedFields: [{ name: 'Role', value: input.role }]
        }),
        metadata: { target_user_id: input.userId, changed_fields: ['role'] },
      })

      // Invalidate session cache to reflect role change immediately
      if (data?.user_id) {
        invalidateUserSession(data.user_id)
      }

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
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Get current status for history tracking
      const { data: currentProfile } = await ctx.supabase
        .from('profiles')
        .select('status, user_id, email')
        .eq('id', input.userId)
        .single()

      if (!currentProfile) {
        throw new Error('User not found')
      }

      if (currentProfile.status === input.status) {
        return currentProfile
      }

      // Update status
      const { data, error } = await ctx.supabase
        .from('profiles')
        .update({ status: input.status })
        .eq('id', input.userId)
        .select()
        .single()

      if (error) throw new Error(error.message)

      // Record in history table with both Auth UIDs and Profile IDs for compatibility
      await ctx.supabase.from('user_status_history').insert({
        profile_id: input.userId, // This is the UUID from profiles.id
        target_user_id: currentProfile.user_id, // Auth UID
        old_status: currentProfile.status,
        new_status: input.status,
        reason: input.reason,
        actor_user_id: ctx.user.id, // Auth UID
        changed_by: ctx.profile.id, // Profile ID
      })

      // Log activity
      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: currentProfile.email,
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
      if (currentProfile.user_id) {
        invalidateUserSession(currentProfile.user_id)
      }

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
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Check if email is already taken by another user
      const { data: existingProfile } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('email', input.email)
        .neq('id', input.userId)
        .single()

      if (existingProfile) {
        throw new Error(`A user with email ${input.email} already exists`)
      }

      // Fetch the target user's current email before update for activity logging
      const { data: targetUser } = await ctx.supabase
        .from('profiles')
        .select('email')
        .eq('id', input.userId)
        .single()

      // Construct full_name from name components
      const constructFullName = (firstName: string, middleName?: string, lastName?: string): string => {
        const parts = [firstName]

        // Add middle name only if it's not empty
        if (middleName && middleName.trim()) {
          parts.push(middleName.trim())
        }

        // Add last name only if it's not empty
        if (lastName && lastName.trim()) {
          parts.push(lastName.trim())
        }

        return parts.filter(Boolean).join(' ')
      }

      const fullName = constructFullName(input.firstName, input.middleName, input.lastName)

      const updateData: Partial<Pick<Profile, 'first_name' | 'middle_name' | 'last_name' | 'email' | 'mobile_no' | 'date_of_birth' | 'sex' | 'role' | 'designation_id' | 'allowed_modules' | 'full_name' | 'updated_at' | 'avatar_url'>> = {
        first_name: input.firstName,
        middle_name: input.middleName ?? '',
        last_name: input.lastName,
        email: input.email,
        mobile_no: input.mobileNo ?? '',
        date_of_birth: input.dateOfBirth ?? '',
        sex: input.sex,
        role: input.role,
        designation_id: input.designationId,
        allowed_modules: input.allowedModules as Module[] | undefined,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      }

      // Fetch current profile data to check for changes and handle conditional updates
      const { data: currentProfile } = await ctx.supabase
        .from('profiles')
        .select('user_id, email, avatar_url, sex, first_name, middle_name, last_name, mobile_no, date_of_birth, role, designation_id')
        .eq('id', input.userId)
        .single()

      // If email is changing, update it in Supabase Auth as well
      if (currentProfile && currentProfile.email !== input.email && currentProfile.user_id) {
        const { error: authUpdateError } = await ctx.supabase.auth.admin.updateUserById(
          currentProfile.user_id,
          { email: input.email, email_confirm: true }
        )

        if (authUpdateError) {
          throw new Error(`Failed to update auth email: ${authUpdateError.message}`)
        }
      }

      if (!currentProfile?.avatar_url || isDefaultAvatar(currentProfile.avatar_url)) {
        updateData.avatar_url = getDefaultAvatarUrl(input.sex)
      }

      const { data, error } = await ctx.supabase
        .from('profiles')
        .update(updateData)
        .eq('id', input.userId)
        .select()
        .single()

      if (error) throw new Error(error.message)

      // Create detailed activity log
      const timestamp = new Date()
      const actorRole = ctx.profile.role || ctx.user.role || 'admin'
      const actorEmail = ctx.user.email || ''
      const targetEmail = targetUser?.email || input.email

      const changedFieldsFriendly: ChangedField[] = []
      const changedFieldsKeys: string[] = []
      if (currentProfile) {
        if (currentProfile.first_name !== input.firstName) { changedFieldsFriendly.push({ name: 'First Name', value: input.firstName }); changedFieldsKeys.push('first_name') }
        if ((currentProfile.middle_name || '') !== (input.middleName ?? '')) { changedFieldsFriendly.push({ name: 'Middle Name', value: input.middleName ?? '' }); changedFieldsKeys.push('middle_name') }
        if (currentProfile.last_name !== input.lastName) { changedFieldsFriendly.push({ name: 'Last Name', value: input.lastName }); changedFieldsKeys.push('last_name') }
        if (currentProfile.email !== input.email) { changedFieldsFriendly.push({ name: 'Email', value: input.email }); changedFieldsKeys.push('email') }
        if ((currentProfile.mobile_no || '') !== (input.mobileNo ?? '')) { changedFieldsFriendly.push({ name: 'Mobile Number', value: input.mobileNo ?? '' }); changedFieldsKeys.push('mobile_no') }
        if ((currentProfile.date_of_birth || '') !== (input.dateOfBirth ?? '')) { changedFieldsFriendly.push({ name: 'Date of Birth', value: input.dateOfBirth ?? '' }); changedFieldsKeys.push('date_of_birth') }
        if (currentProfile.sex !== input.sex) { changedFieldsFriendly.push({ name: 'Sex', value: input.sex }); changedFieldsKeys.push('sex') }
        if (currentProfile.role !== input.role) { changedFieldsFriendly.push({ name: 'Role', value: input.role }); changedFieldsKeys.push('role') }
        if (currentProfile.designation_id !== input.designationId) {
          let designationName = 'None'
          if (input.designationId) {
            const { data: designationData } = await ctx.supabase
              .from('designations')
              .select('name')
              .eq('id', input.designationId)
              .single()
            designationName = designationData?.name || 'Unknown'
          }
          changedFieldsFriendly.push({ name: 'Designation', value: designationName })
          changedFieldsKeys.push('designation_id')
        }
      }

      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole,
          actorEmail,
          targetEmail,
          module: 'users',
          changedFields: changedFieldsFriendly
        }),
        metadata: {
          target_user_id: input.userId,
          target_email: targetEmail,
          actor_role: actorRole,
          actor_email: actorEmail,
          timestamp: timestamp.toISOString(),
          changed_fields: changedFieldsKeys
        },
      })

      // Invalidate session cache to reflect profile changes immediately
      if (data?.user_id) {
        invalidateUserSession(data.user_id)
      }

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
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      const updateData: Partial<Pick<Profile, 'first_name' | 'middle_name' | 'last_name' | 'mobile_no' | 'date_of_birth' | 'sex' | 'updated_at'>> = {}
      if (input.firstName !== undefined) updateData.first_name = input.firstName
      if (input.middleName !== undefined) updateData.middle_name = input.middleName
      if (input.lastName !== undefined) updateData.last_name = input.lastName
      if (input.mobileNo !== undefined) updateData.mobile_no = input.mobileNo
      if (input.dateOfBirth !== undefined) updateData.date_of_birth = input.dateOfBirth
      if (input.sex !== undefined) updateData.sex = input.sex
      updateData.updated_at = new Date().toISOString()

      const { data, error } = await ctx.supabase
        .from('profiles')
        .update(updateData)
        .eq('id', input.userId)
        .select()
        .single()

      if (error) throw new Error(error.message)

      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole: ctx.profile.role || ctx.user.role || 'admin',
          actorEmail: ctx.user.email || '',
          targetEmail: input.userId,
          module: 'users',
          changedFields: Object.keys(updateData).map((k) => {
            const key = k as keyof typeof updateData;
            const value = updateData[key];
            let name = k;
            switch (k) {
              case 'first_name': name = 'First Name'; break;
              case 'middle_name': name = 'Middle Name'; break;
              case 'last_name': name = 'Last Name'; break;
              case 'mobile_no': name = 'Mobile Number'; break;
              case 'date_of_birth': name = 'Date of Birth'; break;
              case 'sex': name = 'Sex'; break;
              default: name = k;
            }
            return { name, value };
          })
        }),
        metadata: { target_user_id: input.userId, changed_fields: Object.keys(updateData) },
      })

      // Invalidate session cache to reflect profile changes immediately
      if (data?.user_id) {
        invalidateUserSession(data.user_id)
      }

      return data
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().uuid(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Fetch the target user's details before deletion for activity logging and history
      const { data: targetUser } = await ctx.supabase
        .from('profiles')
        .select('email, status, user_id')
        .eq('id', input.userId)
        .single()

      if (!targetUser) {
        throw new Error('User not found')
      }

      // Soft delete: update status to 'deleted'
      const { error } = await ctx.supabase
        .from('profiles')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', input.userId)

      if (error) throw new Error(error.message)

      // Record in history table
      await ctx.supabase.from('user_status_history').insert({
        profile_id: input.userId,
        target_user_id: targetUser.user_id,
        old_status: targetUser.status,
        new_status: 'deleted',
        reason: input.reason || 'User profile deleted by admin',
        actor_user_id: ctx.user.id,
        changed_by: ctx.profile.id,
      })

      // Create detailed activity log
      const timestamp = new Date()
      const actorRole = ctx.profile.role || ctx.user.role || 'admin'
      const actorEmail = ctx.user.email || ''
      const targetEmail = targetUser?.email || 'unknown'

      // Log the delete activity
      const { error: activityError } = await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'data_delete',
        module: 'users',
        description: formatActivityDescription({
          action: 'delete',
          actorRole,
          actorEmail,
          targetEmail,
          module: 'users'
        }),
        metadata: {
          deleted_user_id: input.userId,
          deleted_email: targetEmail,
          actor_role: actorRole,
          actor_email: actorEmail,
          timestamp: timestamp.toISOString()
        },
      })

      // Invalidate session cache
      if (targetUser.user_id) {
        invalidateUserSession(targetUser.user_id)
      }

      if (activityError) {
        console.error('[DELETE-USER] Failed to log delete activity:', activityError.message)
      }

      return { success: true }
    }),

  createUser: adminProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Check if user already exists
      const { data: existingProfile } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('email', input.email)
        .single()

      if (existingProfile) {
        throw new Error(`A user with email ${input.email} already exists`)
      }

      // Create auth user
      const { data: authData, error: authError } = await ctx.supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      })

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`)
      }

      // Construct full_name from name components
      const constructFullName = (firstName: string, middleName?: string, lastName?: string): string => {
        const parts = [firstName]

        // Add middle name only if it's not empty
        if (middleName && middleName.trim()) {
          parts.push(middleName.trim())
        }

        // Add last name only if it's not empty
        if (lastName && lastName.trim()) {
          parts.push(lastName.trim())
        }

        return parts.filter(Boolean).join(' ')
      }

      const fullName = constructFullName(input.firstName, input.middleName, input.lastName)

      // Create the profile
      const { data: profileData, error: profileError } = await ctx.supabase
        .from('profiles')
        .insert({
          id: authData.user!.id, // Consistent with seed script and makes ID interchangeable with user_id
          user_id: authData.user!.id,
          email: input.email,
          first_name: input.firstName,
          middle_name: input.middleName,
          last_name: input.lastName,
          full_name: fullName, // Include constructed full_name
          mobile_no: input.mobileNo,
          date_of_birth: input.dateOfBirth,
          sex: input.sex,
          role: input.role,
          designation_id: input.designationId,
          allowed_modules: input.allowedModules,
          avatar_url: getDefaultAvatarUrl(input.sex),
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (profileError) {
        // Rollback: delete the auth user if profile creation fails
        await ctx.supabase.auth.admin.deleteUser(authData.user!.id)
        throw new Error(`Profile creation error: ${profileError.message}`)
      }

      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'data_create',
        module: 'users',
        description: formatActivityDescription({
          action: 'create',
          actorRole: ctx.profile.role || ctx.user.role || 'admin',
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
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Fetch all users with null avatar_url
      const { data: profiles, error: fetchError } = await ctx.supabase
        .from('profiles')
        .select('id, sex, avatar_url')
        .is('avatar_url', null)

      if (fetchError) throw new Error(fetchError.message)

      if (!profiles || profiles.length === 0) {
        return { updated: 0 }
      }

      let updatedCount = 0
      const updates = []

      for (const profile of profiles) {
        const defaultAvatar = getDefaultAvatarUrl(profile.sex)

        updates.push(
          ctx.supabase
            .from('profiles')
            .update({ avatar_url: defaultAvatar })
            .eq('id', profile.id)
        )
        updatedCount++
      }

      await Promise.all(updates)

      return { updated: updatedCount }
    }),

  checkEmailAvailability: adminProcedure
    .input(
      z.object({
        email: z.string().email('Invalid email address'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('email', input.email)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw new Error(`Database error: ${error.message}`)
      }

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
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // Update the avatar_url in the profile
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

      // Log the activity
      const timestamp = new Date()
      const actorRole = ctx.profile.role || ctx.user.role || 'admin'
      const actorEmail = ctx.user.email || ''

      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'profile_update',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole,
          actorEmail,
          targetEmail: data.email,
          module: 'users',
          changedFields: [{ name: 'Profile Picture', value: 'Updated' }]
        }),
        metadata: {
          target_user_id: input.userId,
          updated_field: 'avatar_url',
          actor_role: actorRole,
          actor_email: actorEmail,
          timestamp: timestamp.toISOString()
        },
      })

      // Invalidate session cache to reflect avatar change immediately
      if (data?.user_id) {
        invalidateUserSession(data.user_id)
      }

      return data
    }),


  resetPassword: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.supabase) {
        throw new Error('Supabase client not available')
      }

      // 1. Get the user's profile to find the auth user_id
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('user_id, email')
        .eq('id', input.userId)
        .single()

      if (!profile || !profile.user_id) {
        throw new Error('User profile not found or not linked to auth user')
      }

      // 2. Update the password in Supabase Auth
      const { error: authError } = await ctx.supabase.auth.admin.updateUserById(
        profile.user_id,
        { password: input.password }
      )

      if (authError) {
        throw new Error(`Failed to reset password: ${authError.message}`)
      }

      // 3. Log the activity
      const timestamp = new Date()
      const actorRole = ctx.profile.role || ctx.user.role || 'admin'
      const actorEmail = ctx.user.email || ''

      await ctx.supabase.from('activities').insert({
        user_id: ctx.profile.id,
        activity_type: 'data_edit',
        module: 'users',
        description: formatActivityDescription({
          action: 'update',
          actorRole,
          actorEmail,
          targetEmail: profile.email,
          module: 'users',
          changedFields: [{ name: 'Password', value: 'Reset' }]
        }),
        metadata: {
          target_user_id: input.userId,
          updated_field: 'password',
          actor_role: actorRole,
          actor_email: actorEmail,
          timestamp: timestamp.toISOString()
        },
      })

      // 4. Invalidate session to ensure security (optional but good practice)
      invalidateUserSession(profile.user_id)

      return { success: true }
    }),
})
