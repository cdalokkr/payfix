// ============================================
// lib/trpc/routers/salary.ts
// ============================================
import { z } from 'zod'
import { router, adminProcedure, moderatorProcedure, protectedProcedure } from '../server'
import { SalaryService } from '@/lib/services/salary.service'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq, and, or, inArray } from 'drizzle-orm'

export const salaryRouter = router({

    // ==========================================
    // EMPLOYEE LIST BY ROLE (for dropdowns)
    // ==========================================

    getEmployeesByRole: moderatorProcedure
        .input(z.object({
            roleGroup: z.enum(['staff', 'employee']),
        }))
        .query(async ({ input }) => {
            const roleFilter = input.roleGroup === 'staff'
                ? or(eq(profiles.role, 'admin'), eq(profiles.role, 'moderator'))
                : eq(profiles.role, 'employee')

            const employees = await db.query.profiles.findMany({
                where: and(
                    eq(profiles.status, 'active'),
                    roleFilter
                ),
                columns: {
                    id: true,
                    full_name: true,
                    email: true,
                    mobile_no: true,
                    role: true,
                    avatar_url: true,
                },
                with: {
                    designation: {
                        columns: { name: true }
                    }
                },
                orderBy: [profiles.full_name],
            })

            return employees.map(e => ({
                id: e.id,
                full_name: e.full_name,
                email: e.email,
                mobile_no: e.mobile_no,
                role: e.role,
                avatar_url: e.avatar_url,
                designation_name: e.designation?.name || null,
            }))
        }),

    // ==========================================
    // SALARY SETUP (admin-only for creating/updating)
    // ==========================================

    upsertSalarySetup: adminProcedure
        .input(z.object({
            profileId: z.string().uuid(),
            basicSalary: z.string(),
            hra: z.string(),
            da: z.string(),
            ta: z.string(),
            specialAllowance: z.string(),
            incentive: z.string(),
            otherDeductions: z.string(),
            deductionRemark: z.string().optional(),
            effectiveFromMonth: z.number().min(1).max(12),
            effectiveFromYear: z.number().min(2020).max(2100),
            changeReason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            return await SalaryService.upsertSalarySetup({
                ...input,
                createdBy: ctx.profile.id,
            })
        }),

    getSalarySetups: moderatorProcedure
        .query(async () => {
            return await SalaryService.getSalarySetups()
        }),

    getSalaryHistory: moderatorProcedure
        .input(z.object({
            profileId: z.string().uuid(),
        }))
        .query(async ({ input }) => {
            return await SalaryService.getSalaryHistory(input.profileId)
        }),

    // ==========================================
    // ADVANCES / LOANS
    // ==========================================

    addAdvance: moderatorProcedure
        .input(z.object({
            profileId: z.string().uuid(),
            date: z.string(),
            amount: z.string(),
            particulars: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            return await SalaryService.addAdvance({
                ...input,
                createdBy: ctx.profile.id,
            })
        }),

    updateAdvance: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
            date: z.string().optional(),
            amount: z.string().optional(),
            particulars: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            return await SalaryService.updateAdvance(input)
        }),

    getAdvances: moderatorProcedure
        .input(z.object({
            profileId: z.string().uuid().optional(),
            month: z.number().min(1).max(12).optional(),
            year: z.number().optional(),
            status: z.enum(['pending', 'adjusted']).optional(),
            page: z.number().optional(),
            limit: z.number().optional(),
            sortBy: z.enum(['date', 'employee']).optional(),
            sortOrder: z.enum(['asc', 'desc']).optional(),
        }).optional())
        .query(async ({ input }) => {
            return await SalaryService.getAdvances(input || undefined)
        }),

    getMyAdvances: protectedProcedure
        .input(z.object({
            month: z.number().min(1).max(12).optional(),
            year: z.number().optional(),
        }).optional())
        .query(async ({ ctx, input }) => {
            return await SalaryService.getAdvances({
                profileId: ctx.profile.id,
                month: input?.month,
                year: input?.year,
                sortBy: 'date',
                sortOrder: 'desc',
            })
        }),

    deleteAdvance: moderatorProcedure
        .input(z.object({
            id: z.string().uuid(),
        }))
        .mutation(async ({ input }) => {
            return await SalaryService.deleteAdvance(input.id)
        }),

    // ==========================================
    // MONTHLY ATTENDANCE COMPILATION
    // ==========================================

    compileMonthlyAttendance: moderatorProcedure
        .input(z.object({
            month: z.number().min(1).max(12),
            year: z.number().min(2020).max(2100),
            profileId: z.string().uuid().optional(),
        }))
        .mutation(async ({ input }) => {
            return await SalaryService.compileMonthlyAttendance(input.month, input.year, input.profileId)
        }),

    getActiveEmployeesForCompilation: moderatorProcedure
        .query(async () => {
            return await db.query.profiles.findMany({
                where: eq(profiles.status, 'active'),
                columns: { id: true, full_name: true, email: true },
                orderBy: [profiles.full_name]
            })
        }),

    getMonthlySummaries: moderatorProcedure
        .input(z.object({
            month: z.number().min(1).max(12),
            year: z.number().min(2020).max(2100),
        }))
        .query(async ({ input }) => {
            return await SalaryService.getMonthlySummaries(input.month, input.year)
        }),

    // ==========================================
    // SET FOR SALARY
    // ==========================================

    setForSalary: moderatorProcedure
        .input(z.object({
            ids: z.array(z.string().uuid()),
        }))
        .mutation(async ({ ctx, input }) => {
            return await SalaryService.setForSalary(input.ids, ctx.profile.id)
        }),

    // ==========================================
    // PAYSLIP GENERATION
    // ==========================================

    generatePayslips: moderatorProcedure
        .input(z.object({
            ids: z.array(z.string().uuid()),
        }))
        .mutation(async ({ input }) => {
            return await SalaryService.generatePayslips(input.ids)
        }),

    getPayslipDetail: moderatorProcedure
        .input(z.object({
            summaryId: z.string().uuid(),
        }))
        .query(async ({ input }) => {
            return await SalaryService.getPayslipDetail(input.summaryId)
        }),

    // ==========================================
    // EMPLOYEE SELF-SERVICE PAYSLIP
    // ==========================================

    getMyPayslips: protectedProcedure
        .input(z.object({
            month: z.number().min(1).max(12),
            year: z.number().min(2020).max(2100),
        }))
        .query(async ({ ctx, input }) => {
            return await SalaryService.getMyPayslips(ctx.profile.id, input.month, input.year)
        }),

    getMyPayslipDetail: protectedProcedure
        .input(z.object({
            summaryId: z.string().uuid(),
        }))
        .query(async ({ ctx, input }) => {
            return await SalaryService.getMyPayslipDetail(input.summaryId, ctx.profile.id)
        }),

    markSalaryPaid: moderatorProcedure
        .input(z.object({
            summaryId: z.string().uuid(),
            paidMode: z.string(),
            payDate: z.string(),
            payReferenceNo: z.string().optional(),
            paymentRemarks: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            return await SalaryService.markSalaryPaid({
                ...input,
                paidBy: ctx.profile.id,
            })
        }),
})
