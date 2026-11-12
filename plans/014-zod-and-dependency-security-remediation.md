# Plan 014: Zod & Critical Dependency Security Vulnerability Remediation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- package.json`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / dependencies
- **Planned at**: commit `e3e8858`, 2026-11-11

## Why this matters

`pnpm audit` flags a high-severity vulnerability:
- `GHSA-mrhx-c7xc-m3w5`: Zod <4.6.6 can exhaust memory while validating oversized constrained collections, leading to Denial of Service (DoS) during input parsing.
In PayFix, `zod` parses incoming user attendance requests, payroll requests, and auth payloads. Upgrading to a patched version protects against malformed payload attacks.

## Current state

In `package.json`:
```json
"zod": "^4.4.3"
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Update zod | `pnpm update zod` | updates to safe version |
| Typecheck | `pnpm run typecheck` | exit 0, 0 errors |
| Test suite | `pnpm run test:post-merge` | exit 0, 18 pass |

## Scope

**In scope**:
- `package.json` & `pnpm-lock.yaml`

## Steps

### Step 1: Update Zod in package.json
Update `zod` to `>=4.6.6` (or latest stable v4) via `pnpm update zod`.

### Step 2: Verification
Run `pnpm audit --audit-level high` and `pnpm run typecheck` to verify no breaking type changes exist.
