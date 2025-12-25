import { z } from 'zod'
import { adminProcedure, router } from '../server'
import { TRPCError } from '@trpc/server'
import { designationSchema } from '@/lib/validations/auth'
import { formatActivityDescription, ChangedField } from '@/lib/utils/activity-logger'

export const designationRouter = router({
    getDesignations: adminProcedure.query(async ({ ctx }) => {
        if (!ctx.supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase client not initialized' })
        const { data, error } = await ctx.supabase
            .from('designations')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch designations',
                cause: error,
            })
        }

        return data
    }),

    createDesignation: adminProcedure
        .input(designationSchema)
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase client not initialized' })
            const { data, error } = await ctx.supabase
                .from('designations')
                .insert({
                    name: input.name,
                    description: input.description,
                    role: input.role,
                })
                .select()
                .single()

            if (error) {
                if (error.code === '23505') {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'Designation with this name already exists',
                    })
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to create designation',
                    cause: error,
                })
            }

            // Log activity
            await ctx.supabase.from('activities').insert({
                user_id: ctx.profile.id,
                activity_type: 'data_create',
                module: 'designations',
                description: formatActivityDescription({
                    action: 'create',
                    actorRole: ctx.profile.role || 'admin',
                    actorEmail: ctx.user.email || '',
                    targetEmail: input.name,
                    entityName: 'designation',
                    module: 'designations'
                }),
                metadata: {
                    designation_id: data.id,
                    name: input.name,
                    role: input.role
                },
            })

            return data
        }),

    updateDesignation: adminProcedure
        .input(z.object({
            id: z.string().uuid(),
            ...designationSchema.shape,
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase client not initialized' })

            // Get current data for activity logging
            const { data: currentData } = await ctx.supabase
                .from('designations')
                .select('*')
                .eq('id', input.id)
                .single()

            const { data, error } = await ctx.supabase
                .from('designations')
                .update({
                    name: input.name,
                    description: input.description,
                    role: input.role,
                })
                .eq('id', input.id)
                .select()
                .single()

            if (error) {
                if (error.code === '23505') {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'Designation with this name already exists',
                    })
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to update designation',
                    cause: error,
                })
            }

            // Log activity
            if (currentData) {
                const changedFields: ChangedField[] = []
                if (currentData.name !== input.name) changedFields.push({ name: 'Name', value: input.name })
                if (currentData.description !== input.description) changedFields.push({ name: 'Description', value: input.description || 'None' })
                if (currentData.role !== input.role) changedFields.push({ name: 'Role', value: input.role })

                if (changedFields.length > 0) {
                    await ctx.supabase.from('activities').insert({
                        user_id: ctx.profile.id,
                        activity_type: 'data_edit',
                        module: 'designations',
                        description: formatActivityDescription({
                            action: 'update',
                            actorRole: ctx.profile.role || 'admin',
                            actorEmail: ctx.user.email || '',
                            targetEmail: input.name,
                            entityName: 'designation',
                            module: 'designations',
                            changedFields
                        }),
                        metadata: {
                            designation_id: input.id,
                            changed_fields: changedFields.map(f => {
                                if (typeof f === 'string') return f.toLowerCase()
                                return f.name.toLowerCase()
                            })
                        },
                    })
                }
            }

            return data
        }),

    deleteDesignation: adminProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase client not initialized' })

            // Get current data before deletion
            const { data: currentData } = await ctx.supabase
                .from('designations')
                .select('name')
                .eq('id', input.id)
                .single()

            // Check if any users are assigned to this designation
            const { count, error: countError } = await ctx.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('designation_id', input.id)

            if (countError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to check designation usage',
                    cause: countError,
                })
            }

            if (count && count > 0) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: `Cannot delete designation because it is assigned to ${count} user(s)`,
                })
            }

            const { error } = await ctx.supabase
                .from('designations')
                .delete()
                .eq('id', input.id)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to delete designation',
                    cause: error,
                })
            }

            // Log activity
            if (currentData) {
                await ctx.supabase.from('activities').insert({
                    user_id: ctx.profile.id,
                    activity_type: 'data_delete',
                    module: 'designations',
                    description: formatActivityDescription({
                        action: 'delete',
                        actorRole: ctx.profile.role || 'admin',
                        actorEmail: ctx.user.email || '',
                        targetEmail: currentData.name,
                        entityName: 'designation',
                        module: 'designations'
                    }),
                    metadata: {
                        designation_id: input.id,
                        name: currentData.name
                    },
                })
            }

            return { success: true }
        }),
})

