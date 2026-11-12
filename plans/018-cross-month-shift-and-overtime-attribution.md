# Plan 018: Cross-Month Shift Overtime Attribution & Payslip Audit Lock

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- lib/services/salary.service.ts lib/utils/attendance-extra-hours.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: [x] DONE (Consulted gemini-4-carbon req_HWFPvsfvKBSV6wuvYOcrEyYX, rated good; tested & verified with tsc and eslint)
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: correctness / payroll
- **Planned at**: commit `e3e8858`, 2026-11-11

## Why this matters

In `lib/services/salary.service.ts`, two payroll integrity risks exist:
1. When night shifts cross midnight from the last day of one month into the first day of the next month (e.g. 10:00 PM Oct 31 to 06:00 AM Nov 1), hours worked past midnight fall under `date = Oct 31` while check-out happens in November. Without explicit attribution rules, cross-month attendance runs risk of orphan hours or duplicate attribution across month compilations.
2. In `updateAndRecalculateSummary()`, if an admin runs recompile on a month where `status === 'payslip_generated'`, the system automatically recalculates gross and net earnings and overwrites the row. If an employee was already paid and downloaded their PDF payslip, this causes a discrepancy between the financial audit ledger and the database. A strict lock or explicit unfinalize prompt is required.

## Current state

- `lib/services/salary.service.ts`:
  ```ts
  if (existingSummary.status === 'payslip_generated') {
      const salarySetup = await this.getActiveSalaryForPeriod(...)
      // Recalculates and updates financial figures in monthlyAttendanceSummary
  ```
- `lib/utils/attendance-extra-hours.ts:83-109`:
  Calculates extra hours based on `refDate = checkIn ? new Date(checkIn) : ...` without explicit month-boundary split flags.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Tests     | `pnpm run test:post-merge`| exit 0, all pass   |

## Scope

**In scope**:
- `lib/services/salary.service.ts`
- `lib/utils/attendance-extra-hours.ts`

**Out of scope**:
- Do not modify frontend payslip rendering or PDF generation libraries (`jspdf`, `jspdf-autotable`).
- Do not alter Drizzle schema definitions for `monthly_attendance_summary`.

## Git workflow

- Branch: `advisor/018-payroll-audit-lock`
- Commit message: `feat(payroll): guard payslip_generated summaries against silent recompile overwrites`

## Detailed Implementation Steps

### Step 1: Guard `payslip_generated` summaries from silent overwrite in bulk recompile
In `compileMonthlyAttendance`, when `existingSummary.status === 'payslip_generated'`:
```ts
if (existingSummary.status === 'payslip_generated') {
    // If not explicitly triggered for single employee with forceRecalculate flag, preserve finalized payslip
    if (!profileId) {
        results.push(existingSummary);
        continue;
    }
}
```

### Step 2: Ensure cross-month night shift attribution is deterministic
In `lib/utils/attendance-extra-hours.ts`, verify that `isOvernight` shifts crossing midnight allocate all scheduled duty hours and bounded overtime strictly to the shift's initiating punch date (`attendance.date`), preventing November compilation from claiming the post-midnight hours of an October 31 shift.

### Step 3: Run Verification
```bash
pnpm run typecheck
pnpm run test:post-merge
```

## STOP conditions
- If existing tests fail due to expecting `compileMonthlyAttendance` to mutate finalized summaries, add a `force: boolean` parameter to the method signature defaulting to `false`.
