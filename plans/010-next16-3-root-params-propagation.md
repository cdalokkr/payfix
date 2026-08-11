# Plan 010: Next.js 16.3 `next/root-params` Adoption in Server Components

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6831b50..HEAD -- app/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt / dx
- **Planned at**: commit `6831b50`, 2026-08-11

## Why this matters

Prior to Next.js 16.3, accessing root-level route parameters (like `[lang]`, `[tenant]`, or `[workspace]`) in deeply nested Server Components required passing params down through multiple layout levels via props drilling. Next.js 16.3 introduces `next/root-params`, allowing Server Components anywhere in the sub-tree to directly read root route parameters cleanly.

## Current state

- Deep Server Components receive parameters via component props passed down from top-level `page.tsx` or `layout.tsx`.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0, 0 errors    |
| Build     | `npm run build`    | exit 0, compiled successfully |

## Scope

**In scope**:
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/admin/tickets/[id]/page.tsx`

**Out of scope**:
- Client components (`'use client'`)

## Steps

### Step 1: Utilize `next/root-params` in Dynamic Server Components
Import `root-params` helpers in Server Components that require route parameter access:

```tsx
import { params } from 'next/root-params';

export async function ServerComponent() {
  const rootParams = await params();
  // Access root parameters cleanly
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Build & Validate
Execute `npm run build` to confirm Next.js 16.3 static/dynamic route generator compiles without parameter mismatch warnings.

**Verify**: `npm run build` → exit 0.

## Test plan

- Verify Server Components compile cleanly with `next/root-params`.
- Run `npm run typecheck` → 0 errors.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` status updated
