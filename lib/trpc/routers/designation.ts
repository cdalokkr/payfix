import { z } from 'zod'
import { adminProcedure, router } from '../server'
import { TRPCError } from '@trpc/server'
import { designations, profiles, activities } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { designationSchema } from '@/lib/validations/auth'
import { formatActivityDescription, ChangedField } from '@/lib/utils/activity-logger'
import { invalidateDashboardCache } from './admin-dashboard-optimized'
import { SmartCache } from '@/lib/cache/smart-cache'

export const designationRouter = router({
    getDesignations: adminProcedure.query(async () => {
        const data = await SmartCache.getDesignationsCached()
        return (data || []).map(d => ({
            ...d,
            created_at: d.created_at ? d.created_at.toISOString() : null,
            updated_at: d.updated_at ? d.updated_at.toISOString() : null,
            role: d.role as any,
        }))
    }),

    createDesignation: adminProcedure
        .input(designationSchema)
        .mutation(async ({ ctx, input }) => {
            const [data] = await ctx.db.insert(designations)
                .values({
                    name: input.name,
                    description: input.description,
                    role: input.role,
                })
                .returning()

            if (!data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create designation' })
            // Log activity
            await ctx.db.insert(activities).values({
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

            // Invalidate dashboard cache to ensure fresh activity data
            invalidateDashboardCache()
            // Invalidate designations cache namespace
            SmartCache.invalidateDesignations()

            return {
                ...data,
                created_at: data.created_at ? data.created_at.toISOString() : null,
                updated_at: data.updated_at ? data.updated_at.toISOString() : null,
                role: data.role as any,
            } as any
        }),

    updateDesignation: adminProcedure
        .input(z.object({
            id: z.string().uuid(),
            ...designationSchema.shape,
        }))
        .mutation(async ({ ctx, input }) => {
            const currentData = await ctx.db.query.designations.findFirst({
                where: eq(designations.id, input.id)
            })

            const [data] = await ctx.db.update(designations)
                .set({
                    name: input.name,
                    description: input.description,
                    role: input.role,
                })
                .where(eq(designations.id, input.id))
                .returning()

            if (currentData) {
                const changedFields: ChangedField[] = []
                if (currentData.name !== input.name) changedFields.push({ name: 'Name', value: input.name })
                if (currentData.description !== input.description) changedFields.push({ name: 'Description', value: input.description || 'None' })
                if (currentData.role !== input.role) changedFields.push({ name: 'Role', value: input.role })

                if (changedFields.length > 0) {
                    await ctx.db.insert(activities).values({
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

                // Invalidate dashboard cache to ensure fresh activity data
                invalidateDashboardCache()
            }

            // Invalidate designations cache namespace
            SmartCache.invalidateDesignations()

            return {
                ...data,
                created_at: data.created_at ? data.created_at.toISOString() : null,
                updated_at: data.updated_at ? data.updated_at.toISOString() : null,
                role: data.role as any,
            } as any
        }),

    deleteDesignation: adminProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const [currentData, usageCheck] = await Promise.all([
                ctx.db.query.designations.findFirst({
                    where: eq(designations.id, input.id),
                    columns: { name: true }
                }),
                ctx.db.select({ value: count() })
                    .from(profiles)
                    .where(eq(profiles.designation_id, input.id))
            ])

            const usageCount = usageCheck[0].value

            if (usageCount > 0) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: `Cannot delete designation because it is assigned to ${usageCount} user(s)`,
                })
            }

            await ctx.db.delete(designations).where(eq(designations.id, input.id))

            // Log activity
            if (currentData) {
                await ctx.db.insert(activities).values({
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

                // Invalidate dashboard cache to ensure fresh activity data
                invalidateDashboardCache()
            }

            // Invalidate designations cache namespace
            SmartCache.invalidateDesignations()

            return { success: true }
        }),
})

