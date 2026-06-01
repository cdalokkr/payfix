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
import { SmartCache } from '@/lib/cache/smart-cache'

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

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
        deductionRemark,
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
        deductionRemark?: string
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

        // Insert new active record — coalesce empty strings to '0' for numeric fields
        const [newSetup] = await db.insert(employeeSalarySetup).values({
            profile_id: profileId,
            basic_salary: basicSalary || '0',
            hra: hra || '0',
            da: da || '0',
            ta: ta || '0',
            special_allowance: specialAllowance || '0',
            incentive: incentive || '0',
            other_deductions: otherDeductions || '0',
            deduction_remark: deductionRemark || null,
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
                avatar_url: true,
                role: true,
                mobile_no: true,
            },
            with: {
                designation: {
                    columns: { name: true }
                }
            }
        })

        const activeSetups = await db.query.employeeSalarySetup.findMany({
            where: eq(employeeSalarySetup.is_active, true),
        })

        const setupMap = new Map(activeSetups.map(s => [s.profile_id, s]))

        return allProfiles.map(p => ({
            ...p,
            designation_name: p.designation?.name || null,
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
        if (advance.particulars?.startsWith('Salary deficit carry-forward from')) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot edit a system-generated salary deficit carry-forward' })
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
        if (advance.particulars?.startsWith('Salary deficit carry-forward from')) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete a system-generated salary deficit carry-forward' })
        }

        await db.delete(employeeAdvances).where(eq(employeeAdvances.id, id))
        return { success: true }
    }

    /** Update a monthly summary and recalculate its payslip if already generated */
    static async updateAndRecalculateSummary(
        existingSummary: {
            id: string
            profile_id: string
            month: number
            year: number
            status: string
            total_working_days?: number
            total_present_days?: number
            total_absent_days?: number
            total_half_days?: number
            total_leaves?: number
            total_working_hours?: string | null
            total_extra_hours?: string | null
        },
        metrics: {
            totalWorkingDays: number
            presentDays: number
            halfDays: number
            absentDays: number
            leaveDays: number
            totalWorkingHours: number
            totalExtraHours: number
        },
        tx?: any
    ) {
        const client = tx || db

        if (existingSummary.status === 'draft' || existingSummary.status === 'set_for_salary') {
            const [updated] = await client.update(monthlyAttendanceSummary).set({
                total_working_days: metrics.totalWorkingDays,
                total_present_days: metrics.presentDays,
                total_absent_days: metrics.absentDays,
                total_half_days: metrics.halfDays,
                total_leaves: metrics.leaveDays,
                total_working_hours: metrics.totalWorkingHours.toFixed(2),
                total_extra_hours: metrics.totalExtraHours.toFixed(2),
                updated_at: new Date(),
            }).where(eq(monthlyAttendanceSummary.id, existingSummary.id)).returning()
            return updated
        }

        if (existingSummary.status === 'payslip_generated') {
            // Get applicable salary setup
            const salarySetup = await this.getActiveSalaryForPeriod(
                existingSummary.profile_id,
                existingSummary.month,
                existingSummary.year
            )

            if (!salarySetup) {
                // Skip/fallback if no setup
                const [updated] = await client.update(monthlyAttendanceSummary).set({
                    total_working_days: metrics.totalWorkingDays,
                    total_present_days: metrics.presentDays,
                    total_absent_days: metrics.absentDays,
                    total_half_days: metrics.halfDays,
                    total_leaves: metrics.leaveDays,
                    total_working_hours: metrics.totalWorkingHours.toFixed(2),
                    total_extra_hours: metrics.totalExtraHours.toFixed(2),
                    updated_at: new Date(),
                }).where(eq(monthlyAttendanceSummary.id, existingSummary.id)).returning()
                return updated
            }

            const basic = Number(salarySetup.basic_salary) || 0
            const hra = Number(salarySetup.hra) || 0
            const da = Number(salarySetup.da) || 0
            const ta = Number(salarySetup.ta) || 0
            const special = Number(salarySetup.special_allowance) || 0
            const incentiveAmt = Number(salarySetup.incentive) || 0
            const otherDeductions = Number(salarySetup.other_deductions) || 0

            const grossSalary = basic + hra + da + ta + special + incentiveAmt
            const totalWorkingDaysVal = metrics.totalWorkingDays || 1
            const absentDaysVal = metrics.absentDays || 0
            const halfDaysVal = metrics.halfDays || 0

            // Pro-rate absence deduction
            const perDayRate = grossSalary / totalWorkingDaysVal
            const absenceDeduction = (absentDaysVal * perDayRate) + (halfDaysVal * 0.5 * perDayRate)

            const netSalary = grossSalary - absenceDeduction - otherDeductions

            // Get pending advances + adjusted advances for this target month/year
            const pendingAdvances = await client.select({
                total: sql<string>`COALESCE(SUM(${employeeAdvances.amount}::numeric), 0)`,
            }).from(employeeAdvances).where(and(
                eq(employeeAdvances.profile_id, existingSummary.profile_id),
                or(
                    eq(employeeAdvances.status, 'pending'),
                    and(
                        eq(employeeAdvances.status, 'adjusted'),
                        eq(employeeAdvances.adjusted_in_month, existingSummary.month),
                        eq(employeeAdvances.adjusted_in_year, existingSummary.year)
                    )
                )
            ))
            const advanceTotal = Number(pendingAdvances[0]?.total || '0')

            const rawTakeHome = netSalary - advanceTotal

            // Handle negative take-home: carry forward deficit as next-month advance
            const isNegative = rawTakeHome < 0
            const carryForwardAmount = isNegative ? Math.abs(rawTakeHome) : 0
            const actualTakeHome = isNegative ? 0 : rawTakeHome

            const salaryBreakdown = {
                basic_salary: basic,
                hra,
                da,
                ta,
                special_allowance: special,
                incentive: incentiveAmt,
                gross_salary: grossSalary,
                total_working_days: totalWorkingDaysVal,
                absent_days: absentDaysVal,
                half_days: halfDaysVal,
                per_day_rate: Number(perDayRate.toFixed(2)),
                absence_deduction: Number(absenceDeduction.toFixed(2)),
                other_deductions: otherDeductions,
                net_salary: Number(netSalary.toFixed(2)),
                advance_recovery: advanceTotal,
                take_home: Number(actualTakeHome.toFixed(2)),
                carry_forward: Number(carryForwardAmount.toFixed(2)),
            }

            // Update summary with new metrics and recalculated payslip
            const [updated] = await client.update(monthlyAttendanceSummary).set({
                total_working_days: metrics.totalWorkingDays,
                total_present_days: metrics.presentDays,
                total_absent_days: metrics.absentDays,
                total_half_days: metrics.halfDays,
                total_leaves: metrics.leaveDays,
                total_working_hours: metrics.totalWorkingHours.toFixed(2),
                total_extra_hours: metrics.totalExtraHours.toFixed(2),
                gross_salary: grossSalary.toFixed(2),
                absence_deduction: absenceDeduction.toFixed(2),
                net_salary: netSalary.toFixed(2),
                advance_recovery: advanceTotal.toFixed(2),
                take_home: actualTakeHome.toFixed(2),
                salary_breakdown: salaryBreakdown,
                updated_at: new Date(),
            }).where(eq(monthlyAttendanceSummary.id, existingSummary.id)).returning()

            // Update advances status
            if (advanceTotal > 0) {
                await client.update(employeeAdvances).set({
                    status: 'adjusted',
                    adjusted_in_month: existingSummary.month,
                    adjusted_in_year: existingSummary.year,
                }).where(and(
                    eq(employeeAdvances.profile_id, existingSummary.profile_id),
                    or(
                        eq(employeeAdvances.status, 'pending'),
                        and(
                            eq(employeeAdvances.status, 'adjusted'),
                            eq(employeeAdvances.adjusted_in_month, existingSummary.month),
                            eq(employeeAdvances.adjusted_in_year, existingSummary.year)
                        )
                    )
                ))
            } else {
                await client.update(employeeAdvances).set({
                    status: 'pending',
                    adjusted_in_month: null,
                    adjusted_in_year: null,
                }).where(and(
                    eq(employeeAdvances.profile_id, existingSummary.profile_id),
                    eq(employeeAdvances.status, 'adjusted'),
                    eq(employeeAdvances.adjusted_in_month, existingSummary.month),
                    eq(employeeAdvances.adjusted_in_year, existingSummary.year)
                ))
            }

            // Delete the existing carry-forward advance for this month/year first to prevent duplicate carry-forward
            const carryForwardParticulars = `Salary deficit carry-forward from ${MONTH_NAMES[existingSummary.month - 1]} ${existingSummary.year} payslip`
            await client.delete(employeeAdvances).where(and(
                eq(employeeAdvances.profile_id, existingSummary.profile_id),
                eq(employeeAdvances.particulars, carryForwardParticulars)
            ))

            // Create new carry-forward if negative take-home
            if (isNegative && carryForwardAmount > 0) {
                let nextMonth = existingSummary.month + 1
                let nextYear = existingSummary.year
                if (nextMonth > 12) {
                    nextMonth = 1
                    nextYear += 1
                }
                const advanceDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

                await client.insert(employeeAdvances).values({
                    profile_id: existingSummary.profile_id,
                    date: advanceDate,
                    amount: carryForwardAmount.toFixed(2),
                    particulars: carryForwardParticulars,
                    status: 'pending',
                    created_by: existingSummary.profile_id,
                })
            }

            return updated
        }

        return existingSummary
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
        const settings = await SmartCache.getOfficeSettingsCached()
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
                const hasChanges =
                    existingSummary.total_working_days !== totalWorkingDays ||
                    existingSummary.total_present_days !== presentDays ||
                    existingSummary.total_absent_days !== Math.round(absentDays) ||
                    existingSummary.total_half_days !== halfDays ||
                    existingSummary.total_leaves !== Math.round(leaveDays) ||
                    Number(existingSummary.total_working_hours) !== Number(totalWorkingHours.toFixed(2)) ||
                    Number(existingSummary.total_extra_hours) !== Number(totalExtraHours.toFixed(2))

                if (hasChanges) {
                    const updated = await this.updateAndRecalculateSummary(existingSummary, {
                        totalWorkingDays,
                        presentDays,
                        halfDays,
                        absentDays: Math.round(absentDays),
                        leaveDays: Math.round(leaveDays),
                        totalWorkingHours,
                        totalExtraHours
                    })
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
        const summaries = await db.query.monthlyAttendanceSummary.findMany({
            where: and(
                eq(monthlyAttendanceSummary.month, month),
                eq(monthlyAttendanceSummary.year, year)
            ),
            with: {
                profile: {
                    columns: { id: true, full_name: true, email: true, role: true },
                    with: {
                        designation: {
                            columns: { name: true }
                        }
                    }
                }
            },
            orderBy: [desc(monthlyAttendanceSummary.created_at)],
        })

        // Also fetch active salary setups for these profiles to return has_salary_setup boolean
        const profileIds = summaries.map(s => s.profile_id)
        let activeSetupsMap = new Map<string, boolean>()

        if (profileIds.length > 0) {
            const activeSetups = await db.query.employeeSalarySetup.findMany({
                where: and(
                    inArray(employeeSalarySetup.profile_id, profileIds),
                    eq(employeeSalarySetup.is_active, true)
                )
            })

            // Or use the getActiveSalaryForPeriod logic for a more accurate check,
            // but for simplicity, checking if an active setup exists or querying specific period:
            for (const setup of activeSetups) {
                const fromVal = setup.effective_from_year * 100 + setup.effective_from_month
                const targetVal = year * 100 + month
                if (fromVal <= targetVal) {
                    if (!setup.effective_to_month || !setup.effective_to_year) {
                        activeSetupsMap.set(setup.profile_id, true)
                    } else {
                        const toVal = setup.effective_to_year * 100 + setup.effective_to_month
                        if (targetVal <= toVal) {
                            activeSetupsMap.set(setup.profile_id, true)
                        }
                    }
                }
            }
        }

        return summaries.map(s => ({
            ...s,
            has_salary_setup: activeSetupsMap.get(s.profile_id) || false
        }))
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

            const rawTakeHome = netSalary - advanceTotal

            // Handle negative take-home: carry forward deficit as next-month advance
            const isNegative = rawTakeHome < 0
            const carryForwardAmount = isNegative ? Math.abs(rawTakeHome) : 0
            const actualTakeHome = isNegative ? 0 : rawTakeHome

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
                take_home: Number(actualTakeHome.toFixed(2)),
                carry_forward: Number(carryForwardAmount.toFixed(2)),
            }

            // Update summary with payslip data
            const [updated] = await db.update(monthlyAttendanceSummary).set({
                status: 'payslip_generated',
                gross_salary: grossSalary.toFixed(2),
                absence_deduction: absenceDeduction.toFixed(2),
                net_salary: netSalary.toFixed(2),
                advance_recovery: advanceTotal.toFixed(2),
                take_home: actualTakeHome.toFixed(2),
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

            // If negative take-home, create a pending advance for the carry-forward amount
            if (isNegative && carryForwardAmount > 0) {
                // Determine the date for the advance (1st of next month)
                let nextMonth = summary.month + 1
                let nextYear = summary.year
                if (nextMonth > 12) {
                    nextMonth = 1
                    nextYear += 1
                }
                const advanceDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

                await db.insert(employeeAdvances).values({
                    profile_id: summary.profile_id,
                    date: advanceDate,
                    amount: carryForwardAmount.toFixed(2),
                    particulars: `Salary deficit carry-forward from ${MONTH_NAMES[summary.month - 1]} ${summary.year} payslip`,
                    status: 'pending',
                    created_by: summary.profile_id, // system-generated
                })
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
                    columns: { full_name: true, email: true, role: true },
                    with: {
                        designation: {
                            columns: { name: true }
                        }
                    }
                }
            }
        })

        if (!summary) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip not found' })
        }

        return summary
    }

    /** Get payslips for an employee (self-service) */
    static async getMyPayslips(profileId: string, month: number, year: number) {
        const summaries = await db.query.monthlyAttendanceSummary.findMany({
            where: and(
                eq(monthlyAttendanceSummary.profile_id, profileId),
                eq(monthlyAttendanceSummary.month, month),
                eq(monthlyAttendanceSummary.year, year),
                eq(monthlyAttendanceSummary.status, 'payslip_generated')
            ),
            with: {
                profile: {
                    columns: { full_name: true, email: true, role: true },
                    with: {
                        designation: {
                            columns: { name: true }
                        }
                    }
                }
            },
            orderBy: [desc(monthlyAttendanceSummary.created_at)],
        })

        return summaries
    }

    /** Get individual payslip detail for an employee (self-service with ownership check) */
    static async getMyPayslipDetail(summaryId: string, profileId: string) {
        const summary = await db.query.monthlyAttendanceSummary.findFirst({
            where: and(
                eq(monthlyAttendanceSummary.id, summaryId),
                eq(monthlyAttendanceSummary.profile_id, profileId)
            ),
            with: {
                profile: {
                    columns: { full_name: true, email: true, role: true },
                    with: {
                        designation: {
                            columns: { name: true }
                        }
                    }
                }
            }
        })

        if (!summary) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip not found' })
        }

        return summary
    }

    // ==========================================
    // BULK UPLOAD MONTHLY SUMMARY
    // ==========================================

    /** Bulk upload monthly attendance summary from Excel */
    static async bulkUploadMonthlySummary({
        month,
        year,
        records,
        uploadedBy,
        uploaderName,
        preview = false
    }: {
        month: number
        year: number
        records: Array<{
            profileId: string
            totalWorkingDays: number
            totalPresent: number
            totalHalfDays: number
            totalAbsent: number
            totalLeaves: number
            totalWorkingHours?: number
        }>
        uploadedBy: string
        uploaderName: string
        preview?: boolean
    }): Promise<{
        inserted: number
        updated: number
        skipped: number
        errors: string[]
        toInsert?: number
        toUpdate?: number
        previewDetails?: Array<{
            profileId: string
            action: 'Insert' | 'Update' | 'Skip'
            details: string
            reason?: string
        }>
    }> {
        let inserted = 0
        let updated = 0
        let skipped = 0
        const errors: string[] = []
        const previewDetails: Array<{
            profileId: string
            action: 'Insert' | 'Update' | 'Skip'
            details: string
            reason?: string
        }> = []
        const summariesToRecalculate: Array<{ existing: any; record: any }> = []

        try {
            const profileIds = [...new Set(records.map(r => r.profileId))]

            // Fetch existing summaries in a single bulk query
            const existingMap = new Map<string, any>()
            if (profileIds.length > 0) {
                const existingSummaries = await db.query.monthlyAttendanceSummary.findMany({
                    where: and(
                        inArray(monthlyAttendanceSummary.profile_id, profileIds),
                        eq(monthlyAttendanceSummary.month, month),
                        eq(monthlyAttendanceSummary.year, year)
                    )
                })
                for (const s of existingSummaries) {
                    existingMap.set(s.profile_id, s)
                }
            }

            const summariesToInsert: any[] = []
            const summariesToUpdate: Array<{ id: string; values: any }> = []

            for (const record of records) {
                try {
                    const existing = existingMap.get(record.profileId)

                    if (existing) {
                        const hasChanges =
                            existing.total_working_days !== record.totalWorkingDays ||
                            existing.total_present_days !== record.totalPresent ||
                            existing.total_half_days !== record.totalHalfDays ||
                            existing.total_absent_days !== record.totalAbsent ||
                            existing.total_leaves !== record.totalLeaves ||
                            Number(existing.total_working_hours) !== Number(record.totalWorkingHours?.toFixed(2) || '0')

                        if (hasChanges) {
                            if (existing.status === 'draft' || existing.status === 'set_for_salary') {
                                summariesToUpdate.push({
                                    id: existing.id,
                                    values: {
                                        total_working_days: record.totalWorkingDays,
                                        total_present_days: record.totalPresent,
                                        total_half_days: record.totalHalfDays,
                                        total_absent_days: record.totalAbsent,
                                        total_leaves: record.totalLeaves,
                                        total_working_hours: record.totalWorkingHours?.toFixed(2) || '0',
                                        updated_at: new Date(),
                                    }
                                })
                                updated++
                                if (preview) {
                                    previewDetails.push({
                                        profileId: record.profileId,
                                        action: 'Update',
                                        details: `Present: ${record.totalPresent}, Absent: ${record.totalAbsent}, Leave: ${record.totalLeaves}, Half Day: ${record.totalHalfDays}, Working Days: ${record.totalWorkingDays}${record.totalWorkingHours ? `, Hours: ${record.totalWorkingHours}` : ''}`
                                    })
                                }
                            } else if (existing.status === 'payslip_generated') {
                                summariesToRecalculate.push({
                                    existing,
                                    record
                                })
                                updated++
                                if (preview) {
                                    previewDetails.push({
                                        profileId: record.profileId,
                                        action: 'Update',
                                        details: `Present: ${record.totalPresent}, Absent: ${record.totalAbsent}, Leave: ${record.totalLeaves}, Half Day: ${record.totalHalfDays}, Working Days: ${record.totalWorkingDays}${record.totalWorkingHours ? `, Hours: ${record.totalWorkingHours}` : ''} (Recalculating Payslip)`
                                    })
                                }
                            }
                        } else {
                            skipped++
                            if (preview) {
                                previewDetails.push({
                                    profileId: record.profileId,
                                    action: 'Skip',
                                    details: '',
                                    reason: `Existing record status is ${existing.status} and has no changes`
                                })
                            }
                        }
                    } else {
                        summariesToInsert.push({
                            profile_id: record.profileId,
                            month,
                            year,
                            total_working_days: record.totalWorkingDays,
                            total_present_days: record.totalPresent,
                            total_half_days: record.totalHalfDays,
                            total_absent_days: record.totalAbsent,
                            total_leaves: record.totalLeaves,
                            total_working_hours: record.totalWorkingHours?.toFixed(2) || '0',
                            status: 'draft',
                        })
                        inserted++
                        if (preview) {
                            previewDetails.push({
                                profileId: record.profileId,
                                action: 'Insert',
                                details: `Present: ${record.totalPresent}, Absent: ${record.totalAbsent}, Leave: ${record.totalLeaves}, Half Day: ${record.totalHalfDays}, Working Days: ${record.totalWorkingDays}${record.totalWorkingHours ? `, Hours: ${record.totalWorkingHours}` : ''}`
                            })
                        }
                    }
                } catch (err: any) {
                    errors.push(`Failed to process record for profile ${record.profileId}: ${err.message}`)
                    if (preview) {
                        previewDetails.push({
                            profileId: record.profileId,
                            action: 'Skip',
                            details: '',
                            reason: err.message || 'Validation error'
                        })
                    }
                }
            }

            // If preview mode, return predicted insertion and update numbers instantly without writing anything
            if (preview) {
                return {
                    inserted: 0,
                    updated: 0,
                    skipped,
                    errors,
                    toInsert: summariesToInsert.length,
                    toUpdate: summariesToUpdate.length + summariesToRecalculate.length,
                    previewDetails
                }
            }

            // Run insertions and updates inside a single database transaction
            if (summariesToInsert.length > 0 || summariesToUpdate.length > 0 || summariesToRecalculate.length > 0) {
                await db.transaction(async (tx) => {
                    if (summariesToInsert.length > 0) {
                        await tx.insert(monthlyAttendanceSummary).values(summariesToInsert)
                    }
                    if (summariesToUpdate.length > 0) {
                        for (const update of summariesToUpdate) {
                            await tx.update(monthlyAttendanceSummary).set(update.values).where(eq(monthlyAttendanceSummary.id, update.id))
                        }
                    }
                    if (summariesToRecalculate.length > 0) {
                        for (const item of summariesToRecalculate) {
                            await this.updateAndRecalculateSummary(
                                item.existing,
                                {
                                    totalWorkingDays: item.record.totalWorkingDays,
                                    presentDays: item.record.totalPresent,
                                    halfDays: item.record.totalHalfDays,
                                    absentDays: item.record.totalAbsent,
                                    leaveDays: item.record.totalLeaves,
                                    totalWorkingHours: item.record.totalWorkingHours || 0,
                                    totalExtraHours: 0
                                },
                                tx
                            )
                        }
                    }
                })
            }

        } catch (setupErr: any) {
            errors.push(`General setup error in monthly bulk upload: ${setupErr.message}`)
        }

        // Log activity
        if (!preview && (inserted > 0 || updated > 0)) {
            const { activities } = await import('@/lib/db/schema')
            await db.insert(activities).values({
                user_id: uploadedBy,
                activity_type: 'data_create',
                module: 'attendance',
                description: `Bulk uploaded monthly summary for ${MONTH_NAMES[month - 1]} ${year}: ${inserted} new, ${updated} updated, ${skipped} skipped — by ${uploaderName}`,
            })
        }

        return { inserted, updated, skipped, errors }
    }
}

