import { db } from '@/lib/db'
import {
    employeeSalarySetup,
    employeeAdvances,
    monthlyAttendanceSummary,
    attendance,
    leaves,
    profiles,
    officeSettings,
    officeClosures
} from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray, or, ne } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export class SalaryService {

    // ==========================================
    // SALARY SETUP
    // ==========================================

    /** Create or update salary setup — deactivates previous active record */
    static async upsertSalarySetup({
        profileId,
        basicSalary,
        hra,
        da,
        ta,
        specialAllowance,
        incentive,
        otherDeductions,
        effectiveFromMonth,
        effectiveFromYear,
        changeReason,
        createdBy,
    }: {
        profileId: string
        basicSalary: string
        hra: string
        da: string
        ta: string
        specialAllowance: string
        incentive: string
        otherDeductions: string
        effectiveFromMonth: number
        effectiveFromYear: number
        changeReason?: string
        createdBy: string
    }) {
        // Deactivate current active record and set its effective_to
        const currentActive = await db.query.employeeSalarySetup.findFirst({
            where: and(
                eq(employeeSalarySetup.profile_id, profileId),
                eq(employeeSalarySetup.is_active, true)
            )
        })

        if (currentActive) {
            // Calculate previous month for the effective_to
            let toMonth = effectiveFromMonth - 1
            let toYear = effectiveFromYear
            if (toMonth < 1) {
                toMonth = 12
                toYear -= 1
            }

            await db.update(employeeSalarySetup).set({
                is_active: false,
                effective_to_month: toMonth,
                effective_to_year: toYear,
                updated_at: new Date(),
            }).where(eq(employeeSalarySetup.id, currentActive.id))
        }

        // Insert new active record
        const [newSetup] = await db.insert(employeeSalarySetup).values({
            profile_id: profileId,
            basic_salary: basicSalary,
            hra,
            da,
            ta,
            special_allowance: specialAllowance,
            incentive,
            other_deductions: otherDeductions,
            effective_from_month: effectiveFromMonth,
            effective_from_year: effectiveFromYear,
            change_reason: changeReason || 'Initial Setup',
            is_active: true,
            created_by: createdBy,
        }).returning()

        return newSetup
    }

    /** Get all employees with their active salary setup */
    static async getSalarySetups() {
        const allProfiles = await db.query.profiles.findMany({
            where: eq(profiles.status, 'active'),
            columns: {
                id: true,
                full_name: true,
                email: true,
            }
        })

        const activeSetups = await db.query.employeeSalarySetup.findMany({
            where: eq(employeeSalarySetup.is_active, true),
        })

        const setupMap = new Map(activeSetups.map(s => [s.profile_id, s]))

        return allProfiles.map(p => ({
            ...p,
            salary_setup: setupMap.get(p.id) || null,
        }))
    }

    /** Get salary history for an employee */
    static async getSalaryHistory(profileId: string) {
        return await db.query.employeeSalarySetup.findMany({
            where: eq(employeeSalarySetup.profile_id, profileId),
            orderBy: [desc(employeeSalarySetup.created_at)],
        })
    }

    /** Get applicable salary for a specific month/year */
    static async getActiveSalaryForPeriod(profileId: string, month: number, year: number) {
        // Find the salary record that covers this period
        // Active record where effective_from <= target period AND (effective_to is null OR effective_to >= target period)
        const setups = await db.query.employeeSalarySetup.findMany({
            where: eq(employeeSalarySetup.profile_id, profileId),
            orderBy: [desc(employeeSalarySetup.effective_from_year), desc(employeeSalarySetup.effective_from_month)],
        })

        for (const setup of setups) {
            const fromVal = setup.effective_from_year * 100 + setup.effective_from_month
            const targetVal = year * 100 + month

            if (fromVal > targetVal) continue

            if (!setup.effective_to_month || !setup.effective_to_year) {
                return setup // ongoing
            }

            const toVal = setup.effective_to_year * 100 + setup.effective_to_month
            if (targetVal <= toVal) {
                return setup
            }
        }

        return null
    }

    // ==========================================
    // ADVANCES / LOANS
    // ==========================================

    /** Add a new advance record */
    static async addAdvance({
        profileId,
        date,
        amount,
        particulars,
        createdBy,
    }: {
        profileId: string
        date: string
        amount: string
        particulars: string
        createdBy: string
    }) {
        const [advance] = await db.insert(employeeAdvances).values({
            profile_id: profileId,
            date,
            amount,
            particulars,
            status: 'pending',
            created_by: createdBy,
        }).returning()

        return advance
    }

    /** Get advances with optional filters, pagination, and sorting */
    static async getAdvances(filters?: {
        profileId?: string
        month?: number
        year?: number
        status?: 'pending' | 'adjusted'
        page?: number
        limit?: number
        sortBy?: 'date' | 'employee'
        sortOrder?: 'asc' | 'desc'
    }) {
        let conditions: any[] = []

        if (filters?.profileId) {
            conditions.push(eq(employeeAdvances.profile_id, filters.profileId))
        }
        if (filters?.status) {
            conditions.push(eq(employeeAdvances.status, filters.status))
        }
        if (filters?.month && filters?.year) {
            // Filter by date within the month
            const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
            const lastDay = new Date(filters.year, filters.month, 0).getDate()
            const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-${lastDay}`
            conditions.push(gte(employeeAdvances.date, startDate))
            conditions.push(lte(employeeAdvances.date, endDate))
        }

        const page = filters?.page || 1
        const limit = filters?.limit || 10
        const offset = (page - 1) * limit

        // Determine sorting
        let orderByClause = [desc(employeeAdvances.date)]
        if (filters?.sortBy === 'employee') {
            // Sort by employee name - requires join logic or handled by ORM if supported directly
            // Drizzle 'with' sorting can be tricky, defaulting to date for now if complex
            // Awaiting complex sort implementation, defaulting to Date desc
            orderByClause = filters.sortOrder === 'asc' ? [desc(employeeAdvances.date)] : [desc(employeeAdvances.date)]
        } else if (filters?.sortBy === 'date') {
            orderByClause = filters.sortOrder === 'asc' ? [sql`${employeeAdvances.date} ASC`] : [desc(employeeAdvances.date)]
        }

        // Get total count for pagination
        const totalCountResult = await db.select({ count: sql<number>`count(*)` })
            .from(employeeAdvances)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
        const total = Number(totalCountResult[0]?.count || 0)

        const advances = await db.query.employeeAdvances.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            with: {
                profile: {
                    columns: { full_name: true, email: true, avatar_url: true, role: true },
                    with: {
                        designation: {
                            columns: { name: true }
                        }
                    }
                }
            },
            orderBy: orderByClause,
            limit,
            offset,
        })

        return {
            advances: advances.map(a => ({
                ...a,
                employeeName: a.profile.full_name,
                designation: a.profile?.designation?.name || 'N/A'
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    }

    /** Update an advance record */
    static async updateAdvance({
        id,
        date,
        amount,
        particulars,
    }: {
        id: string
        date?: string
        amount?: string
        particulars?: string
    }) {
        const advance = await db.query.employeeAdvances.findFirst({
            where: eq(employeeAdvances.id, id)
        })

        if (!advance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Advance not found' })
        if (advance.status === 'adjusted') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot update an adjusted advance' })
        }

        const [updated] = await db.update(employeeAdvances).set({
            ...(date ? { date } : {}),
            ...(amount ? { amount } : {}),
            ...(particulars ? { particulars } : {}),
        }).where(eq(employeeAdvances.id, id)).returning()

        return updated
    }

    /** Get sum of pending advances for an employee */
    static async getPendingAdvancesTotal(profileId: string) {
        const result = await db.select({
            total: sql<string>`COALESCE(SUM(${employeeAdvances.amount}::numeric), 0)`,
        }).from(employeeAdvances).where(and(
            eq(employeeAdvances.profile_id, profileId),
            eq(employeeAdvances.status, 'pending')
        ))

        return result[0]?.total || '0'
    }

    /** Delete a pending advance */
    static async deleteAdvance(id: string) {
        const advance = await db.query.employeeAdvances.findFirst({
            where: eq(employeeAdvances.id, id)
        })

        if (!advance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Advance not found' })
        if (advance.status === 'adjusted') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete an adjusted advance' })
        }

        await db.delete(employeeAdvances).where(eq(employeeAdvances.id, id))
        return { success: true }
    }

    // ==========================================
    // MONTHLY ATTENDANCE COMPILATION
    // ==========================================

    /** Compile monthly attendance for all employees */
    static async compileMonthlyAttendance(month: number, year: number) {
        // Get all active employees
        const employees = await db.query.profiles.findMany({
            where: eq(profiles.status, 'active'),
            columns: { id: true, full_name: true, email: true }
        })

        // Get office settings for working hours calculation
        const settings = await db.query.officeSettings.findFirst()
        const defaultCheckIn = settings?.default_check_in || '10:00:00'
        const defaultCheckOut = settings?.default_check_out || '19:00:00'
        const offDays = (settings?.off_days as number[] | null) || [0] // Default Sunday off

        // Calculate scheduled hours per day
        const [inH, inM] = defaultCheckIn.split(':').map(Number)
        const [outH, outM] = defaultCheckOut.split(':').map(Number)
        const scheduledHoursPerDay = ((outH * 60 + outM) - (inH * 60 + inM)) / 60

        // Get office closures for the month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

        const closures = await db.query.officeClosures.findMany({
            where: and(
                gte(officeClosures.date, startDate),
                lte(officeClosures.date, endDate)
            )
        })
        const closureDates = new Set(closures.map(c => c.date))

        // Calculate total working days in the month
        let totalWorkingDays = 0
        for (let d = 1; d <= lastDay; d++) {
            const dateObj = new Date(year, month - 1, d)
            const dayOfWeek = dateObj.getDay()
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            if (!offDays.includes(dayOfWeek) && !closureDates.has(dateStr)) {
                totalWorkingDays++
            }
        }

        const results = []

        for (const employee of employees) {
            // Get attendance records for the month
            const records = await db.query.attendance.findMany({
                where: and(
                    eq(attendance.profile_id, employee.id),
                    gte(attendance.date, startDate),
                    lte(attendance.date, endDate)
                )
            })

            // Get approved leaves for the month
            const employeeLeaves = await db.query.leaves.findMany({
                where: and(
                    eq(leaves.profile_id, employee.id),
                    eq(leaves.status, 'approved'),
                    lte(leaves.start_date, endDate),
                    gte(leaves.end_date, startDate)
                )
            })

            // Count leave days within this month
            let leaveDays = 0
            for (const leave of employeeLeaves) {
                const leaveStart = new Date(Math.max(new Date(leave.start_date).getTime(), new Date(startDate).getTime()))
                const leaveEnd = new Date(Math.min(new Date(leave.end_date).getTime(), new Date(endDate).getTime()))
                for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
                    const dayOfWeek = d.getDay()
                    const dateStr = d.toISOString().split('T')[0]
                    if (!offDays.includes(dayOfWeek) && !closureDates.has(dateStr)) {
                        leaveDays += leave.is_half_day ? 0.5 : 1
                    }
                }
            }

            const presentDays = records.filter(r => r.check_in && (r.status === 'verified' || r.status === 'pending')).length
            const halfDays = records.filter(r => r.is_half_day).length
            const effectivePresentDays = presentDays - (halfDays * 0.5)
            const absentDays = Math.max(0, totalWorkingDays - effectivePresentDays - leaveDays)

            const totalWorkingHours = records.reduce((sum, r) => sum + (Number(r.working_hours) || 0), 0)
            const totalExtraHours = Math.max(0, totalWorkingHours - (effectivePresentDays * scheduledHoursPerDay))

            // Check if summary already exists for this month
            const existingSummary = await db.query.monthlyAttendanceSummary.findFirst({
                where: and(
                    eq(monthlyAttendanceSummary.profile_id, employee.id),
                    eq(monthlyAttendanceSummary.month, month),
                    eq(monthlyAttendanceSummary.year, year)
                )
            })

            if (existingSummary) {
                // Only update if still in draft
                if (existingSummary.status === 'draft') {
                    const [updated] = await db.update(monthlyAttendanceSummary).set({
                        total_working_days: totalWorkingDays,
                        total_present_days: presentDays,
                        total_absent_days: Math.round(absentDays),
                        total_half_days: halfDays,
                        total_leaves: Math.round(leaveDays),
                        total_working_hours: totalWorkingHours.toFixed(2),
                        total_extra_hours: totalExtraHours.toFixed(2),
                        updated_at: new Date(),
                    }).where(eq(monthlyAttendanceSummary.id, existingSummary.id)).returning()
                    results.push(updated)
                } else {
                    results.push(existingSummary)
                }
            } else {
                const [newSummary] = await db.insert(monthlyAttendanceSummary).values({
                    profile_id: employee.id,
                    month,
                    year,
                    total_working_days: totalWorkingDays,
                    total_present_days: presentDays,
                    total_absent_days: Math.round(absentDays),
                    total_half_days: halfDays,
                    total_leaves: Math.round(leaveDays),
                    total_working_hours: totalWorkingHours.toFixed(2),
                    total_extra_hours: totalExtraHours.toFixed(2),
                    status: 'draft',
                }).returning()
                results.push(newSummary)
            }
        }

        return results
    }

    /** Get monthly summaries for a month/year */
    static async getMonthlySummaries(month: number, year: number) {
        return await db.query.monthlyAttendanceSummary.findMany({
            where: and(
                eq(monthlyAttendanceSummary.month, month),
                eq(monthlyAttendanceSummary.year, year)
            ),
            with: {
                profile: {
                    columns: { full_name: true, email: true }
                }
            },
            orderBy: [desc(monthlyAttendanceSummary.created_at)],
        })
    }

    // ==========================================
    // SET FOR SALARY
    // ==========================================

    /** Mark summaries as confirmed for salary */
    static async setForSalary(ids: string[], confirmedBy: string) {
        const updated = await db.update(monthlyAttendanceSummary).set({
            status: 'set_for_salary',
            set_for_salary_by: confirmedBy,
            set_for_salary_at: new Date(),
            updated_at: new Date(),
        }).where(and(
            inArray(monthlyAttendanceSummary.id, ids),
            eq(monthlyAttendanceSummary.status, 'draft')
        )).returning()

        return updated
    }

    // ==========================================
    // PAYSLIP GENERATION
    // ==========================================

    /** Generate payslips for confirmed summaries */
    static async generatePayslips(ids: string[]) {
        const summaries = await db.query.monthlyAttendanceSummary.findMany({
            where: and(
                inArray(monthlyAttendanceSummary.id, ids),
                eq(monthlyAttendanceSummary.status, 'set_for_salary')
            ),
            with: {
                profile: {
                    columns: { full_name: true, email: true }
                }
            }
        })

        if (summaries.length === 0) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'No valid summaries found for payslip generation. Ensure records are marked "Set for Salary".'
            })
        }

        const results = []

        for (const summary of summaries) {
            // Get applicable salary setup
            const salarySetup = await this.getActiveSalaryForPeriod(
                summary.profile_id,
                summary.month,
                summary.year
            )

            if (!salarySetup) {
                // Skip employees without salary setup — don't fail entire batch
                results.push({
                    ...summary,
                    error: 'No salary setup found for this period'
                })
                continue
            }

            const basic = Number(salarySetup.basic_salary) || 0
            const hra = Number(salarySetup.hra) || 0
            const da = Number(salarySetup.da) || 0
            const ta = Number(salarySetup.ta) || 0
            const special = Number(salarySetup.special_allowance) || 0
            const incentiveAmt = Number(salarySetup.incentive) || 0
            const otherDeductions = Number(salarySetup.other_deductions) || 0

            const grossSalary = basic + hra + da + ta + special + incentiveAmt
            const totalWorkingDays = summary.total_working_days || 1
            const absentDays = summary.total_absent_days || 0
            const halfDays = summary.total_half_days || 0

            // Pro-rate absence deduction
            const perDayRate = grossSalary / totalWorkingDays
            const absenceDeduction = (absentDays * perDayRate) + (halfDays * 0.5 * perDayRate)

            const netSalary = grossSalary - absenceDeduction - otherDeductions

            // Get pending advances
            const advanceTotal = Number(await this.getPendingAdvancesTotal(summary.profile_id))

            const takeHome = netSalary - advanceTotal

            const salaryBreakdown = {
                basic_salary: basic,
                hra,
                da,
                ta,
                special_allowance: special,
                incentive: incentiveAmt,
                gross_salary: grossSalary,
                total_working_days: totalWorkingDays,
                absent_days: absentDays,
                half_days: halfDays,
                per_day_rate: Number(perDayRate.toFixed(2)),
                absence_deduction: Number(absenceDeduction.toFixed(2)),
                other_deductions: otherDeductions,
                net_salary: Number(netSalary.toFixed(2)),
                advance_recovery: advanceTotal,
                take_home: Number(takeHome.toFixed(2)),
            }

            // Update summary with payslip data
            const [updated] = await db.update(monthlyAttendanceSummary).set({
                status: 'payslip_generated',
                gross_salary: grossSalary.toFixed(2),
                absence_deduction: absenceDeduction.toFixed(2),
                net_salary: netSalary.toFixed(2),
                advance_recovery: advanceTotal.toFixed(2),
                take_home: takeHome.toFixed(2),
                salary_breakdown: salaryBreakdown,
                updated_at: new Date(),
            }).where(eq(monthlyAttendanceSummary.id, summary.id)).returning()

            // Mark pending advances as adjusted
            if (advanceTotal > 0) {
                await db.update(employeeAdvances).set({
                    status: 'adjusted',
                    adjusted_in_month: summary.month,
                    adjusted_in_year: summary.year,
                }).where(and(
                    eq(employeeAdvances.profile_id, summary.profile_id),
                    eq(employeeAdvances.status, 'pending')
                ))
            }

            results.push(updated)
        }

        return results
    }

    /** Get individual payslip detail */
    static async getPayslipDetail(summaryId: string) {
        const summary = await db.query.monthlyAttendanceSummary.findFirst({
            where: eq(monthlyAttendanceSummary.id, summaryId),
            with: {
                profile: {
                    columns: { full_name: true, email: true }
                }
            }
        })

        if (!summary) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip not found' })
        }

        return summary
    }
}
