/** @jest-environment node */

describe('Payroll precision & leave calculation tests (DATA-01 & PAY-01)', () => {
  describe('PAY-01: Calendar days per-day salary rate calculation', () => {
    function calculateSalaryMetrics({
      basicSalary = 30000,
      hra = 0,
      month,
      year,
      absentDays = 0,
      halfDays = 0,
      extraDays = 0,
      multiplier = 1,
    }: {
      basicSalary?: number
      hra?: number
      month: number
      year: number
      absentDays?: number
      halfDays?: number
      extraDays?: number
      multiplier?: number
    }) {
      const grossSalary = basicSalary + hra
      const calendarDays = new Date(year, month, 0).getDate()
      const perDayRate = grossSalary / calendarDays
      const absentDeduction = absentDays * multiplier * perDayRate
      const halfDayDeduction = halfDays * 0.5 * perDayRate
      const extraDayPayment = extraDays * perDayRate
      const netSalary = grossSalary + extraDayPayment - (absentDeduction + halfDayDeduction)

      return {
        calendarDays,
        perDayRate,
        grossSalary,
        absentDeduction,
        halfDayDeduction,
        extraDayPayment,
        netSalary,
      }
    }

    it('calculates per-day rate strictly based on 28 calendar days for February (non-leap year)', () => {
      // February 2025 has 28 days
      const result = calculateSalaryMetrics({
        basicSalary: 28000,
        month: 2,
        year: 2025,
        absentDays: 1,
      })

      expect(result.calendarDays).toBe(28)
      expect(result.perDayRate).toBe(1000)
      expect(result.absentDeduction).toBe(1000)
      expect(result.netSalary).toBe(27000)
    })

    it('calculates per-day rate strictly based on 30 calendar days for April', () => {
      // April 2026 has 30 days
      const result = calculateSalaryMetrics({
        basicSalary: 30000,
        month: 4,
        year: 2026,
        absentDays: 2,
        halfDays: 2,
      })

      expect(result.calendarDays).toBe(30)
      expect(result.perDayRate).toBe(1000)
      expect(result.absentDeduction).toBe(2000)
      expect(result.halfDayDeduction).toBe(1000) // 2 * 0.5 * 1000 = 1000
      expect(result.netSalary).toBe(27000)
    })

    it('calculates per-day rate strictly based on 31 calendar days for March', () => {
      // March 2026 has 31 days
      const result = calculateSalaryMetrics({
        basicSalary: 31000,
        month: 3,
        year: 2026,
        absentDays: 1,
      })

      expect(result.calendarDays).toBe(31)
      expect(result.perDayRate).toBe(1000)
      expect(result.absentDeduction).toBe(1000)
      expect(result.netSalary).toBe(30000)
    })
  })

  describe('DATA-01: Decimal leaves validation & precision', () => {
    function isValidExcelLeaveValue(value: any): boolean {
      if (value === undefined || value === null || value === '') return true
      const num = Number(value)
      if (isNaN(num) || num < 0) return false
      return Math.round(num * 10) % 5 === 0
    }

    it('accepts valid integer and half-day decimal leave multiples of 0.5', () => {
      expect(isValidExcelLeaveValue(0)).toBe(true)
      expect(isValidExcelLeaveValue(0.5)).toBe(true)
      expect(isValidExcelLeaveValue(1)).toBe(true)
      expect(isValidExcelLeaveValue(1.5)).toBe(true)
      expect(isValidExcelLeaveValue(2.0)).toBe(true)
      expect(isValidExcelLeaveValue(2.5)).toBe(true)
      expect(isValidExcelLeaveValue('0.5')).toBe(true)
      expect(isValidExcelLeaveValue('1.5')).toBe(true)
      expect(isValidExcelLeaveValue('')).toBe(true)
    })

    it('rejects invalid leave values that are not multiples of 0.5 or are negative', () => {
      expect(isValidExcelLeaveValue(0.3)).toBe(false)
      expect(isValidExcelLeaveValue(1.2)).toBe(false)
      expect(isValidExcelLeaveValue(1.75)).toBe(false)
      expect(isValidExcelLeaveValue(-0.5)).toBe(false)
      expect(isValidExcelLeaveValue(-1)).toBe(false)
      expect(isValidExcelLeaveValue('abc')).toBe(false)
    })

    it('formats decimal leaves properly without integer truncation', () => {
      const leaves = [0.5, 1.0, 1.5, 2.5]
      const formatted = leaves.map(l => String(l))
      expect(formatted).toEqual(['0.5', '1', '1.5', '2.5'])

      const displayFormatted = leaves.map(l => String(Number(l)))
      expect(displayFormatted).toEqual(['0.5', '1', '1.5', '2.5'])
    })
  })
})
