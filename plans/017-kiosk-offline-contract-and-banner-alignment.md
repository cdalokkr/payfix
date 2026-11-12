# Plan 017: Kiosk Offline Contract & Banner Alignment

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- app/kiosk/page.tsx features/attendance/ExpressKioskApp.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: [x] DONE (Verified with ESLint --max-warnings=0 and TypeScript tsc --noEmit)
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: ux / correctness
- **Planned at**: commit `e3e8858`, 2026-11-11

## Why this matters

There is a direct product mismatch between what the Kiosk UI displays and how the server-only 1:N verification engine operates. In `app/kiosk/page.tsx`, the top banner declares: *"Kiosk Offline Mode: All employee selfie attendance punches are saved locally and will auto-sync."* However, `ExpressKioskApp.tsx` explicitly documents that server-only 1:N face matching does not support offline selfie classification, and network disconnection renders verification unavailable. When the internet drops, users expect their punches to be queued, but the camera modal fails to process. Aligning the banner and providing an emergency MPIN/Badge offline punch path restores user trust and operational clarity.

## Current state

- `app/kiosk/page.tsx:13`:
  ```tsx
  <OfflineBanner message="Kiosk Offline Mode: All employee selfie attendance punches are saved locally and will auto-sync." />
  ```
- `features/attendance/ExpressKioskApp.tsx:759`:
  ```tsx
  // attendance event. There is deliberately no offline punch fallback.
  ```
- `features/attendance/ExpressKioskApp.tsx:1016`:
  ```tsx
  <WifiOff className="h-3 w-3" /> Offline — verification unavailable
  ```

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Typecheck | `pnpm typecheck`| exit 0, no errors   |
| Lint      | `pnpm lint`     | exit 0, no errors   |

## Scope

**In scope**:
- `app/kiosk/page.tsx`
- `features/attendance/ExpressKioskApp.tsx`

**Out of scope**:
- Do not modify the server-side biometric verification endpoint ([`app/api/kiosk/verify-face/route.ts`](file:///d:/payfix/app/api/kiosk/verify-face/route.ts)).
- Do not store raw 512-d face vectors on the client.

## Git workflow

- Branch: `advisor/017-kiosk-offline-banner-alignment`
- Commit message: `fix(kiosk): align offline banner with server-only biometric verification contract`

## Detailed Implementation Steps

### Step 1: Update Offline Banner messaging in `app/kiosk/page.tsx`
Change the banner copy to accurately communicate status:
```tsx
<OfflineBanner message="Kiosk Offline: Internet connection required for server-side facial verification. Reconnect to resume automatic punches." />
```

### Step 2: Ensure Kiosk Camera Reticle shows clear Offline state
In `features/attendance/ExpressKioskApp.tsx`, when `!isOnline`, ensure the camera interface does not continuously retry and lock the video stream, but clearly displays the amber badge and instructs the user:
```tsx
{/* Offline indicator on reticle */}
{!isOnline && (
  <div className="absolute inset-x-0 bottom-4 text-center px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-medium">
    Network disconnected. Automatic face verification will resume once connectivity is restored.
  </div>
)}
```

### Step 3: Run Verification
```bash
pnpm run typecheck
pnpm run lint
```

## STOP conditions
- Do not introduce client-side vector downloads or browser-side vector matching, as this breaks the server-only 1:N security architecture.
