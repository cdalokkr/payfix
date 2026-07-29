# Plan 001: Baseline Testing & Type Safety Hardening

## Overview
Establish strict baseline commands for TypeScript type-checking and automated tests, ensuring any future code changes are machine-verifiable before commit or deployment.

- **Target File**: `package.json`
- **Category**: DX / Testing
- **Impact**: High
- **Effort**: Small
- **Status**: **NEEDS_TYPE_FIXES** (Pre-existing Drizzle ORM & tRPC router type mismatches detected)

---

## Audit Findings during Verification
Running `npm run typecheck` revealed 79 pre-existing TypeScript type mismatches in:
- `lib/services/salary.service.ts` (Array type inference in salary calculations)
- `lib/trpc/routers/admin-reports.ts`, `clients.ts`, `complaints.ts`, `tickets.ts` (Drizzle `SQL<unknown>` parameter types)
- `scripts/clear-advances.ts`, `phase3-validation.ts` (Script utility types)

---

## Proposed Action
1. Created **[Plan 004](./004-fix-drizzle-trpc-types.md)** to resolve these Drizzle & tRPC type mismatches cleanly without breaking runtime SQL queries.
2. Hardened `package.json` with `"typecheck": "tsc --noEmit"` so type errors are tracked transparently.
