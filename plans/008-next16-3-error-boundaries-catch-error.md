# Plan 008: Next.js 16.3 Custom Error Boundaries with `catchError` and `retry()`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6831b50..HEAD -- components/ui/error-boundary.tsx app/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt / dx
- **Planned at**: commit `6831b50`, 2026-08-11

## Why this matters

In previous Next.js versions, classic React Error Boundaries swallowed framework navigation primitives like `notFound()` and `redirect()`, forcing full page reloads or broken client states. Next.js 16.3 introduces `catchError` from `'next/error'`, which allows error boundaries to pass through `notFound()` and `redirect()` while exposing `retry()` to re-render Server Components cleanly on error recovery.

## Current state

- `components/ui/error-boundary.tsx` contains a classic React Class component `ErrorBoundary`.
- `app/(dashboard)/admin/page.tsx` wraps `AdminDashboardStreaming` in `<PageErrorBoundary>`.
- `app/(dashboard)/moderator/page.tsx` wraps `UserDashboardStreaming` in `<PageErrorBoundary>`.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0, 0 errors    |
| Build     | `npm run build`    | exit 0, compiled successfully |
| Tests     | `npm test`         | exit 0, all pass    |

## Scope

**In scope**:
- `components/ui/error-boundary.tsx`
- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/moderator/page.tsx`

**Out of scope**:
- Database schemas in `lib/db/schema.ts`
- Auth context in `lib/auth/`

## Steps

### Step 1: Implement Next.js 16.3 `catchError` Error Fallback Component
In `components/ui/error-boundary.tsx`, export a Next.js 16.3 error boundary wrapped with `catchError`:

```tsx
'use client';

import React from 'react';
import { catchError, type ErrorInfo } from 'next/error';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ErrorFallback(
  props: { title?: string },
  { error, retry }: ErrorInfo
) {
  return (
    <div className="p-6 m-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center space-y-4">
      <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
      <h3 className="text-lg font-semibold text-foreground">
        {props.title || 'Something went wrong'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {error.message || 'An unexpected error occurred while loading this section.'}
      </p>
      <Button
        onClick={() => retry()}
        variant="outline"
        className="gap-2 border-destructive/30 hover:bg-destructive/10"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </Button>
    </div>
  );
}

export const Next16ErrorBoundary = catchError(ErrorFallback);
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Integrate `Next16ErrorBoundary` into Dashboard Pages
Update `app/(dashboard)/admin/page.tsx` and `app/(dashboard)/moderator/page.tsx` to utilize `Next16ErrorBoundary` for instant server re-render recovery upon clicking "Try Again".

**Verify**: `npm run build` → exit 0, `npm test` → all pass.

## Test plan

- Verify that `Next16ErrorBoundary` renders fallback UI on error.
- Verify `retry()` triggers server component re-evaluation.
- Run `npm test` → all unit tests pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `components/ui/error-boundary.tsx` exports `catchError`-backed boundary
- [ ] `plans/README.md` status updated

## STOP conditions

- If `next/error` module fails to export `catchError` in environment, stop and verify `next` package version is `16.3.0`.
