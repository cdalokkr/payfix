import { db } from '@/lib/db'
import {
    employeeSalarySetup,
    employeeAdvances,
    monthlyAttendanceSummary,
    monthlyBonuses,
    attendance,
    leaves,
    profiles,
    officeSettings,
    officeClosures,
    salaryPayments
} from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, inArray, or, ne, gt, isNotNull } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { SmartCache } from '@/lib/cache/smart-cache'
import { calculateAttendanceExtraHours } from '@/lib/utils/attendance-extra-hours'

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

export class SalaryService {

    // ==========================================
    // MONTHLY BONUSES & INCENTIVES
    // ==========================================

    /** Get all bonuses for a specific month and year */
    static async getMonthlyBonuses(month: number, year: number) {
        return await db.query.monthlyBonuses.findMany({
            where: and(
                eq(monthlyBonuses.month, month),
                eq(monthlyBonuses.year, year)
            ),
            with: {
                profile: {
                    columns: { id: true, full_name: true, email: true, role: true, avatar_url: true }
                }
            },
            orderBy: [desc(monthlyBonuses.created_at)]
        })
    }

    /** 1-Click Set Bulk Bonus for all active employees and moderators */
    static async setBulkMonthlyBonus({
        month,
        year,
        amount,
        title,
        bonusType = 'festival_bonus',
        remarks,
        createdBy,
    }: {
        month: number
        year: number
        amount: string | number
        title: string
        bonusType?: string
        remarks?: string
        createdBy: string
    }) {
        const numAmt = Number(amount)
        if (isNaN(numAmt) || numAmt < 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid bonus amount' })
        }

        // Fetch all active employees and moderators
        const activeUsers = await db.query.profiles.findMany({
            where: and(
                eq(profiles.status, 'active'),
                or(eq(profiles.role, 'employee'), eq(profiles.role, 'moderator'))
            ),
            columns: { id: true }
        })

        if (activeUsers.length === 0) return []

        const cleanTitle = (title || 'Monthly Bonus').trim()
        const cleanRemarks = remarks?.trim() || null
        const results: any[] = []

        for (const user of activeUsers) {
            const [saved] = await db.insert(monthlyBonuses).values({
                profile_id: user.id,
                month,
                year,
                amount: numAmt.toFixed(2),
                bonus_type: bonusType,
                title: cleanTitle,
                remarks: cleanRemarks,
                created_by: createdBy,
            }).onConflictDoUpdate({
                target: [monthlyBonuses.profile_id, monthlyBonuses.month, monthlyBonuses.year, monthlyBonuses.title],
                set: {
                    amount: numAmt.toFixed(2),
                    bonus_type: bonusType,
                    remarks: cleanRemarks,
                    updated_at: new Date(),
                }
            }).returning()
            results.push(saved)
        }

        return results
    }

    /** Upsert an individual bonus for a specific user */
    static async upsertIndividualBonus({
        profileId,
        month,
        year,
        amount,
        title,
        bonusType = 'incentive',
        remarks,
        createdBy,
    }: {
        profileId: string
        month: number
        year: number
        amount: string | number
        title: string
        bonusType?: string
        remarks?: string
        createdBy: string
    }) {
        const numAmt = Number(amount)
        if (isNaN(numAmt) || numAmt < 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid bonus amount' })
        }

        const cleanTitle = (title || 'Monthly Bonus').trim()
        const cleanRemarks = remarks?.trim() || null

        const [saved] = await db.insert(monthlyBonuses).values({
            profile_id: profileId,
            month,
            year,
            amount: numAmt.toFixed(2),
            bonus_type: bonusType,
            title: cleanTitle,
            remarks: cleanRemarks,
            created_by: createdBy,
        }).onConflictDoUpdate({
            target: [monthlyBonuses.profile_id, monthlyBonuses.month, monthlyBonuses.year, monthlyBonuses.title],
            set: {
                amount: numAmt.toFixed(2),
                bonus_type: bonusType,
                remarks: cleanRemarks,
                updated_at: new Date(),
            }
        }).returning()

        return saved
    }

    /** Delete a bonus */
    static async deleteMonthlyBonus(id: string) {
        return await db.delete(monthlyBonuses).where(eq(monthlyBonuses.id, id)).returning()
    }

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

