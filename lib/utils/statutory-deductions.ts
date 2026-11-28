export type StatutoryMode = 'statutory' | 'percentage' | 'fixed'

export interface StatutorySalaryConfig {
    basicSalary: number
    hra: number
    da: number
    ta: number
    specialAllowance: number
    incentive: number
    pfEnabled: boolean
    pfUan?: string | null
    pfMode?: string | null
    pfEmployeeRate?: number
    pfEmployerRate?: number
    pfCeilingEnabled?: boolean
    pfFixedAmount?: number
    esiEnabled: boolean
    esiNumber?: string | null
    esiMode?: string | null
    esiEmployeeRate?: number
    esiEmployerRate?: number
    esiLimitEnabled?: boolean
    esiFixedAmount?: number
}

export interface StatutoryCalculationInput {
    config: StatutorySalaryConfig
    absenceDeduction: number
    bonusAmount?: number
    extraDayPayment?: number
    extraShiftPayment?: number
}

export interface StatutoryCalculationResult {
    pfEnabled: boolean
    pfMode: StatutoryMode
    pfUan: string | null
    pfCeilingEnabled: boolean
    pfEmployeeRate: number
    pfEmployerRate: number
    pfWage: number
    pfEmployee: number
    pfEmployer: number
    pfEmployerEpf: number
    pfEmployerEps: number
    esiEnabled: boolean
    esiMode: StatutoryMode
    esiNumber: string | null
    esiLimitEnabled: boolean
    esiEligible: boolean
    esiEmployeeRate: number
    esiEmployerRate: number
    esiWage: number
    esiEmployee: number
    esiEmployer: number
    totalEmployeeStatutory: number
    totalEmployerStatutory: number
}

export const PF_STATUTORY_WAGE_CEILING = 15000
export const PF_DEFAULT_EMPLOYEE_RATE = 12
export const PF_DEFAULT_EMPLOYER_RATE = 12
export const PF_EPS_RATE = 8.33
export const PF_EPS_MAX_CONTRIBUTION = 1250

export const ESI_STATUTORY_GROSS_LIMIT = 21000
export const ESI_DEFAULT_EMPLOYEE_RATE = 0.75
export const ESI_DEFAULT_EMPLOYER_RATE = 3.25

function normalizeMode(mode?: string | null): StatutoryMode {
    if (mode === 'percentage' || mode === 'fixed') return mode
    return 'statutory'
}

