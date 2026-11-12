# Plan 013: Jest Haste Module Collision & Worktree Isolation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- jest.config.js`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: testing / dx
- **Planned at**: commit `e3e8858`, 2026-11-11

## Why this matters

When running Jest test suites (`pnpm test`), Jest's file crawler scans `.kilo/worktrees/diamond-gold/` and detects duplicate `package.json` files and test specifications.
This triggers:
1. `jest-haste-map: Haste module naming collision: my-fullstack-app`
2. Duplicate test execution (`.kilo/worktrees/diamond-gold/components/dashboard/admin-overview.test.tsx` and `components/dashboard/admin-overview.test.tsx`).
3. Slower test execution and sporadic CI failures.

## Current state

In `jest.config.js`:
```js
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  testEnvironment: 'jest-environment-jsdom',
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| List Jest Tests | `pnpm exec jest --listTests` | No collision warnings, 0 tests from `.kilo` |

## Scope

**In scope**:
- `jest.config.js` (add modulePathIgnorePatterns, testPathIgnorePatterns)

**Out of scope**:
- Deleting user worktrees in `.kilo/`

## Steps

### Step 1: Update jest.config.js
Add `modulePathIgnorePatterns` and update `testPathIgnorePatterns`:
```js
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/e2e/',
    '<rootDir>/.kilo/',
    '<rootDir>/.next/',
    '<rootDir>/python-service/',
    '<rootDir>/video-analytics-server/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.kilo/',
    '<rootDir>/.next/',
  ],
```

### Step 2: Verification
Run `pnpm exec jest --listTests` and ensure no `Haste module naming collision` warning is printed.
