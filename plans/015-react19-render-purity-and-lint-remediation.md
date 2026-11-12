# Plan 015: React 19 Render Purity & ESLint CI Gate Remediation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- features/shifts/ShiftManagementHub.tsx features/departments/DepartmentManagement.tsx features/users/components/BulkUserImportDialog.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / dx / tech-debt
- **Planned at**: commit `e3e8858`, 2026-11-11
- **Status**: **DONE** (Executed via Coarena `gemini-4-carbon`, request `req_qrAqAzqsa7NfOks7zPbWiAwR`, lint: 0 errors)

## Why this matters

In `features/shifts/ShiftManagementHub.tsx`, multiple `useState` setters are invoked directly inside a `useMemo` callback. In React 19 and Next.js 16, mutating state during the render phase violates hooks purity rules (`react-hooks/set-state-in-render`), threatens concurrent rendering stability, triggers potential infinite re-render loops, and fails `eslint --max-warnings=0` on CI with 9 errors and 6 warnings. Fixing this restores pure derived state and unblocks clean CI builds.

## Current state

- `features/shifts/ShiftManagementHub.tsx:230-244`:
  ```tsx
  useMemo(() => {
      if (userAssignments && userAssignments.length > 0) {
          const first = userAssignments[0]
          setAssignmentMode(userAssignments.length > 1 ? 'multi' : 'single')
          setChosenShiftIds(userAssignments.map(a => a.shift_id))
          setDailyDutyHours(Number(first.total_duty_hours) || 8)
          setRotationType((first.rotation_cycle as any) || 'none')
          setRotationShiftOrder(first.rotation_shift_ids || [])
      } else if (selectedUserId) {
          setChosenShiftIds([])
          setDailyDutyHours(8)
          setRotationType('none')
          setRotationShiftOrder([])
      }
  }, [userAssignments, selectedUserId])
  ```
- `features/departments/DepartmentManagement.tsx:766`:
  Unescaped quotes in JSX (`"`) triggering `react/no-unescaped-entities`.
- `features/users/components/BulkUserImportDialog.tsx:405`:
  Unescaped quotes in JSX (`"`) triggering `react/no-unescaped-entities`.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Typecheck | `pnpm typecheck`| exit 0, no errors   |
| Lint      | `pnpm lint`     | exit 0, 0 errors    |

## Scope

**In scope**:
- `features/shifts/ShiftManagementHub.tsx`
- `features/departments/DepartmentManagement.tsx`
- `features/users/components/BulkUserImportDialog.tsx`

**Out of scope**:
- Do not modify shift database schemas or tRPC routers (`lib/trpc/routers/shifts.ts`).
- Do not alter UI design or layout in shift management.

## Git workflow

- Branch: `advisor/015-react19-render-purity`
- Commit message: `fix(shifts): eliminate setState in useMemo and escape JSX entities`

## Detailed Implementation Steps

### Step 1: Refactor `ShiftManagementHub.tsx` state synchronization
Replace the impure `useMemo` block with proper `useEffect` synchronization or derived state:
```tsx
useEffect(() => {
    if (userAssignments && userAssignments.length > 0) {
        const first = userAssignments[0]
        setAssignmentMode(userAssignments.length > 1 ? 'multi' : 'single')
        setChosenShiftIds(userAssignments.map(a => a.shift_id))
        setDailyDutyHours(Number(first.total_duty_hours) || 8)
        setRotationType((first.rotation_cycle as any) || 'none')
        setRotationShiftOrder(first.rotation_shift_ids || [])
    } else if (selectedUserId) {
        setChosenShiftIds([])
        setDailyDutyHours(8)
        setRotationType('none')
        setRotationShiftOrder([])
    }
}, [userAssignments, selectedUserId])
```
Also ensure any memoized dependency arrays (such as `users` list) are properly memoized to satisfy `react-hooks/exhaustive-deps`.

### Step 2: Escape JSX entities in `DepartmentManagement.tsx` and `BulkUserImportDialog.tsx`
Replace literal `"` with `&quot;` in affected paragraph / span text at lines indicated by ESLint.

### Step 3: Run Verification
```bash
pnpm run lint
pnpm run typecheck
```
Expected: `eslint --max-warnings=0` exits with code 0.

## STOP conditions

- If changing `useMemo` to `useEffect` causes infinite re-render loops due to unstable object references in `userAssignments`, stop and derive the initial values directly or use a custom comparator.