        // Get total count for pagination and advances concurrently
        const [totalCountResult, advances] = await Promise.all([
            db.select({ count: sql<number>`count(*)` })
                .from(employeeAdvances)
                .where(conditions.length > 0 ? and(...conditions) : undefined),
            db.query.employeeAdvances.findMany({
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
        ])
        const total = Number(totalCountResult[0]?.count || 0)

        return {
            advances: advances.map(a => ({
                ...a,
                employeeName: a.profile?.full_name || 'Unknown Employee',
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
    static async getPendingAdvancesTotal(profileId: string, month?: number, year?: number) {
        let conditions = and(
            eq(employeeAdvances.profile_id, profileId),
            eq(employeeAdvances.status, 'pending')
        )
        if (month !== undefined && year !== undefined) {
            const lastDay = new Date(year, month, 0).getDate()
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
            conditions = and(conditions, lte(employeeAdvances.date, endDate))
        }

        const result = await db.select({
            total: sql<string>`COALESCE(SUM(${employeeAdvances.amount}::numeric), 0)`,
        }).from(employeeAdvances).where(conditions)

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
            salary_breakdown?: any
        },
        metrics: {
            totalWorkingDays: number
            presentDays: number
            halfDays: number
            absentDays: number
            leaveDays: number
            totalWorkingHours: number
            totalExtraHours: number
            extraDays: number
            extraShiftFull?: number
            extraShiftHalf?: number
            extraShiftEquivalentDays?: number
            monthlyBonus?: number
            bonusTitle?: string
            bonusType?: string
            source?: string
        },
        tx?: any
    ) {
        const client = tx || db

        if (existingSummary.status === 'draft' || existingSummary.status === 'set_for_salary') {
            const currentBD = (existingSummary.salary_breakdown as Record<string, any>) || {}
            const [updated] = await client.update(monthlyAttendanceSummary).set({
                total_working_days: metrics.totalWorkingDays,
                total_present_days: metrics.presentDays,
                total_absent_days: metrics.absentDays,
                total_half_days: metrics.halfDays,
                total_leaves: String(metrics.leaveDays),
                total_working_hours: metrics.totalWorkingHours.toFixed(2),
                total_extra_hours: metrics.totalExtraHours.toFixed(2),
                salary_breakdown: {
                    ...currentBD,
                    extra_days: metrics.extraDays || 0,
                    extra_shift_full: metrics.extraShiftFull ?? currentBD.extra_shift_full ?? 0,
                    extra_shift_half: metrics.extraShiftHalf ?? currentBD.extra_shift_half ?? 0,
                    extra_shift_equivalent_days: metrics.extraShiftEquivalentDays ?? currentBD.extra_shift_equivalent_days ?? 0,
                    ...(metrics.monthlyBonus !== undefined ? {
                        monthly_bonus: Number(metrics.monthlyBonus.toFixed(2)),
                        bonus_title: metrics.bonusTitle || currentBD.bonus_title || 'Monthly Bonus',
                        bonus_type: metrics.bonusType || currentBD.bonus_type || 'festival_bonus',
                    } : {}),
                    source: metrics.source || currentBD.source || 'compiled'
                },
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
                    total_leaves: String(metrics.leaveDays),
                    total_working_hours: metrics.totalWorkingHours.toFixed(2),
                    total_extra_hours: metrics.totalExtraHours.toFixed(2),
                    updated_at: new Date(),
                }).where(eq(monthlyAttendanceSummary.id, existingSummary.id)).returning()
                return updated
            }

            const [officeSettingsData, allLocations] = await Promise.all([
                SmartCache.getOfficeSettingsCached(),
                SmartCache.getOfficeLocationsCached(),
            ])
            let empLocation: any = null
            if (existingSummary.profile_id) {
                const lastPunch = await db.query.attendance.findFirst({
                    where: and(
                        eq(attendance.profile_id, existingSummary.profile_id),
                        isNotNull(attendance.location_id)
                    ),
                    columns: { location_id: true }
                })
                if (lastPunch?.location_id) {
                    empLocation = allLocations.find(l => l.id === lastPunch.location_id)
                }
            }
            if (!empLocation && allLocations.length === 1) {
                empLocation = allLocations[0]
            }
            const multiplier = empLocation?.absent_deduction_multiplier ?? officeSettingsData?.absent_deduction_multiplier ?? 1

            const basic = Number(salarySetup.basic_salary) || 0
            const hra = Number(salarySetup.hra) || 0
            const da = Number(salarySetup.da) || 0
            const ta = Number(salarySetup.ta) || 0
            const special = Number(salarySetup.special_allowance) || 0
            const incentiveAmt = Number(salarySetup.incentive) || 0
            const otherDeductions = Number(salarySetup.other_deductions) || 0

            const bonusRecords = await client.query.monthlyBonuses.findMany({
                where: and(
                    eq(monthlyBonuses.profile_id, existingSummary.profile_id),
                    eq(monthlyBonuses.month, existingSummary.month),
                    eq(monthlyBonuses.year, existingSummary.year)
                )
            })
            const bonusAmt = metrics.monthlyBonus !== undefined
                ? metrics.monthlyBonus
                : bonusRecords.reduce((sum: number, b: any) => sum + (Number(b?.amount) || 0), 0)
            const bonusTitle = metrics.bonusTitle || bonusRecords[0]?.title || 'Monthly Bonus'
            const bonusType = metrics.bonusType || bonusRecords[0]?.bonus_type || 'festival_bonus'

            const currentBD = (existingSummary.salary_breakdown as Record<string, any>) || {}
            const extraShiftEquiv = metrics.extraShiftEquivalentDays !== undefined 
                ? metrics.extraShiftEquivalentDays 
                : (Number(currentBD.extra_shift_equivalent_days) || 0)

            const baseGross = basic + hra + da + ta + special + incentiveAmt
            const totalWorkingDaysVal = metrics.totalWorkingDays || 1
            const absentDaysVal = metrics.absentDays || 0
            const halfDaysVal = metrics.halfDays || 0
            const extraDaysVal = metrics.extraDays || 0

            // Pro-rate absence deduction
            const perDayRate = baseGross / totalWorkingDaysVal
            const extraDayPayment = extraDaysVal * perDayRate
            const extraShiftPayment = extraShiftEquiv * perDayRate
            const absentDeductionVal = absentDaysVal * multiplier * perDayRate
            const halfDayDeductionVal = halfDaysVal * 0.5 * perDayRate
            const leaveDeductionVal = 0
            const absenceDeduction = absentDeductionVal + halfDayDeductionVal

            const grossSalary = baseGross + bonusAmt
            const netSalary = grossSalary + extraDayPayment + extraShiftPayment - absenceDeduction - otherDeductions

            const lastDay = new Date(existingSummary.year, existingSummary.month, 0).getDate()
            const endDate = `${existingSummary.year}-${String(existingSummary.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

            // Reset any wrongly adjusted advances for this employee:
            // 1. Advances adjusted in a month prior to their actual date.
            // 2. Advances adjusted in this month but their date is in the future.
            await client.update(employeeAdvances).set({
                status: 'pending',
                adjusted_in_month: null,
                adjusted_in_year: null,
            }).where(and(
                eq(employeeAdvances.profile_id, existingSummary.profile_id),
                eq(employeeAdvances.status, 'adjusted'),
                or(
                    sql`(${employeeAdvances.date}::date > (${employeeAdvances.adjusted_in_year}::text || '-' || LPAD(${employeeAdvances.adjusted_in_month}::text, 2, '0') || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day')`,
                    gt(employeeAdvances.date, endDate)
                )
            ))

            // Get pending advances + adjusted advances for this target month/year
            const advancesList = await client.select({
                amount: employeeAdvances.amount,
                particulars: employeeAdvances.particulars,
            }).from(employeeAdvances).where(and(
                eq(employeeAdvances.profile_id, existingSummary.profile_id),
                or(
                    and(
                        eq(employeeAdvances.status, 'pending'),
                        lte(employeeAdvances.date, endDate)
                    ),
                    and(
                        eq(employeeAdvances.status, 'adjusted'),
                        eq(employeeAdvances.adjusted_in_month, existingSummary.month),
                        eq(employeeAdvances.adjusted_in_year, existingSummary.year)
                    )
                )
            ))

            let carryForwardRecovery = 0
            let regularAdvanceRecovery = 0
            for (const adv of advancesList) {
                const amt = Number(adv.amount) || 0
                if (adv.particulars?.startsWith('Salary deficit carry-forward from')) {
                    carryForwardRecovery += amt
                } else {
                    regularAdvanceRecovery += amt
                }
            }
            const advanceTotal = carryForwardRecovery + regularAdvanceRecovery

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
                monthly_bonus: Number(bonusAmt.toFixed(2)),
                bonus_title: bonusTitle,
                bonus_type: bonusType,
                gross_salary: grossSalary,
                total_working_days: totalWorkingDaysVal,
                absent_days: absentDaysVal,
                half_days: halfDaysVal,
                extra_days: extraDaysVal,
                extra_day_payment: Number(extraDayPayment.toFixed(2)),
                extra_shift_full: metrics.extraShiftFull ?? currentBD.extra_shift_full ?? 0,
                extra_shift_half: metrics.extraShiftHalf ?? currentBD.extra_shift_half ?? 0,
                extra_shift_equivalent_days: Number(extraShiftEquiv.toFixed(1)),
                extra_shift_payment: Number(extraShiftPayment.toFixed(2)),
                absent_deduction_multiplier: multiplier,
                per_day_rate: Number(perDayRate.toFixed(2)),
                absence_deduction: Number(absenceDeduction.toFixed(2)),
                absent_deduction: Number(absentDeductionVal.toFixed(2)),
                half_day_deduction: Number(halfDayDeductionVal.toFixed(2)),
                leave_deduction: Number(leaveDeductionVal.toFixed(2)),
                other_deductions: otherDeductions,
                net_salary: Number(netSalary.toFixed(2)),
                advance_recovery: Number(regularAdvanceRecovery.toFixed(2)),
                carry_forward_recovery: Number(carryForwardRecovery.toFixed(2)),
                total_advance_recovery: Number(advanceTotal.toFixed(2)),
                take_home: Number(actualTakeHome.toFixed(2)),
                carry_forward: Number(carryForwardAmount.toFixed(2)),
                source: metrics.source || (existingSummary.salary_breakdown as any)?.source || 'compiled'
            }

            // Update summary with new metrics and recalculated payslip, resetting payment details
            const [updated] = await client.update(monthlyAttendanceSummary).set({
                total_working_days: metrics.totalWorkingDays,
                total_present_days: metrics.presentDays,
                total_absent_days: metrics.absentDays,
                total_half_days: metrics.halfDays,
                total_leaves: String(metrics.leaveDays),
                total_working_hours: metrics.totalWorkingHours.toFixed(2),
                total_extra_hours: metrics.totalExtraHours.toFixed(2),
                gross_salary: grossSalary.toFixed(2),
                absence_deduction: absenceDeduction.toFixed(2),
                net_salary: netSalary.toFixed(2),
                advance_recovery: advanceTotal.toFixed(2),
                take_home: actualTakeHome.toFixed(2),
                salary_breakdown: salaryBreakdown,
                paid_mode: null,
                pay_date: null,
                pay_reference_no: null,
                payment_remarks: null,
                paid_by: null,
                paid_at: null,
                updated_at: new Date(),
            }).where(eq(monthlyAttendanceSummary.id, existingSummary.id)).returning()

            // Update advances status ONLY if payslip is generated or already generated
            const isGenerated = existingSummary.status === 'payslip_generated'
            if (isGenerated) {
                if (advanceTotal > 0) {
                    await client.update(employeeAdvances).set({
                        status: 'adjusted',
                        adjusted_in_month: existingSummary.month,
                        adjusted_in_year: existingSummary.year,
                    }).where(and(
                        eq(employeeAdvances.profile_id, existingSummary.profile_id),
                        or(
                            and(
                                eq(employeeAdvances.status, 'pending'),
                                lte(employeeAdvances.date, endDate)
                            ),
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
            } else {
                // If it is draft/set_for_salary, ensure no advances remain marked as adjusted for this month/year
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

    /** Compile monthly attendance for all employees or a specific employee */
    static async compileMonthlyAttendance(
        month: number,
        year: number,
        profileId?: string,
        forceRecalculate: boolean = false
    ) {
        // Get all active employees or a specific employee
        const employees = await db.query.profiles.findMany({
            where: profileId
                ? eq(profiles.id, profileId)
                : eq(profiles.status, 'active'),
            columns: { id: true, full_name: true, email: true }
        })

        const employeeIds = employees.map(e => e.id)
        if (employeeIds.length === 0) return []

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

        // Fetch office settings, closures, bulk attendance records, approved leaves, existing summaries, and monthly bonuses concurrently
        const [settings, closures, allAttendanceRecords, allLeaves, allExistingSummaries, allLocations, allBonuses] = await Promise.all([
            SmartCache.getOfficeSettingsCached(),
            db.query.officeClosures.findMany({
                where: and(
                    gte(officeClosures.date, startDate),
                    lte(officeClosures.date, endDate)
                )
            }),
            db.query.attendance.findMany({
                where: and(
                    inArray(attendance.profile_id, employeeIds),
                    gte(attendance.date, startDate),
                    lte(attendance.date, endDate)
                ),
                with: {
                    shift: true,
                    location: true,
                }
            }),
            db.query.leaves.findMany({
                where: and(
                    inArray(leaves.profile_id, employeeIds),
                    eq(leaves.status, 'approved'),
                    lte(leaves.start_date, endDate),
                    gte(leaves.end_date, startDate)
                )
            }),
            db.query.monthlyAttendanceSummary.findMany({
                where: and(
                    inArray(monthlyAttendanceSummary.profile_id, employeeIds),
                    eq(monthlyAttendanceSummary.month, month),
                    eq(monthlyAttendanceSummary.year, year)
                )
            }),
            SmartCache.getOfficeLocationsCached(),
            db.query.monthlyBonuses.findMany({
                where: and(
                    inArray(monthlyBonuses.profile_id, employeeIds),
                    eq(monthlyBonuses.month, month),
                    eq(monthlyBonuses.year, year)
                )
            }),
        ])

        const defaultCheckIn = settings?.default_check_in || '10:00:00'
        const defaultCheckOut = settings?.default_check_out || '19:00:00'
        const defaultOffDays = (settings?.off_days as number[] | null) || [0] // Default Sunday off
        const locationsMap = new Map<string, any>(allLocations.map((l: any) => [l.id, l]))

        // PAY-01: Company policy enforces per-day salary rate strictly calculated from
        // the total calendar days in the month (e.g. 28/29 for Feb, 30 for Apr/Jun/Sep/Nov, 31 for Jan/Mar/May/Jul/Aug/Oct/Dec).
        const totalWorkingDays = lastDay

        const results: any[] = []

        for (const employee of employees) {
            // Check if summary already exists for this month in memory
            const existingSummary = allExistingSummaries.find(s => s.profile_id === employee.id)

            // If we are doing bulk compile (profileId is omitted) and existing has source === 'excel_upload', skip!
            if (!profileId && existingSummary) {
                const existingBD = existingSummary.salary_breakdown as Record<string, any> | null
                if (existingBD?.source === 'excel_upload') {
                    results.push(existingSummary)
                    continue
                }
            }

            // Filter attendance records in memory
            const records = allAttendanceRecords.filter(r => r.profile_id === employee.id)

            // Determine employee's office location
            const empRecordWithLoc = records.find(r => r.location_id)
            const empLocation = empRecordWithLoc?.location_id 
                ? locationsMap.get(empRecordWithLoc.location_id) 
                : (allLocations.length === 1 ? allLocations[0] : null)

            // Location-aware off days
            const empOffDays = (empLocation?.off_days && empLocation.off_days.length > 0)
                ? (empLocation.off_days as number[])
                : defaultOffDays

            // Location-aware closures (holidays)
            const empClosureDates = new Set(
                closures
                    .filter(c => !c.location_id || (empLocation && c.location_id === empLocation.id))
                    .map(c => c.date)
            )

            // Scheduled hours per day for this employee's branch
            const empCheckIn = empLocation?.check_in_time || defaultCheckIn
            const empCheckOut = empLocation?.check_out_time || defaultCheckOut
            const [eInH, eInM] = empCheckIn.split(':').map(Number)
            const [eOutH, eOutM] = empCheckOut.split(':').map(Number)
            const empScheduledHoursPerDay = ((eOutH * 60 + eOutM) - (eInH * 60 + eInM)) / 60

            // Filter approved leaves in memory
            const employeeLeaves = allLeaves.filter(l => l.profile_id === employee.id)

            // Count leave days within this month
            let leaveDays = 0
            for (const leave of employeeLeaves) {
                // Safe date parsing without UTC conversion drift
                const [sY, sM, sD] = leave.start_date.split('-').map(Number)
                const [eY, eM, eD] = leave.end_date.split('-').map(Number)
                const cur = new Date(sY, sM - 1, sD)
                const end = new Date(eY, eM - 1, eD)

                while (cur <= end) {
                    const y = cur.getFullYear()
                    const m = cur.getMonth() + 1
                    const d = cur.getDate()
                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

                    if (y === year && m === month && !empOffDays.includes(cur.getDay()) && !empClosureDates.has(dateStr)) {
                        // Check if an attendance record overrides this leave day
                        const attRecord = records.find(r => r.date === dateStr)
                        const isOverriddenByAbsent = attRecord && (attRecord.status === 'absent' || (attRecord.remarks && attRecord.remarks.toLowerCase().includes('absent')))
                        const isOverriddenByPresent = attRecord && Boolean(attRecord.check_in)

                        if (!isOverriddenByAbsent && !isOverriddenByPresent) {
                            leaveDays += leave.is_half_day ? 0.5 : 1
                        }
                    }
                    cur.setDate(cur.getDate() + 1)
                }
            }

            // Add explicit leaves from attendance records (excluding those already in the leaves table to avoid double-counting)
            const explicitLeaves = records.filter(r => r.status === 'leave')
            for (const el of explicitLeaves) {
                const isOverriddenByAbsent = el.remarks && el.remarks.toLowerCase().includes('absent')
                const isOverriddenByPresent = Boolean(el.check_in)
                const hasLeaveTable = employeeLeaves.some(l => el.date >= l.start_date && el.date <= l.end_date)
                if (!hasLeaveTable && !isOverriddenByAbsent && !isOverriddenByPresent) {
                    leaveDays += el.is_half_day ? 0.5 : 1
                }
            }

            // Classify attendance records
            const verifiedRecords = records.filter(r => r.check_in && (r.status === 'verified' || r.status === 'pending'))

            const extraRecords = verifiedRecords.filter(r => {
                if (r.is_extra_day) return true
                const dateObj = new Date(r.date)
                const dayOfWeek = dateObj.getDay()
                const isSundayOrHoliday = empOffDays.includes(dayOfWeek) || empClosureDates.has(r.date)
                return isSundayOrHoliday
            })

            const regularRecords = verifiedRecords.filter(r => !extraRecords.includes(r))

            const presentDays = regularRecords.filter(r => !r.is_half_day).length
            const halfDays = regularRecords.filter(r => r.is_half_day).length
            const extraDays = extraRecords.length

            // Count explicit absents: count records explicitly marked as 'absent', OR records that have no check-in/out and are verified/pending but are not on off-days, holidays, or leaves.
            const explicitAbsents = records.filter(r => {
                const isMarkedAbsent = r.status === 'absent' || (r.remarks && r.remarks.toLowerCase().includes('absent'))
                if (isMarkedAbsent) return true
                if (!r.check_in && !r.check_out) {
                    const [y, m, d] = r.date.split('-').map(Number)
                    const dayOfWeek = new Date(y, m - 1, d).getDay()
                    const isWeeklyOff = empOffDays.includes(dayOfWeek) || r.status === 'weekly_off'
                    const isHoliday = empClosureDates.has(r.date) || r.status === 'holiday'
                    const hasLeave = (employeeLeaves.some(l => r.date >= l.start_date && r.date <= l.end_date) || r.status === 'leave') && !isMarkedAbsent
                    if (!isWeeklyOff && !isHoliday && !hasLeave) {
                        return true
                    }
                }
                return false
            }).length
            
            // Count inferred absents on required working days that have no attendance record AND no leave record
            let inferredAbsents = 0
            for (let d = 1; d <= lastDay; d++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const dateObj = new Date(year, month - 1, d)
                const dayOfWeek = dateObj.getDay()
                
                if (!empOffDays.includes(dayOfWeek) && !empClosureDates.has(dateStr)) {
                    const hasRecord = records.some(r => r.date === dateStr)
                    const hasLeave = employeeLeaves.some(l => {
                        const start = l.start_date
                        const end = l.end_date
                        return dateStr >= start && dateStr <= end
                    })
                    
                    if (!hasRecord && !hasLeave) {
                        inferredAbsents++
                    }
                }
            }
            const absentDays = explicitAbsents + inferredAbsents

            const totalWorkingHours = verifiedRecords.reduce((sum, r) => sum + (Number(r.working_hours) || 0), 0)
            
            // Calculate extra hours using individual office location timing and buffer rule where available
            let totalExtraHours = 0
            for (const r of verifiedRecords) {
                const checkIn = (r as any).first_in || (r as any).first_check_in || r.check_in
                const checkOut = (r as any).last_out || (r as any).last_check_out || r.check_out
                if (checkIn && checkOut) {
                    const extraCalc = calculateAttendanceExtraHours({
                        checkIn,
                        checkOut,
                        officeTiming: (r as any).location || empLocation,
                        shiftTiming: (r as any).shift || {
                            startTime: (r as any).shift_start,
                            endTime: (r as any).shift_end,
                            dutyHours: r.duty_hours ? Number(r.duty_hours) : undefined,
                        },
                        workingHours: r.working_hours ? Number(r.working_hours) : null,
                        dutyHours: r.duty_hours ? Number(r.duty_hours) : empScheduledHoursPerDay,
                        date: r.date
                    })
                    totalExtraHours += extraCalc.extraHours
                }
            }
            // Fallback to standard scheduled difference if extra hours not captured by punch buffer
            if (totalExtraHours === 0 && totalWorkingHours > ((presentDays + halfDays * 0.5) * empScheduledHoursPerDay)) {
                totalExtraHours = Math.max(0, totalWorkingHours - ((presentDays + halfDays * 0.5) * empScheduledHoursPerDay))
            }
            totalExtraHours = parseFloat(totalExtraHours.toFixed(2))

            // Extra shifts calculation
            const extraShiftRecords = records.filter(r => r.is_extra_shift || Boolean(r.extra_shift_type))
            const fullExtraShifts = extraShiftRecords.filter(r => r.extra_shift_type === 'full' || (!r.extra_shift_type && !r.is_half_day)).length
            const halfExtraShifts = extraShiftRecords.filter(r => r.extra_shift_type === 'half' || (!r.extra_shift_type && r.is_half_day)).length
            const extraShiftEquivalentDays = (fullExtraShifts * 1.0) + (halfExtraShifts * 0.5)

            // Monthly bonuses calculation
            const empBonuses = allBonuses.filter(b => b.profile_id === employee.id)
            const bonusAmt = empBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
            const bonusTitle = empBonuses.length > 0 ? empBonuses[0].title : 'Monthly Bonus'
            const bonusType = empBonuses.length > 0 ? empBonuses[0].bonus_type : 'festival_bonus'

            if (existingSummary) {
                // AUDIT LOCK: Do not silently mutate finalized payslips during bulk runs
                if (existingSummary.status === 'payslip_generated' && !forceRecalculate) {
                    results.push(existingSummary)
                    continue
                }

                const existingBD = existingSummary.salary_breakdown as Record<string, any> | null
                const existingExtraDays = existingBD?.extra_days || 0

                const hasChanges = true

                if (hasChanges) {
                    const updated = await this.updateAndRecalculateSummary(existingSummary, {
                        totalWorkingDays,
                        presentDays,
                        halfDays,
                        absentDays,
                        leaveDays,
                        totalWorkingHours,
                        totalExtraHours,
                        extraDays,
                        extraShiftFull: fullExtraShifts,
                        extraShiftHalf: halfExtraShifts,
                        extraShiftEquivalentDays,
                        monthlyBonus: bonusAmt,
                        bonusTitle,
                        bonusType,
                        source: 'compiled'
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
                    total_absent_days: absentDays,
                    total_half_days: halfDays,
                    total_leaves: String(leaveDays),
                    total_working_hours: totalWorkingHours.toFixed(2),
                    total_extra_hours: totalExtraHours.toFixed(2),
                    salary_breakdown: {
                        extra_days: extraDays,
                        extra_shift_full: fullExtraShifts,
                        extra_shift_half: halfExtraShifts,
                        extra_shift_equivalent_days: Number(extraShiftEquivalentDays.toFixed(1)),
                        monthly_bonus: Number(bonusAmt.toFixed(2)),
                        bonus_title: bonusTitle,
                        bonus_type: bonusType,
                        source: 'compiled'
                    },
                    status: 'draft',
                }).onConflictDoUpdate({
                    target: [monthlyAttendanceSummary.profile_id, monthlyAttendanceSummary.month, monthlyAttendanceSummary.year],
                    set: {
                        total_working_days: totalWorkingDays,
                        total_present_days: presentDays,
                        total_absent_days: absentDays,
                        total_half_days: halfDays,
                        total_leaves: String(leaveDays),
                        total_working_hours: totalWorkingHours.toFixed(2),
                        total_extra_hours: totalExtraHours.toFixed(2),
                        salary_breakdown: {
                            extra_days: extraDays,
                            extra_shift_full: fullExtraShifts,
                            extra_shift_half: halfExtraShifts,
                            extra_shift_equivalent_days: Number(extraShiftEquivalentDays.toFixed(1)),
                            monthly_bonus: Number(bonusAmt.toFixed(2)),
                            bonus_title: bonusTitle,
                            bonus_type: bonusType,
                            source: 'compiled'
                        },
                        updated_at: new Date(),
                    },
                    where: eq(monthlyAttendanceSummary.status, 'draft'),
                }).returning()
                results.push(newSummary)
            }
        }

        return results
    }

    /** Get monthly summaries for a month/year */
    static async getMonthlySummaries(month: number, year: number) {
        // Fetch summaries and active setups concurrently to eliminate sequential DB roundtrips
        const [summaries, activeSetups] = await Promise.all([
            db.query.monthlyAttendanceSummary.findMany({
                where: and(
                    eq(monthlyAttendanceSummary.month, month),
                    eq(monthlyAttendanceSummary.year, year)
                ),
                with: {
                    profile: {
                        columns: { id: true, full_name: true, email: true, role: true, payslip_enabled: true },
                        with: {
                            designation: {
                                columns: { name: true }
                            },
                            department: {
                                columns: { name: true }
                            }
                        }
                    },
                    payments: true
                },
                orderBy: [desc(monthlyAttendanceSummary.created_at)],
            }),
            db.query.employeeSalarySetup.findMany({
                where: eq(employeeSalarySetup.is_active, true)
            })
        ])

        const activeSetupsMap = new Map<string, boolean>()

        // Check if an active setup exists and falls within target period:
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

        const staleMap = new Map<string, { needs_recompile: boolean; recompile_reason: string }>()

        if (summaries.length > 0) {
            const lastDay = new Date(year, month, 0).getDate()
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

            const employeeIds = summaries.map(s => s.profile_id)

            // Find the earliest updated_at / created_at among summaries
            const minTimestamp = Math.min(
                ...summaries.map(s => new Date(s.updated_at || s.created_at || 0).getTime())
            )
            const minSummaryDate = new Date(minTimestamp)

            try {
                // Fetch attendance and leaves updated after minSummaryDate in target month
                const [recentAttendance, recentLeaves] = await Promise.all([
                    db.query.attendance.findMany({
                        where: and(
                            inArray(attendance.profile_id, employeeIds),
                            gte(attendance.date, startDate),
                            lte(attendance.date, endDate),
                            gt(attendance.updated_at, minSummaryDate)
                        ),
                        columns: {
                            profile_id: true,
                            date: true,
                            updated_at: true,
                        }
                    }),
                    db.query.leaves.findMany({
                        where: and(
                            inArray(leaves.profile_id, employeeIds),
                            lte(leaves.start_date, endDate),
                            gte(leaves.end_date, startDate),
                            gt(leaves.updated_at, minSummaryDate)
                        ),
                        columns: {
                            profile_id: true,
                            start_date: true,
                            end_date: true,
                            updated_at: true,
                        }
                    })
                ])

                for (const s of summaries) {
                    const sTime = new Date(s.updated_at || s.created_at || 0).getTime()
                    // 1000ms buffer to avoid false positives from clock differences during compilation
                    const hasRecentAttendance = recentAttendance.some(
                        a => a.profile_id === s.profile_id && a.updated_at && new Date(a.updated_at).getTime() > sTime + 1000
                    )
                    const hasRecentLeaves = recentLeaves.some(
                        l => l.profile_id === s.profile_id && l.updated_at && new Date(l.updated_at).getTime() > sTime + 1000
                    )

                    if (hasRecentAttendance && hasRecentLeaves) {
                        staleMap.set(s.profile_id, {
                            needs_recompile: true,
                            recompile_reason: 'Attendance and leave records were edited after compilation'
                        })
                    } else if (hasRecentAttendance) {
                        staleMap.set(s.profile_id, {
                            needs_recompile: true,
                            recompile_reason: 'Attendance records were edited after compilation'
                        })
                    } else if (hasRecentLeaves) {
                        staleMap.set(s.profile_id, {
                            needs_recompile: true,
                            recompile_reason: 'Leave status or dates were edited after compilation'
                        })
                    }
                }
            } catch (err) {
                console.warn('[SalaryService.getMonthlySummaries] Failed to check for stale summaries:', err)
            }
        }

        return summaries.map(s => {
            const staleInfo = staleMap.get(s.profile_id)
            return {
                ...s,
                has_salary_setup: activeSetupsMap.get(s.profile_id) || false,
                needs_recompile: staleInfo?.needs_recompile || false,
                recompile_reason: staleInfo?.recompile_reason || null,
            }
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
        if (!ids.length) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'No summary IDs supplied.' })
        }

        return await db.transaction(async (tx) => {
            const summaries = await tx.query.monthlyAttendanceSummary.findMany({
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

            const firstSummary = summaries[0]
            const lastDayOfMonth = new Date(firstSummary.year, firstSummary.month, 0).getDate()
            const startOfMonth = `${firstSummary.year}-${String(firstSummary.month).padStart(2, '0')}-01`
            const endOfMonth = `${firstSummary.year}-${String(firstSummary.month).padStart(2, '0')}-${lastDayOfMonth}`

            // Pre-fetch all salary setups, location data, monthly bonuses, and extra shifts in parallel
            const profileIds = summaries.map(s => s.profile_id)
            const [allSalarySetups, officeSettingsData, allLocations, punchLocations, allBonuses, allExtraShifts] = await Promise.all([
                tx.query.employeeSalarySetup.findMany({
                    where: inArray(employeeSalarySetup.profile_id, profileIds),
                    orderBy: [desc(employeeSalarySetup.effective_from_year), desc(employeeSalarySetup.effective_from_month)],
                }),
                SmartCache.getOfficeSettingsCached(),
                SmartCache.getOfficeLocationsCached(),
                tx.query.attendance.findMany({
                    where: and(
                        inArray(attendance.profile_id, profileIds),
                        isNotNull(attendance.location_id)
                    ),
                    columns: { profile_id: true, location_id: true }
                }),
                tx.query.monthlyBonuses.findMany({
                    where: and(
                        inArray(monthlyBonuses.profile_id, profileIds),
                        eq(monthlyBonuses.month, firstSummary.month),
                        eq(monthlyBonuses.year, firstSummary.year)
                    )
                }),
                tx.query.attendance.findMany({
                    where: and(
                        inArray(attendance.profile_id, profileIds),
                        gte(attendance.date, startOfMonth),
                        lte(attendance.date, endOfMonth),
                        inArray(attendance.status, ['verified', 'pending']),
                        or(
                            eq(attendance.is_extra_shift, true),
                            isNotNull(attendance.extra_shift_type)
                        )
                    )
                })
            ])

        const profileLocationIdMap = new Map<string, string>()
        for (const pl of punchLocations) {
            if (pl.location_id && !profileLocationIdMap.has(pl.profile_id)) {
                profileLocationIdMap.set(pl.profile_id, pl.location_id)
            }
        }
        const locationsMap = new Map<string, any>(allLocations.map((l: any) => [l.id, l]))

        const results: any[] = []

        for (const summary of summaries) {
            // Find applicable salary setup in-memory
            const employeeSetups = allSalarySetups.filter(s => s.profile_id === summary.profile_id)
            let salarySetup: typeof allSalarySetups[number] | null = null
            for (const setup of employeeSetups) {
                const fromVal = setup.effective_from_year * 100 + setup.effective_from_month
                const targetVal = summary.year * 100 + summary.month

                if (fromVal > targetVal) continue

                if (!setup.effective_to_month || !setup.effective_to_year) {
                    salarySetup = setup // ongoing
                    break
                }

                const toVal = setup.effective_to_year * 100 + setup.effective_to_month
                if (targetVal <= toVal) {
                    salarySetup = setup
                    break
                }
            }

            if (!salarySetup) {
                // Skip employees without salary setup — don't fail entire batch
                results.push({
                    ...summary,
                    error: 'No salary setup found for this period'
                })
                continue
            }

            const locId = profileLocationIdMap.get(summary.profile_id)
            const empLocation = locId ? locationsMap.get(locId) : (allLocations.length === 1 ? allLocations[0] : null)
            const multiplier = empLocation?.absent_deduction_multiplier ?? officeSettingsData?.absent_deduction_multiplier ?? 1

            const basic = Number(salarySetup.basic_salary) || 0
            const hra = Number(salarySetup.hra) || 0
            const da = Number(salarySetup.da) || 0
            const ta = Number(salarySetup.ta) || 0
            const special = Number(salarySetup.special_allowance) || 0
            const incentiveAmt = Number(salarySetup.incentive) || 0
            const otherDeductions = Number(salarySetup.other_deductions) || 0

            const empBonuses = allBonuses.filter(b => b.profile_id === summary.profile_id)
            const bonusAmt = empBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
            const bonusTitle = empBonuses.length > 0 ? empBonuses[0].title : 'Monthly Bonus'
            const bonusType = empBonuses.length > 0 ? empBonuses[0].bonus_type : 'festival_bonus'

            const summaryBD = summary.salary_breakdown as Record<string, any> | null
            const extraDays = summaryBD?.extra_days || 0

            const empExtraShifts = allExtraShifts.filter(r => r.profile_id === summary.profile_id)
            const fullExtraShifts = empExtraShifts.filter(r => r.extra_shift_type === 'full' || (!r.extra_shift_type && !r.is_half_day)).length
            const halfExtraShifts = empExtraShifts.filter(r => r.extra_shift_type === 'half' || (!r.extra_shift_type && r.is_half_day)).length
            const extraShiftEquivDays = empExtraShifts.length > 0
                ? (fullExtraShifts * 1.0 + halfExtraShifts * 0.5)
                : (Number(summaryBD?.extra_shift_equivalent_days) || 0)

            const baseGross = basic + hra + da + ta + special + incentiveAmt
            const totalWorkingDays = summary.total_working_days || 1
            const absentDays = summary.total_absent_days || 0
            const halfDays = summary.total_half_days || 0

            // Pro-rate absence deduction
            const perDayRate = baseGross / totalWorkingDays
            const extraDayPayment = extraDays * perDayRate
            const extraShiftPayment = extraShiftEquivDays * perDayRate
            const absentDeductionVal = absentDays * multiplier * perDayRate
            const halfDayDeductionVal = halfDays * 0.5 * perDayRate
            const leaveDeductionVal = 0
            const absenceDeduction = absentDeductionVal + halfDayDeductionVal

            const grossSalary = baseGross + bonusAmt
            const netSalary = grossSalary + extraDayPayment + extraShiftPayment - absenceDeduction - otherDeductions

            const lastDay = new Date(summary.year, summary.month, 0).getDate()
            const endDate = `${summary.year}-${String(summary.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

            // Reset any wrongly adjusted advances for this employee:
            // 1. Advances adjusted in a month prior to their actual date.
            // 2. Advances adjusted in this month but their date is in the future.
            await db.update(employeeAdvances).set({
                status: 'pending',
                adjusted_in_month: null,
                adjusted_in_year: null,
            }).where(and(
                eq(employeeAdvances.profile_id, summary.profile_id),
                eq(employeeAdvances.status, 'adjusted'),
                or(
                    sql`(${employeeAdvances.date}::date > (${employeeAdvances.adjusted_in_year}::text || '-' || LPAD(${employeeAdvances.adjusted_in_month}::text, 2, '0') || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day')`,
                    gt(employeeAdvances.date, endDate)
                )
            ))

            // Fetch pending and adjusted advances list
            const advancesList = await tx.select({
                amount: employeeAdvances.amount,
                particulars: employeeAdvances.particulars,
            }).from(employeeAdvances).where(and(
                eq(employeeAdvances.profile_id, summary.profile_id),
                or(
                    and(
                        eq(employeeAdvances.status, 'pending'),
                        lte(employeeAdvances.date, endDate)
                    ),
                    and(
                        eq(employeeAdvances.status, 'adjusted'),
                        eq(employeeAdvances.adjusted_in_month, summary.month),
                        eq(employeeAdvances.adjusted_in_year, summary.year)
                    )
                )
            ))

            let carryForwardRecovery = 0
            let regularAdvanceRecovery = 0
            for (const adv of advancesList) {
                const amt = Number(adv.amount) || 0
                if (adv.particulars?.startsWith('Salary deficit carry-forward from')) {
                    carryForwardRecovery += amt
                } else {
                    regularAdvanceRecovery += amt
                }
            }
            const advanceTotal = carryForwardRecovery + regularAdvanceRecovery

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
                monthly_bonus: Number(bonusAmt.toFixed(2)),
                bonus_title: bonusTitle,
                bonus_type: bonusType,
                gross_salary: grossSalary,
                total_working_days: totalWorkingDays,
                absent_days: absentDays,
                half_days: halfDays,
                extra_days: extraDays,
                extra_day_payment: Number(extraDayPayment.toFixed(2)),
                extra_shift_full: fullExtraShifts || (summaryBD?.extra_shift_full || 0),
                extra_shift_half: halfExtraShifts || (summaryBD?.extra_shift_half || 0),
                extra_shift_equivalent_days: Number(extraShiftEquivDays.toFixed(1)),
                extra_shift_payment: Number(extraShiftPayment.toFixed(2)),
                absent_deduction_multiplier: multiplier,
                per_day_rate: Number(perDayRate.toFixed(2)),
                absence_deduction: Number(absenceDeduction.toFixed(2)),
                absent_deduction: Number(absentDeductionVal.toFixed(2)),
                half_day_deduction: Number(halfDayDeductionVal.toFixed(2)),
                leave_deduction: Number(leaveDeductionVal.toFixed(2)),
                other_deductions: otherDeductions,
                net_salary: Number(netSalary.toFixed(2)),
                advance_recovery: Number(regularAdvanceRecovery.toFixed(2)),
                carry_forward_recovery: Number(carryForwardRecovery.toFixed(2)),
                total_advance_recovery: Number(advanceTotal.toFixed(2)),
                take_home: Number(actualTakeHome.toFixed(2)),
                carry_forward: Number(carryForwardAmount.toFixed(2)),
            }

            // Update summary with payslip data
            const [updated] = await tx.update(monthlyAttendanceSummary).set({
                status: 'payslip_generated',
                gross_salary: grossSalary.toFixed(2),
                absence_deduction: absenceDeduction.toFixed(2),
                net_salary: netSalary.toFixed(2),
                advance_recovery: advanceTotal.toFixed(2),
                take_home: actualTakeHome.toFixed(2),
                salary_breakdown: salaryBreakdown,
                updated_at: new Date(),
            }).where(eq(monthlyAttendanceSummary.id, summary.id)).returning()

            // Update advances status
            if (advanceTotal > 0) {
                const lastDay = new Date(summary.year, summary.month, 0).getDate()
                const endDate = `${summary.year}-${String(summary.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

                await tx.update(employeeAdvances).set({
                    status: 'adjusted',
                    adjusted_in_month: summary.month,
                    adjusted_in_year: summary.year,
                }).where(and(
                    eq(employeeAdvances.profile_id, summary.profile_id),
                    or(
                        and(
                            eq(employeeAdvances.status, 'pending'),
                            lte(employeeAdvances.date, endDate)
                        ),
                        and(
                            eq(employeeAdvances.status, 'adjusted'),
                            eq(employeeAdvances.adjusted_in_month, summary.month),
                            eq(employeeAdvances.adjusted_in_year, summary.year)
                        )
                    )
                ))
            } else {
                await tx.update(employeeAdvances).set({
                    status: 'pending',
                    adjusted_in_month: null,
                    adjusted_in_year: null,
                }).where(and(
                    eq(employeeAdvances.profile_id, summary.profile_id),
                    eq(employeeAdvances.status, 'adjusted'),
                    eq(employeeAdvances.adjusted_in_month, summary.month),
                    eq(employeeAdvances.adjusted_in_year, summary.year)
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

                const carryForwardParticulars = `Salary deficit carry-forward from ${MONTH_NAMES[summary.month - 1]} ${summary.year} payslip`

                // Delete any existing carry-forward advance for this month/year first to prevent duplicate carry-forward
                await tx.delete(employeeAdvances).where(and(
                    eq(employeeAdvances.profile_id, summary.profile_id),
                    eq(employeeAdvances.particulars, carryForwardParticulars)
                ))

                await tx.insert(employeeAdvances).values({
                    profile_id: summary.profile_id,
                    date: advanceDate,
                    amount: carryForwardAmount.toFixed(2),
                    particulars: carryForwardParticulars,
                    status: 'pending',
                    created_by: summary.profile_id, // system-generated
                })
            }

            results.push(updated)
        }

        return results
        })
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
                },
                payments: {
                    orderBy: [desc(salaryPayments.pay_date), desc(salaryPayments.created_at)]
                }
            }
        })

        if (!summary) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip not found' })
        }

        return summary
    }

    // ==========================================
    // PAYSLIP ACCESS CONTROL (Global & Per-Employee)
    // ==========================================

    /** Check whether payslips and salary book are accessible for an employee */
    static async isPayslipAccessible(profileId: string): Promise<boolean> {
        // 1. Check workspace global settings
        const office = await db.query.officeSettings.findFirst({
            columns: { payslip_enabled: true }
        })
        if (office && office.payslip_enabled === false) {
            return false
        }

        // 2. Check employee specific toggle
        const prof = await db.query.profiles.findFirst({
            where: eq(profiles.id, profileId),
            columns: { payslip_enabled: true, role: true }
        })

        // Admins and moderators always have access
        if (prof?.role === 'admin' || prof?.role === 'moderator') {
            return true
        }

        if (prof && prof.payslip_enabled === false) {
            return false
        }

        return true
    }

    /** Get current payslip access settings (global & employee-specific) */
    static async getPayslipAccessSettings(profileId?: string) {
        const office = await db.query.officeSettings.findFirst({
            columns: { payslip_enabled: true }
        })
        const globalEnabled = office ? office.payslip_enabled !== false : true

        let employeeEnabled = true
        let isStaff = false
        if (profileId) {
            const prof = await db.query.profiles.findFirst({
                where: eq(profiles.id, profileId),
                columns: { payslip_enabled: true, role: true }
            })
            if (prof?.role === 'admin' || prof?.role === 'moderator') {
                isStaff = true
            }
            if (prof && prof.payslip_enabled === false) {
                employeeEnabled = false
            }
        }

        return {
            globalEnabled,
            employeeEnabled,
            isAccessible: isStaff || (globalEnabled && employeeEnabled)
        }
    }

    /** Toggle workspace-wide global payslip access */
    static async toggleGlobalPayslipAccess(enabled: boolean) {
        const existing = await db.query.officeSettings.findFirst()
        if (existing) {
            await db.update(officeSettings)
                .set({ payslip_enabled: enabled, updated_at: new Date() })
                .where(eq(officeSettings.id, existing.id))
        } else {
            await db.insert(officeSettings).values({
                payslip_enabled: enabled
            })
        }
        return { success: true, globalEnabled: enabled }
    }

    /** Toggle individual employee payslip access */
    static async toggleEmployeePayslipAccess(profileId: string, enabled: boolean) {
        await db.update(profiles)
            .set({ payslip_enabled: enabled, updated_at: new Date() })
            .where(eq(profiles.id, profileId))
        return { success: true, profileId, enabled }
    }

    /** Bulk toggle employee payslip access */
    static async bulkToggleEmployeePayslipAccess(profileIds: string[], enabled: boolean) {
        if (!profileIds.length) return { success: true, count: 0, enabled }
        await db.update(profiles)
            .set({ payslip_enabled: enabled, updated_at: new Date() })
            .where(inArray(profiles.id, profileIds))
        return { success: true, count: profileIds.length, enabled }
    }

    /** Get payslips for an employee (self-service) */
    static async getMyPayslips(profileId: string, month: number, year: number) {
        if (!(await SalaryService.isPayslipAccessible(profileId))) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Payslip and salary book access has been disabled by your administrator.'
            })
        }

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
                },
                payments: {
                    orderBy: [desc(salaryPayments.pay_date), desc(salaryPayments.created_at)]
                }
            },
            orderBy: [desc(monthlyAttendanceSummary.created_at)],
        })

        return summaries
    }

    /** Get individual payslip detail for an employee (self-service with ownership check) */
    static async getMyPayslipDetail(summaryId: string, profileId: string) {
        if (!(await SalaryService.isPayslipAccessible(profileId))) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Payslip and salary book access has been disabled by your administrator.'
            })
        }

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
                },
                payments: {
                    orderBy: [desc(salaryPayments.pay_date), desc(salaryPayments.created_at)]
                }
            }
        })

        if (!summary) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip not found' })
        }

        return summary
    }

    /** Mark salary as paid and record payment details */
    static async markSalaryPaid({
        summaryId,
        paidAmount,
        paidMode,
        payDate,
        payReferenceNo,
        paymentRemarks,
        paidBy,
        idempotencyKey,
    }: {
        summaryId: string
        paidAmount: number
        paidMode: string
        payDate: string
        payReferenceNo?: string
        paymentRemarks?: string
        paidBy: string
        idempotencyKey?: string
    }) {
        return await db.transaction(async (tx) => {
            // 1. Idempotency check: if an idempotency key was supplied, check if payment already recorded
            if (idempotencyKey) {
                const existingPayment = await tx.query.salaryPayments.findFirst({
                    where: eq(salaryPayments.idempotency_key, idempotencyKey)
                })
                if (existingPayment) {
                    const existingSummary = await tx.query.monthlyAttendanceSummary.findFirst({
                        where: eq(monthlyAttendanceSummary.id, summaryId)
                    })
                    if (existingSummary) return existingSummary
                }
            }

            // 2. Lock the summary row with FOR UPDATE to prevent concurrent payment races
            const [summary] = await tx
                .select()
                .from(monthlyAttendanceSummary)
                .where(eq(monthlyAttendanceSummary.id, summaryId))
                .for('update')

            if (!summary) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip summary not found' })
            }
            if (summary.status !== 'payslip_generated') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payslip must be generated before marking as paid' })
            }

            if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Payment amount must be a positive number.'
                })
            }

            // 3. Calculate remaining balance inside the lock
            const currentPayments = await tx.query.salaryPayments.findMany({
                where: eq(salaryPayments.summary_id, summaryId)
            })
            const existingPaymentsSum = currentPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
            const netSalary = Number(summary.take_home) || 0
            const remainingBalance = netSalary - existingPaymentsSum

            if (Number(paidAmount.toFixed(2)) > Number(remainingBalance.toFixed(2))) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Payment amount of ${paidAmount} exceeds the remaining balance of ${remainingBalance}`
                })
            }

            // 4. Insert new payment record
            await tx.insert(salaryPayments).values({
                summary_id: summaryId,
                amount: String(paidAmount),
                paid_mode: paidMode,
                pay_date: payDate,
                pay_reference_no: payReferenceNo || null,
                payment_remarks: paymentRemarks || null,
                paid_by: paidBy,
                idempotency_key: idempotencyKey || null,
                created_at: new Date(),
                updated_at: new Date()
            })

            // 5. Calculate new total paid
            const newTotalPaid = existingPaymentsSum + paidAmount

            // 6. Update monthlyAttendanceSummary with denormalized payment details
            const [updated] = await tx.update(monthlyAttendanceSummary).set({
                paid_amount: String(newTotalPaid),
                paid_mode: paidMode,
                pay_date: payDate,
                pay_reference_no: payReferenceNo || null,
                payment_remarks: paymentRemarks || null,
                paid_by: paidBy,
                paid_at: new Date(),
                updated_at: new Date(),
            }).where(eq(monthlyAttendanceSummary.id, summaryId)).returning()

            return updated
        })
    }

    /** Get salary passbook/paybook for an employee (self-service) */
    static async getMyPaybook(profileId: string) {
        if (!(await SalaryService.isPayslipAccessible(profileId))) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Payslip and salary book access has been disabled by your administrator.'
            })
        }

        const summaries = await db.query.monthlyAttendanceSummary.findMany({
            where: and(
                eq(monthlyAttendanceSummary.profile_id, profileId),
                eq(monthlyAttendanceSummary.status, 'payslip_generated')
            ),
            with: {
                payments: {
                    orderBy: [desc(salaryPayments.pay_date), desc(salaryPayments.created_at)]
                }
            },
            orderBy: [
                desc(monthlyAttendanceSummary.year),
                desc(monthlyAttendanceSummary.month)
            ],
        })

        return summaries
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
            extraDays: number
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
                        const existingBD = existing.salary_breakdown as Record<string, any> | null
                        const existingExtraDays = existingBD?.extra_days || 0
                        const hasChanges = true

                        if (hasChanges) {
                            if (existing.status === 'draft' || existing.status === 'set_for_salary') {
                                const currentBD = (existing.salary_breakdown as Record<string, any>) || {}
                                summariesToUpdate.push({
                                    id: existing.id,
                                    values: {
                                        total_working_days: record.totalWorkingDays,
                                        total_present_days: record.totalPresent,
                                        total_half_days: record.totalHalfDays,
                                        total_absent_days: record.totalAbsent,
                                        total_leaves: String(record.totalLeaves),
                                        salary_breakdown: {
                                            ...currentBD,
                                            extra_days: record.extraDays,
                                            source: 'excel_upload'
                                        },
                                        updated_at: new Date(),
                                    }
                                })
                                updated++
                                if (preview) {
                                    previewDetails.push({
                                        profileId: record.profileId,
                                        action: 'Update',
                                        details: `Present: ${record.totalPresent}, Absent: ${record.totalAbsent}, Leave: ${record.totalLeaves}, Half Day: ${record.totalHalfDays}, Working Days: ${record.totalWorkingDays}, Extra Days: ${record.extraDays}`
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
                                        details: `Present: ${record.totalPresent}, Absent: ${record.totalAbsent}, Leave: ${record.totalLeaves}, Half Day: ${record.totalHalfDays}, Working Days: ${record.totalWorkingDays}, Extra Days: ${record.extraDays} (Recalculating Payslip)`
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
                            total_leaves: String(record.totalLeaves),
                            salary_breakdown: { extra_days: record.extraDays, source: 'excel_upload' },
                            status: 'draft',
                        })
                        inserted++
                        if (preview) {
                            previewDetails.push({
                                profileId: record.profileId,
                                action: 'Insert',
                                details: `Present: ${record.totalPresent}, Absent: ${record.totalAbsent}, Leave: ${record.totalLeaves}, Half Day: ${record.totalHalfDays}, Working Days: ${record.totalWorkingDays}, Extra Days: ${record.extraDays}`
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
                                    totalWorkingHours: 0,
                                    totalExtraHours: 0,
                                    extraDays: item.record.extraDays,
                                    source: 'excel_upload'
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

    // ==========================================
    // SALARY BOOK / PASSBOOK LEDGER
    // ==========================================

    static async getSalaryBook(params?: {
        profileId?: string | null
        year?: number | null
        departmentId?: string | null
        status?: string | null
    }) {
        const { profileId, year, departmentId, status } = params || {}

        const conditions: any[] = []
        if (profileId) {
            conditions.push(eq(monthlyAttendanceSummary.profile_id, profileId))
        }
        if (year) {
            conditions.push(eq(monthlyAttendanceSummary.year, year))
        }

        const rawSummaries = await db.query.monthlyAttendanceSummary.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            with: {
                profile: {
                    columns: {
                        id: true,
                        full_name: true,
                        email: true,
                        mobile_no: true,
                        role: true,
                        department_id: true,
                        designation_id: true,
                        payslip_enabled: true,
                        avatar_url: true,
                        date_of_birth: true,
                    },
                    with: {
                        designation: {
                            columns: { id: true, name: true }
                        },
                        department: {
                            columns: { id: true, name: true }
                        }
                    }
                },
                payments: true
            },
            orderBy: [desc(monthlyAttendanceSummary.year), desc(monthlyAttendanceSummary.month)],
        })

        // Apply in-memory filtering for department and status if provided
        let filteredSummaries = rawSummaries
        if (departmentId) {
            filteredSummaries = filteredSummaries.filter(s => s.profile?.department_id === departmentId)
        }
        if (status) {
            if (status === 'paid') {
                filteredSummaries = filteredSummaries.filter(s => {
                    const takeHome = Number(s.take_home) || 0
                    const paid = Number(s.paid_amount) || 0
                    return (paid >= takeHome && takeHome > 0) || s.status === 'paid'
                })
            } else if (status === 'partially_paid') {
                filteredSummaries = filteredSummaries.filter(s => {
                    const takeHome = Number(s.take_home) || 0
                    const paid = Number(s.paid_amount) || 0
                    return paid > 0 && paid < takeHome
                })
            } else if (status === 'unpaid') {
                filteredSummaries = filteredSummaries.filter(s => {
                    const paid = Number(s.paid_amount) || 0
                    return paid === 0
                })
            } else {
                filteredSummaries = filteredSummaries.filter(s => s.status === status)
            }
        }

        // Available distinct years across all summaries
        const yearSet = new Set<number>()
        const currentYear = new Date().getFullYear()
        yearSet.add(currentYear)
        yearSet.add(currentYear - 1)
        for (const s of rawSummaries) {
            if (s.year) yearSet.add(s.year)
        }
        const availableYears = Array.from(yearSet).sort((a, b) => b - a)

        // Process records
        let grandTotalGross = 0
        let grandTotalAbsenceDeductions = 0
        let grandTotalNet = 0
        let grandTotalAdvanceRecovery = 0
        let grandTotalTakeHome = 0
        let grandTotalPaid = 0
        let grandTotalBalanceDue = 0

        const processedRecords = filteredSummaries.map(s => {
            const gross = Number(s.gross_salary) || 0
            const absence = Number(s.absence_deduction) || 0
            const net = Number(s.net_salary) || 0
            const advance = Number(s.advance_recovery) || 0
            const takeHome = Number(s.take_home) || 0
            const paid = Number(s.paid_amount) || 0
            const balanceDue = Math.max(0, parseFloat((takeHome - paid).toFixed(2)))

            grandTotalGross += gross
            grandTotalAbsenceDeductions += absence
            grandTotalNet += net
            grandTotalAdvanceRecovery += advance
            grandTotalTakeHome += takeHome
            grandTotalPaid += paid
            grandTotalBalanceDue += balanceDue

            let paymentStatus: 'paid' | 'partially_paid' | 'unpaid' = 'unpaid'
            if (paid >= takeHome && takeHome > 0) {
                paymentStatus = 'paid'
            } else if (paid > 0 && paid < takeHome) {
                paymentStatus = 'partially_paid'
            }

            return {
                id: s.id,
                profileId: s.profile_id,
                month: s.month,
                year: s.year,
                monthName: `${MONTH_NAMES[s.month - 1]} ${s.year}`,
                totalWorkingDays: s.total_working_days,
                totalPresentDays: s.total_present_days,
                totalAbsentDays: s.total_absent_days,
                totalHalfDays: s.total_half_days,
                totalLeaves: Number(s.total_leaves) || 0,
                totalExtraHours: Number(s.total_extra_hours) || 0,
                status: s.status,
                grossSalary: gross,
                absenceDeduction: absence,
                netSalary: net,
                advanceRecovery: advance,
                takeHome: takeHome,
                paidAmount: paid,
                balanceDue: balanceDue,
                paymentStatus,
                paidMode: s.paid_mode,
                payDate: s.pay_date,
                payReferenceNo: s.pay_reference_no,
                paymentRemarks: s.payment_remarks,
                paidAt: s.paid_at ? s.paid_at.toISOString() : null,
                salaryBreakdown: s.salary_breakdown as any,
                profile: s.profile ? {
                    id: s.profile.id,
                    fullName: s.profile.full_name || s.profile.email,
                    email: s.profile.email,
                    mobileNo: s.profile.mobile_no,
                    role: s.profile.role,
                    designationName: s.profile.designation?.name || 'Staff',
                    departmentName: s.profile.department?.name || 'General',
                    departmentId: s.profile.department_id,
                    avatarUrl: s.profile.avatar_url,
                } : null,
                payments: (s.payments || []).map(p => ({
                    id: p.id,
                    amount: Number(p.amount) || 0,
                    paidMode: p.paid_mode,
                    payDate: p.pay_date,
                    payReferenceNo: p.pay_reference_no,
                    paymentRemarks: p.payment_remarks,
                    createdAt: p.created_at ? p.created_at.toISOString() : null
                }))
            }
        })

        // Employee Ledger Aggregation (Grouping by employee)
        const employeeMap = new Map<string, any>()
        for (const r of processedRecords) {
            if (!r.profile) continue
            const pid = r.profileId
            if (!employeeMap.has(pid)) {
                employeeMap.set(pid, {
                    profile: r.profile,
                    payslipCount: 0,
                    totalGross: 0,
                    totalDeductions: 0,
                    totalTakeHome: 0,
                    totalPaid: 0,
                    totalBalanceDue: 0,
                    latestMonthYear: r.monthName,
                    latestStatus: r.status,
                    records: []
                })
            }
            const emp = employeeMap.get(pid)
            emp.payslipCount++
            emp.totalGross += r.grossSalary
            emp.totalDeductions += (r.absenceDeduction + r.advanceRecovery)
            emp.totalTakeHome += r.takeHome
            emp.totalPaid += r.paidAmount
            emp.totalBalanceDue += r.balanceDue
            emp.records.push(r)
        }

        const employeeLedger = Array.from(employeeMap.values()).map(e => ({
            ...e,
            totalGross: parseFloat(e.totalGross.toFixed(2)),
            totalDeductions: parseFloat(e.totalDeductions.toFixed(2)),
            totalTakeHome: parseFloat(e.totalTakeHome.toFixed(2)),
            totalPaid: parseFloat(e.totalPaid.toFixed(2)),
            totalBalanceDue: parseFloat(e.totalBalanceDue.toFixed(2)),
        }))

        return {
            records: processedRecords,
            employeeLedger,
            grandTotals: {
                totalPayslips: processedRecords.length,
                totalGross: parseFloat(grandTotalGross.toFixed(2)),
                totalAbsenceDeductions: parseFloat(grandTotalAbsenceDeductions.toFixed(2)),
                totalNet: parseFloat(grandTotalNet.toFixed(2)),
                totalAdvanceRecovery: parseFloat(grandTotalAdvanceRecovery.toFixed(2)),
                totalTakeHome: parseFloat(grandTotalTakeHome.toFixed(2)),
                totalPaid: parseFloat(grandTotalPaid.toFixed(2)),
                totalBalanceDue: parseFloat(grandTotalBalanceDue.toFixed(2)),
            },
            availableYears
        }
    }
}

