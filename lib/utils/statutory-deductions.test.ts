import { calculateStatutoryDeductions } from './statutory-deductions'

describe('calculateStatutoryDeductions', () => {
    const baseConfig = {
        basicSalary: 12000,
        hra: 4000,
        da: 2000,
        ta: 1000,
        specialAllowance: 1000,
        incentive: 0,
        pfEnabled: false,
        esiEnabled: false,
    }

    it('returns zero PF and ESI when both are disabled (optional behavior)', () => {
        const result = calculateStatutoryDeductions({
            config: baseConfig,
            absenceDeduction: 0,
        })

        expect(result.pfEnabled).toBe(false)
        expect(result.pfEmployee).toBe(0)
        expect(result.pfEmployer).toBe(0)
        expect(result.esiEnabled).toBe(false)
        expect(result.esiEmployee).toBe(0)
        expect(result.esiEmployer).toBe(0)
        expect(result.totalEmployeeStatutory).toBe(0)
    })

    it('computes statutory PF (12% + 12%, EPF 3.67% / EPS 8.33%) and ESI (0.75% / 3.25%) on full month wages', () => {
        // Basic + DA = 14000 (<= 15000 ceiling), Gross = 20000 (<= 21000 limit)
        const result = calculateStatutoryDeductions({
            config: {
                ...baseConfig,
                pfEnabled: true,
                pfUan: '100998877665',
                pfMode: 'statutory',
                pfCeilingEnabled: true,
                esiEnabled: true,
                esiNumber: '3112345678',
                esiMode: 'statutory',
                esiLimitEnabled: true,
            },
            absenceDeduction: 0,
        })

        expect(result.pfWage).toBe(14000)
        expect(result.pfEmployee).toBe(1680) // 12% of 14000
        expect(result.pfEmployer).toBe(1680)
        expect(result.pfEmployerEps).toBe(1166) // round(14000 * 8.33%)
        expect(result.pfEmployerEpf).toBe(514)

        expect(result.esiEligible).toBe(true)
        expect(result.esiWage).toBe(20000)
        expect(result.esiEmployee).toBe(150) // ceil(20000 * 0.75%)
        expect(result.esiEmployer).toBe(650) // ceil(20000 * 3.25%)
        expect(result.totalEmployeeStatutory).toBe(1830)
    })

    it('pro-rates PF and ESI on earned monthly wages after absence deductions', () => {
        // Base Gross = 20000, absence = 5000 => earned ratio = 0.75
        // Earned Basic + DA = 14000 * 0.75 = 10500
        // Earned Gross = 15000
        const result = calculateStatutoryDeductions({
            config: {
                ...baseConfig,
                pfEnabled: true,
                pfMode: 'statutory',
                pfCeilingEnabled: true,
                esiEnabled: true,
                esiMode: 'statutory',
                esiLimitEnabled: true,
            },
            absenceDeduction: 5000,
        })

        expect(result.pfWage).toBe(10500)
        expect(result.pfEmployee).toBe(1260) // 12% of 10500
        expect(result.esiWage).toBe(15000)
        expect(result.esiEmployee).toBe(113) // ceil(112.5)
        expect(result.esiEmployer).toBe(488) // ceil(487.5)
    })

    it('enforces ₹15,000 PF wage ceiling when enabled and allows uncapped PF when disabled', () => {
        const capped = calculateStatutoryDeductions({
            config: {
                ...baseConfig,
                basicSalary: 25000,
                da: 0,
                pfEnabled: true,
                pfMode: 'statutory',
                pfCeilingEnabled: true,
            },
            absenceDeduction: 0,
        })
        expect(capped.pfWage).toBe(15000)
        expect(capped.pfEmployee).toBe(1800)
        expect(capped.pfEmployerEps).toBe(1250)
        expect(capped.pfEmployerEpf).toBe(550)

        const uncapped = calculateStatutoryDeductions({
            config: {
                ...baseConfig,
                basicSalary: 25000,
                da: 0,
                pfEnabled: true,
                pfMode: 'statutory',
                pfCeilingEnabled: false,
            },
            absenceDeduction: 0,
        })
        expect(uncapped.pfWage).toBe(25000)
        expect(uncapped.pfEmployee).toBe(3000)
        expect(uncapped.pfEmployerEps).toBe(1250)
        expect(uncapped.pfEmployerEpf).toBe(1750)
    })

    it('respects ₹21,000 ESI eligibility ceiling unless override is turned off', () => {
        const excluded = calculateStatutoryDeductions({
            config: {
                ...baseConfig,
                basicSalary: 18000, // baseGross = 26000 > 21000
                esiEnabled: true,
                esiMode: 'statutory',
                esiLimitEnabled: true,
            },
            absenceDeduction: 0,
        })
        expect(excluded.esiEligible).toBe(false)
        expect(excluded.esiEmployee).toBe(0)
        expect(excluded.esiEmployer).toBe(0)

        const forced = calculateStatutoryDeductions({
            config: {
                ...baseConfig,
                basicSalary: 18000,
                esiEnabled: true,
                esiMode: 'statutory',
                esiLimitEnabled: false,
            },
            absenceDeduction: 0,
        })
        expect(forced.esiEligible).toBe(true)
        expect(forced.esiWage).toBe(26000)
        expect(forced.esiEmployee).toBe(195)
    })

    it('supports custom percentage and fixed overrides', () => {
        const result = calculateStatutoryDeductions({
            config: {
                ...baseConfig,
                pfEnabled: true,
                pfMode: 'fixed',
                pfFixedAmount: 1500,
                esiEnabled: true,
                esiMode: 'percentage',
                esiEmployeeRate: 1.0,
                esiEmployerRate: 4.0,
                esiLimitEnabled: true,
            },
            absenceDeduction: 0,
        })

        expect(result.pfEmployee).toBe(1500)
        expect(result.pfEmployer).toBe(1500)
        expect(result.esiEmployee).toBe(200)
        expect(result.esiEmployer).toBe(800)
    })
})
