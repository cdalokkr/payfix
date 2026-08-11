# Plan 009: React 19 / Next.js 16.3 Server Action Transitions & Optimistic UI Updates

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6831b50..HEAD -- components/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf / dx
- **Planned at**: commit `6831b50`, 2026-08-11

## Why this matters

Async actions in client components (e.g. ticket updates, attendance submission, status changes) often rely on manual `useState(isLoading)` flags. This causes UI latency and button state flickering during network roundtrips. React 19 & Next.js 16.3 provide `useTransition` (`isPending`, `startTransition`) and `useOptimistic` to show immediate responsive updates on user interactions with automatic fallback on failure.

## Current state

- Client action components manage loading states with `const [loading, setLoading] = useState(false)`.
- UI updates wait for server response before re-rendering the updated list or item status.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0, 0 errors    |
| Build     | `npm run build`    | exit 0, compiled successfully |
| Tests     | `npm test`         | exit 0, all pass    |

## Scope

**In scope**:
- `components/tickets/ticket-detail-page.tsx`
- `app/(mobile)/mobile/attendance/mobile-attendance-client.tsx`

**Out of scope**:
- Database schemas in `lib/db/schema.ts`
- Supabase auth functions in `lib/supabase/`

## Steps

### Step 1: Refactor Action Handlers to `useTransition` and `useOptimistic`
In `components/tickets/ticket-detail-page.tsx`:
1. Import `useTransition` and `useOptimistic` from `'react'`.
2. Wrap ticket status mutations in `startTransition(async () => { ... })`.
3. Use `useOptimistic` to render the target ticket status instantly while the Server Action resolves.

```tsx
const [isPending, startTransition] = useTransition();
const [optimisticTicket, setOptimisticTicket] = useOptimistic(
  ticket,
  (current, newStatus: string) => ({ ...current, status: newStatus })
);
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Integrate Optimistic Feedback in Attendance Marking
In `app/(mobile)/mobile/attendance/mobile-attendance-client.tsx`:
Wrap clock-in/clock-out actions with `startTransition` and optimistic state feedback to prevent rapid tap double-submits.

**Verify**: `npm run build` → exit 0, `npm test` → all pass.

## Test plan

- Test ticket status change: UI updates immediately without spinner delays.
- Test failure scenario: UI reverts gracefully to real state on error.
- Run `npm test` → all unit tests pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `useTransition` and `useOptimistic` integrated into ticket detail and attendance client components
- [ ] `plans/README.md` status updated

## STOP conditions

- If `useOptimistic` throws a React runtime hook error, verify that component has `'use client'` directive.
