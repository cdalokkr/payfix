import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, moderatorProcedure } from '../server'
import { ShiftService } from '@/lib/services/shifts.service'
import { shiftSchema, rosterAllotmentSchema } from '@/lib/validations/auth'
import { getLocalDateIST } from '@/lib/utils/date-utils'

export const shiftsRouter = router({
    getByLocation: protectedProcedure
        .input(z.object({
            locationId: z.string().uuid().optional().nullable(),
            departmentId: z.string().uuid().optional().nullable(),
        }).optional())
        .query(async ({ input }) => {
            return ShiftService.getShiftsByLocation(input?.locationId, input?.departmentId)
        }),

    create: moderatorProcedure
        .input(shiftSchema)
        .mutation(async ({ ctx, input }) => {
            return ShiftService.createShift(input as any, ctx.profile.id)
        }),

    update: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            isActive: z.boolean().optional(),
            ...shiftSchema.shape,
        }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input
            return ShiftService.updateShift(id, data as any, ctx.profile.id)
        }),

    delete: moderatorProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            return ShiftService.deleteShift(input.id, ctx.profile.id)
        }),

    getEmployeeAssignment: protectedProcedure
        .input(z.object({ profileId: z.string().uuid() }))
        .query(async ({ input }) => {
            return ShiftService.getEmployeeShiftAssignment(input.profileId)
        }),

    assignShifts: moderatorProcedure
        .input(z.object({
            profileIds: z.array(z.string().uuid()).min(1),
            locationId: z.string().uuid(),
            dutyHours: z.number().min(1).max(24),
            shiftMode: z.enum(['default', 'single', 'multi', 'rotational']),
            assignedShiftIds: z.array(z.string().uuid()),
            rotationType: z.enum(['none', 'weekly', 'biweekly', 'monthly']).optional(),
            rotationShiftIds: z.array(z.string().uuid()).optional(),
            rotationStartDate: z.string().optional().nullable(),
            effectiveFrom: z.string().optional(),
            effectiveTo: z.string().optional().nullable(),
        }))
        .mutation(async ({ ctx, input }) => {
            return ShiftService.assignEmployeeShifts(input as any, ctx.profile.id)
        }),

    getTodayShift: protectedProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            date: z.string().optional(),
        }).optional())
        .query(async ({ ctx, input }) => {
            const targetId = input?.profileId || ctx.profile.id
            const dateStr = input?.date || getLocalDateIST()
            return ShiftService.getEffectiveShiftForDate(targetId, dateStr)
        }),

    allotRoster: moderatorProcedure
        .input(rosterAllotmentSchema)
        .mutation(async ({ ctx, input }) => {
            return ShiftService.allotRoster(input as any, ctx.profile.id)
        }),

    markRosterAbsent: moderatorProcedure
        .input(z.object({
            rosterId: z.string().uuid().optional(),
            profileId: z.string().uuid().optional(),
            date: z.string().optional(),
            reason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            return ShiftService.markRosterAbsent({
                rosterId: input.rosterId,
                profileId: input.profileId,
                date: input.date,
                reason: input.reason,
                actorId: ctx.profile.id,
            })
        }),

    callInExtraShift: moderatorProcedure
        .input(z.object({
            profileId: z.string().uuid(),
            departmentId: z.string().uuid().optional().nullable(),
            shiftId: z.string().uuid(),
            date: z.string().min(8),
            extraShiftType: z.enum(['full', 'half']).optional(),
            reason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            return ShiftService.callInExtraShift({
                profileId: input.profileId,
                departmentId: input.departmentId,
                shiftId: input.shiftId,
                date: input.date,
                extraShiftType: input.extraShiftType,
                reason: input.reason,
                actorId: ctx.profile.id,
            })
        }),

    getRosterGrid: protectedProcedure
        .input(z.object({
            departmentId: z.string().uuid().optional().nullable(),
            startDate: z.string().min(8),
            endDate: z.string().min(8),
        }))
        .query(async ({ input }) => {
            return ShiftService.getDepartmentRosterGrid({
                departmentId: input.departmentId,
                startDate: input.startDate,
                endDate: input.endDate,
            })
        }),

    // Aliases for seamless client usage
    getShifts: protectedProcedure
        .input(z.object({
            locationId: z.string().uuid().optional().nullable(),
            departmentId: z.string().uuid().optional().nullable(),
        }).optional())
        .query(async ({ input }) => {
            return ShiftService.getShiftsByLocation(input?.locationId, input?.departmentId)
        }),

    createShift: moderatorProcedure
        .input(shiftSchema)
        .mutation(async ({ ctx, input }) => {
            return ShiftService.createShift(input as any, ctx.profile.id)
        }),

    updateShift: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            isActive: z.boolean().optional(),
            ...shiftSchema.shape,
        }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input
            return ShiftService.updateShift(id, data as any, ctx.profile.id)
        }),

    deleteShift: moderatorProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            return ShiftService.deleteShift(input.id, ctx.profile.id)
        }),

    getEmployeeAssignments: protectedProcedure
        .input(z.object({ userId: z.string().uuid() }))
        .query(async ({ input }) => {
            return ShiftService.getEmployeeShiftAssignment(input.userId)
        }),

    assignEmployeeShifts: moderatorProcedure
        .input(z.object({
            userId: z.string().uuid(),
            locationId: z.string().uuid().optional(),
            totalDutyHours: z.number().min(1).max(24),
            shiftIds: z.array(z.string().uuid()),
            rotationCycle: z.enum(['none', 'weekly', 'biweekly', 'monthly']).optional(),
            rotationShiftIds: z.array(z.string().uuid()).optional(),
            effectiveFrom: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            return ShiftService.assignEmployeeShifts({
                profileIds: [input.userId],
                locationId: input.locationId || '00000000-0000-0000-0000-000000000000',
                dutyHours: input.totalDutyHours,
                shiftMode: input.shiftIds.length > 1 ? 'multi' : 'single',
                assignedShiftIds: input.shiftIds,
                rotationType: input.rotationCycle || 'none',
                rotationShiftIds: input.rotationShiftIds,
                effectiveFrom: input.effectiveFrom,
            }, ctx.profile.id)
        }),

    getDepartmentRosterGrid: protectedProcedure
        .input(z.object({
            departmentId: z.string().uuid().optional().nullable(),
            startDate: z.string().min(8),
            endDate: z.string().min(8),
        }))
        .query(async ({ input }) => {
            return ShiftService.getDepartmentRosterGrid({
                departmentId: input.departmentId,
                startDate: input.startDate,
                endDate: input.endDate,
            })
        }),
})