function roundCurrency(value: number): number {
    return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

/**
 * Computes optional PF (EPF/EPS) and ESI (ESIC) employee & employer contributions
 * on earned monthly wages after attendance adjustments.
 */
export function calculateStatutoryDeductions({
    config,
    absenceDeduction,
    bonusAmount = 0,
    extraDayPayment = 0,
    extraShiftPayment = 0,
}: StatutoryCalculationInput): StatutoryCalculationResult {
    const baseGross =
        (Number(config.basicSalary) || 0) +
        (Number(config.hra) || 0) +
        (Number(config.da) || 0) +
        (Number(config.ta) || 0) +
        (Number(config.specialAllowance) || 0) +
        (Number(config.incentive) || 0)

    const basePfWage = (Number(config.basicSalary) || 0) + (Number(config.da) || 0)
    const safeAbsence = Math.max(0, Number(absenceDeduction) || 0)
    const earnedRatio = baseGross > 0
        ? Math.max(0, Math.min(1, (baseGross - safeAbsence) / baseGross))
        : 0

    // PF Calculation
    const pfEnabled = Boolean(config.pfEnabled)
    const pfMode = normalizeMode(config.pfMode)
    const pfCeilingEnabled = config.pfCeilingEnabled !== false
    const pfEmployeeRate = pfMode === 'statutory'
        ? PF_DEFAULT_EMPLOYEE_RATE
        : Math.max(0, Number(config.pfEmployeeRate ?? PF_DEFAULT_EMPLOYEE_RATE) || 0)
    const pfEmployerRate = pfMode === 'statutory'
        ? PF_DEFAULT_EMPLOYER_RATE
        : Math.max(0, Number(config.pfEmployerRate ?? PF_DEFAULT_EMPLOYER_RATE) || 0)

    const earnedPfWageRaw = roundCurrency(basePfWage * earnedRatio)
    const pfWage = pfEnabled
        ? (pfCeilingEnabled ? Math.min(earnedPfWageRaw, PF_STATUTORY_WAGE_CEILING) : earnedPfWageRaw)
        : 0

    let pfEmployee = 0
    let pfEmployer = 0
    let pfEmployerEpf = 0
    let pfEmployerEps = 0

    if (pfEnabled) {
        if (pfMode === 'fixed') {
            const fixed = Math.max(0, Math.round(Number(config.pfFixedAmount) || 0))
            pfEmployee = fixed
            pfEmployer = fixed
            pfEmployerEpf = fixed
        } else {
            pfEmployee = Math.round((pfWage * pfEmployeeRate) / 100)
            pfEmployer = Math.round((pfWage * pfEmployerRate) / 100)
            if (pfMode === 'statutory') {
                const epsBase = Math.min(pfWage, PF_STATUTORY_WAGE_CEILING)
                pfEmployerEps = Math.min(Math.round((epsBase * PF_EPS_RATE) / 100), PF_EPS_MAX_CONTRIBUTION)
                pfEmployerEpf = Math.max(0, pfEmployer - pfEmployerEps)
            } else {
                pfEmployerEpf = pfEmployer
            }
        }
    }

    // ESI Calculation
    const esiEnabled = Boolean(config.esiEnabled)
    const esiMode = normalizeMode(config.esiMode)
    const esiLimitEnabled = config.esiLimitEnabled !== false
    const esiEmployeeRate = esiMode === 'statutory'
        ? ESI_DEFAULT_EMPLOYEE_RATE
        : Math.max(0, Number(config.esiEmployeeRate ?? ESI_DEFAULT_EMPLOYEE_RATE) || 0)
    const esiEmployerRate = esiMode === 'statutory'
        ? ESI_DEFAULT_EMPLOYER_RATE
        : Math.max(0, Number(config.esiEmployerRate ?? ESI_DEFAULT_EMPLOYER_RATE) || 0)

    const earnedGross = roundCurrency(
        Math.max(
            0,
            baseGross +
                (Number(bonusAmount) || 0) +
                (Number(extraDayPayment) || 0) +
                (Number(extraShiftPayment) || 0) -
                safeAbsence
        )
    )

    const esiEligible = esiEnabled && (!esiLimitEnabled || baseGross <= ESI_STATUTORY_GROSS_LIMIT)
    const esiWage = esiEligible ? earnedGross : 0

    let esiEmployee = 0
    let esiEmployer = 0

    if (esiEligible) {
        if (esiMode === 'fixed') {
            const fixed = Math.max(0, Math.round(Number(config.esiFixedAmount) || 0))
            esiEmployee = fixed
            esiEmployer = fixed
        } else if (esiMode === 'statutory') {
            // ESIC standard: round up to next higher rupee
            esiEmployee = Math.ceil((esiWage * esiEmployeeRate) / 100)
            esiEmployer = Math.ceil((esiWage * esiEmployerRate) / 100)
        } else {
            esiEmployee = Math.round((esiWage * esiEmployeeRate) / 100)
            esiEmployer = Math.round((esiWage * esiEmployerRate) / 100)
        }
    }

    return {
        pfEnabled,
        pfMode,
        pfUan: config.pfUan?.trim() || null,
        pfCeilingEnabled,
        pfEmployeeRate,
        pfEmployerRate,
        pfWage,
        pfEmployee,
        pfEmployer,
        pfEmployerEpf,
        pfEmployerEps,
        esiEnabled,
        esiMode,
        esiNumber: config.esiNumber?.trim() || null,
        esiLimitEnabled,
        esiEligible,
        esiEmployeeRate,
        esiEmployerRate,
        esiWage,
        esiEmployee,
        esiEmployer,
        totalEmployeeStatutory: pfEmployee + esiEmployee,
        totalEmployerStatutory: pfEmployer + esiEmployer,
    }
}
