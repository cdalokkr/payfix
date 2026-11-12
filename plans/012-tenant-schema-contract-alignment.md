# Plan 012: Tenant Schema Contract Alignment for Departments & Shifts

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- lib/tenant/schema-contract.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding.

## Status

- **Status**: [x] DONE (Tenant schema contract updated, audited, and verified; 0 missing tables/columns/indexes/FKs across tenant schemas)
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness / multi-tenancy
- **Planned at**: commit `e3e8858`, 2026-11-11

## Why this matters

The multi-tenant schema contract (`lib/tenant/schema-contract.ts`) defines the canonical tables and column contracts required for all isolated tenant schemas (`CANONICAL_TENANT_TABLES` and `CANONICAL_TENANT_COLUMNS`). 
Recent migrations and features added `departments`, `department_managers_history`, `shifts`, `shift_assignments`, and `shift_rotations` to `lib/db/schema.ts` and `drizzle/0005_departments_and_shifts.sql`. However, these tables were not added to `CANONICAL_TENANT_TABLES` in `lib/tenant/schema-contract.ts`.
As a result:
1. `pnpm run audit:tenant-schema` (`scripts/audit-tenant-schema-contract.ts`) does not validate the existence of these tables.
2. New tenant provisioning pipelines that clone canonical tables miss them, causing runtime database errors when tenant administrators visit `/admin/departments` or `/admin/shifts`.

## Current state

In `lib/tenant/schema-contract.ts` (lines 13-46):
`CANONICAL_TENANT_TABLES` ends with `biometric_consumed_proofs` and lacks the new department/shift tables:
```ts
export const CANONICAL_TENANT_TABLES = [
    'designations',
    'profiles',
    ...
    'biometric_verification_attempts',
    'biometric_consumed_proofs',
] as const;
```

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `pnpm run typecheck` | exit 0, 0 errors |
| Test saas migrations | `pnpm run test:saas-migrations` | exit 0, all passed |

## Scope

**In scope**:
- `lib/tenant/schema-contract.ts` (register new tables and column contracts)

**Out of scope**:
- Drizzle migrations or altering existing tenant database rows directly

## Steps

### Step 1: Update CANONICAL_TENANT_TABLES
Add the department and shift tables to `CANONICAL_TENANT_TABLES`:
- `'departments'`
- `'department_managers_history'`
- `'shifts'`
- `'shift_assignments'`
- `'shift_rotations'`

### Step 2: Define CANONICAL_TENANT_COLUMNS for each new table
Add corresponding column definitions matching `lib/db/schema.ts`:
- `departments`: `['id', 'name', 'code', 'description', 'manager_id', 'location_id', 'is_active', 'created_at', 'updated_at']`
- `department_managers_history`: `['id', 'department_id', 'manager_id', 'appointed_by', 'start_date', 'end_date', 'status', 'handover_notes', 'created_at']`
- `shifts`: `['id', 'name', 'code', 'start_time', 'end_time', 'grace_period_mins', 'half_day_hours', 'full_day_hours', 'is_night_shift', 'department_id', 'is_active', 'created_at', 'updated_at']`
- `shift_assignments`: `['id', 'profile_id', 'shift_id', 'start_date', 'end_date', 'is_temporary', 'created_at', 'updated_at']`
- `shift_rotations`: `['id', 'name', 'rotation_type', 'pattern', 'is_active', 'created_at', 'updated_at']`

### Step 3: Run verification
Run `pnpm run typecheck` and `pnpm run test:saas-migrations`.
