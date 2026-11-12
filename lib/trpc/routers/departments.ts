import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, moderatorProcedure } from '../server'
import { DepartmentService } from '@/lib/services/departments.service'
import { departmentSchema } from '@/lib/validations/auth'
import { departments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const departmentsRouter = router({
    getAll: protectedProcedure
        .input(z.object({
            locationId: z.string().uuid().optional().nullable()
        }).optional())
        .query(async ({ input }) => {
            return DepartmentService.getAll(input?.locationId)
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
            return DepartmentService.getById(input.id)
        }),

    create: adminProcedure
        .input(departmentSchema)
        .mutation(async ({ ctx, input }) => {
            return DepartmentService.create(input as any, ctx.profile.id)
        }),

    update: adminProcedure
        .input(z.object({
            id: z.string().uuid(),
            isActive: z.boolean().optional(),
            ...departmentSchema.partial().shape,
        }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input
            return DepartmentService.update(id, data as any, ctx.profile.id)
        }),

    delete: adminProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            return DepartmentService.delete(input.id, ctx.profile.id)
        }),

    getMembers: protectedProcedure
        .input(z.object({ departmentId: z.string().uuid() }))
        .query(async ({ input }) => {
            return DepartmentService.getDepartmentMembers(input.departmentId)
        }),

    getManagerHistory: protectedProcedure
        .input(z.object({ departmentId: z.string().uuid() }))
        .query(async ({ input }) => {
            return DepartmentService.getManagerHistory(input.departmentId)
        }),

    getDepartmentAuditLogs: protectedProcedure
        .input(z.object({
            departmentId: z.string().uuid(),
            managerId: z.string().uuid().optional(),
        }))
        .query(async ({ input }) => {
            return DepartmentService.getDepartmentAuditLogs(input.departmentId, input.managerId)
        }),

    getMyManagedDepartment: protectedProcedure
        .query(async ({ ctx }) => {
            await DepartmentService.ensureSchema()
            // Find department where this user is the manager
            const managed = await ctx.db.query.departments.findFirst({
                where: eq(departments.manager_id, ctx.profile.id),
                with: {
                    location: true,
                    designations: true,
                }
            })
            return managed || null
        }),
})
