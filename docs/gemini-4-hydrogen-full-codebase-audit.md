# PayFix Comprehensive Codebase Audit Report (Gemini 4 Hydrogen)

- **Date:** 2026-11-12T20:58:59.679Z
- **Model:** gemini-4-hydrogen
- **Auditor:** Google AI Studio (Gemini 4 Hydrogen with Native Reasoning)
- **Branch:** develop
- **Scope:** Option C — Architecture, Multi-Tenant Security, Biometric Pipeline, Payroll Engine, Next.js 16

---

# PayFix — Principal Security & Architecture Audit Report

**Scope Audited:** `package.json`, `next.config.ts`, `lib/services/attendance.service.ts`, `lib/services/salary.service.ts`, `lib/services/shifts.service.ts`, `lib/services/profile.service.ts`, `app/api/biometric/sync/route.ts`, `lib/tenant/schema-contract.test.ts`  
*(Note: Referenced modules not included in the context bundle—such as `lib/db`, `lib/biometric-attendance-proof`, `lib/biometric-enrollment-proof`, `lib/cache/smart-cache`, and tRPC routers—are explicitly flagged where their contracts impact the audited surface.)*

---

## 1. Executive Summary & Health Score

| Dimension | Score | Status |
| :--- | :---: | :--- |
| 1. Multi-Tenant Security & Tenant Isolation | **48 / 100** | Critical Risks |
| 2. Biometric Attendance Verification & Edge Cases | **42 / 100** | Critical Risks |
| 3. Payroll & Salary Calculation Accuracy | **52 / 100** | High Risks |
| 4. Next.js 16 & Turbopack Architecture | **64 / 100** | Medium Risks |
| 5. Type Safety, Error Handling & Resilience | **50 / 100** | High Risks |
| **Overall Codebase Health Score** | **51 / 100** | **Action Required Prior to Scale** |

### Executive Assessment
PayFix has a solid foundational schema-per-tenant design (`tenant_<slug>`, verified in `lib/tenant/schema-contract.test.ts`), atomic active-session partial unique indexing (`attendance_sessions_one_active_per_profile_day`), and `FOR UPDATE` row locking in `SalaryService.markSalaryPaid`. However, **multiple critical defects in service boundaries, biometric sync state handling, and payroll transaction safety** currently expose the platform to:
1. **Cross-tenant & suspended-tenant bypasses** via fail-open subscription checks, `trusted: true` override in hardware sync, global `ProfileService.isSchemaEnsured` state, and unscoped Supabase `SERVICE_ROLE_KEY` writes to `public.profiles` / `auth.users`.
2. **Biometric & geofence bypasses** via caller-controlled `source` parameters in `AttendanceService.clockIn`/`clockOut` and swallowed non-unique errors in `biometricConsumedProofs`.
3. **Corrupted attendance & payroll calculations** caused by discarding hardware `punchTime` in `/api/biometric/sync`, unsorted punch ingestion, UTC-vs-local `.getDay()` shifts, paying unverified (`pending`) and `rejected` extra-shift records, and non-transactional `generatePayslips` execution.
4. **Denial-of-Service & IDOR vectors** in `AttendanceService.getAttendance` (broken 31-day cap logic), `AttendanceService.batchUpdateAttendanceSessions` (missing `attendance_id` constraint), and `SalaryService.markSalaryPaid` (unvalidated negative/NaN `paidAmount`).

---

## 2. Critical & High Severity Findings

### [F-01] CRITICAL — Biometric Hardware Sync Corrupts Timestamps, Inverts Punches, & Bypasses License Expiry
**File:** `app/api/biometric/sync/route.ts`

1. **Discarded Hardware `punchTime`:** `punchTime` is parsed via `parseBiometricTimestamp(log.timestamp)` and logged to `biometricRawLogs`, but is **never passed** to `AttendanceService.clockIn()` or `AttendanceService.clockOut()`. Both methods record `const now = new Date()`. Offline-queued or delayed hardware punches permanently corrupt check-in/out times, overtime, and late calculations.
2. **Unsorted Batch Ingestion & `punchType` Inversion:** `for (const log of body.logs)` iterates in arbitrary array order. If `[Check-Out, Check-In]` arrives, the state machine inverts. Worse, if no active session exists and `log.punchType === 1` (explicit Check-Out), the `else` branch calls `AttendanceService.clockIn()`, turning a check-out into a check-in.
3. **Suspended/Expired License & Deactivated Device Bypass:**
   ```ts
   if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled') { ... }
   const tenantContext = { ..., trusted: true };
   ```
   `tenant.license_expires_at` is never checked, and `trusted: true` causes `AttendanceService.assertActiveSubscription()` to immediately return. Additionally, `biometricDevices` is queried solely by `serial_number` without checking `device.status`; a deactivated device self-reactivates (`status: 'active'`) on sync.
4. **Unbounded Payload DoS & Missing Deduplication:** `body.logs` has no length cap, and duplicate retries re-insert `biometricRawLogs` and can toggle punches.

---

### [F-02] CRITICAL — Biometric Proof & Geofence Bypass via `source` Parameter + Fail-Open Guards
**File:** `lib/services/attendance.service.ts`

1. **`source` Parameter Bypass:**
   ```ts
   static async clockIn({ ..., source = 'mobile', ... }) {
       ...
       if (source === 'mobile') {
           consumedProof = consumeAttendanceProof(...)
           if (!consumedProof) throwAppError('FORBIDDEN', ...)
       }
       ...
       if (source === 'mobile') {
           // Strict Geofencing
       }
   ```
   The exact same pattern exists in `clockOut`. Any caller capable of influencing `source` (e.g., passing `'kiosk'`, `'biometric'`, or `'manual'`) completely bypasses biometric liveness/proof consumption, strict geofencing, and `biometricConsumedProofs` replay protection.
2. **Swallowed Proof DB Errors & Two-Step Consumption:**
   ```ts
   try {
       await tx.insert(biometricConsumedProofs).values({ ... })
   } catch (err: any) {
       if (err?.code === '23505' || err?.cause?.code === '23505') {
           throwAppError('FORBIDDEN', 'This biometric attendance proof has already been used.')
       }
   }
   ```
   Non-`23505` database errors (e.g., missing table or constraint error) are silently swallowed inside the transaction, which also puts PostgreSQL into an aborted transaction state (`25P02`) on subsequent queries or fails open. Moreover, `consumeAttendanceProof` runs *before* geofencing and DB writes—burning valid proofs on failed geofence checks and relying on single-instance memory prior to the DB insert.
3. **Fail-Open Subscription Check:**
   In `assertActiveSubscription()`:
   ```ts
   if (!tenantStore || !tenantStore.tenantId || tenantStore.trusted) return;
   ...
   } catch (err: any) {
       if (err?.code === 'FORBIDDEN' || err?.statusCode === 403) throw err;
   }
   ```
   Missing `tenantStore` silently permits execution (likely hitting `public` schema), and any `masterDb` outage/timeout fails open instead of rejecting.

---

### [F-03] CRITICAL — Date-Range Cap Bypass DoS & Broken `getDay()` Timezone Arithmetic
**File:** `lib/services/attendance.service.ts` (and `lib/services/salary.service.ts`)

1. **Broken 31-Day Cap Causes Unbounded Memory Exhaustion (DoS):**
   In `AttendanceService.getAttendance`:
   ```ts
   const diffTime = Math.abs(end.getTime() - start.getTime())
   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
   if (diffDays > 31) {
       start.setDate(end.getDate() - 31)
   }
   ```
   `start.setDate(end.getDate() - 31)` only changes the **day-of-month** of `start`, retaining `start`'s original year and month! Passing `startDate=1970-01-01` and `endDate=2026-08-30` sets `start` to `1969-12-30` and iterates `while (curr <= end)` for **20,697 days × every active employee**, exhausting Node heap memory. Furthermore, invalid date formats (`NaN`) are not validated.
2. **UTC-vs-Local `.getDay()` Off-By-One Bug Across Attendance & Payroll:**
   `new Date('YYYY-MM-DD')` parses as **UTC midnight**, whereas `.getDay()` reads the **server's local timezone**. On any server running behind UTC (e.g., `America/New_York`), `new Date('2026-08-30').getDay()` evaluates to Saturday (`6`) instead of Sunday (`0`), misclassifying weekly offs and extra working days in:
   - `AttendanceService.getAttendance`: `const dateObj = new Date(dateStr); const dayOfWeek = dateObj.getDay()`
   - `AttendanceService.clockIn`: `const dayOfWeek = new Date(today).getDay()`
   - `AttendanceService.verifyAttendance` / `bulkVerifyAttendance` / `manualUpdate`: `new Date(recordDate).getDay()`
   - `AttendanceService.bulkUploadDailyAttendance`: `new Date(record.date).getDay()`
   - `SalaryService.compileMonthlyAttendance`: `const dateObj = new Date(r.date); const dayOfWeek = dateObj.getDay()`

---

### [F-04] HIGH — Cross-Record Session IDOR in `batchUpdateAttendanceSessions`
**File:** `lib/services/attendance.service.ts`

```ts
await db.update(attendanceSessions)
    .set(updateFields)
    .where(eq(attendanceSessions.id, sess.id))
```
The update filters solely by `sess.id`, omitting `eq(attendanceSessions.attendance_id, attendanceId)`. A caller authorized to edit `attendanceId` A can supply a `sess.id` belonging to another employee's `attendance` record B and overwrite their timestamps and status. All updates should also run inside `db.transaction`.

---

### [F-05] HIGH — Cross-Tenant / Global Auth Metadata Mutation & Broken Schema Flag in `ProfileService`
**File:** `lib/services/profile.service.ts`

1. **Unscoped `SERVICE_ROLE_KEY` Sync:**
   In `reviewPhotoRequest()`, after approving a request inside the tenant schema, the service initializes a Supabase Admin client (`SUPABASE_SERVICE_ROLE_KEY`) and executes:
   ```ts
   await adminClient.from('profiles').update({ ... }).eq('id', request.profile_id)
   await adminClient.auth.admin.updateUserById(request.profile_id, { user_metadata: { ... } })
   ```
   There is no verification that `request.profile_id` in `public.profiles` or `auth.users` belongs to `tenantStorage.getStore()?.tenantId`, creating a cross-tenant overwrite risk if a profile UUID is tampered with or shared.
2. **Global Boolean Schema Flag Breaks Multi-Tenancy:**
   ```ts
   private static isSchemaEnsured = false
   ```
   Unlike `AttendanceService` and `ShiftService` (which use `Set<string>` keyed by `tenantSchema`), `ProfileService` uses a single process-wide boolean. When `ALLOW_RUNTIME_SCHEMA_FALLBACK === 'true'`, ensuring Tenant A permanently skips schema checks for Tenant B.
3. **Untrusted Liveness Default & Biometric Vector Leakage:**
   `createPhotoUpdateRequest` logs `liveness_passed: (diagnostics as any)?.liveness?.passed ?? true` (defaulting to `true` from client-supplied `diagnostics`), and `getProfile` / `getAllPhotoRequests` select full rows without excluding `face_embedding` / `face_embedding_512` / `pending_face_embedding_512` PII vectors.

---

### [F-06] HIGH — Non-Transactional Payroll Generation & Calculation Inaccuracies
**File:** `lib/services/salary.service.ts`

1. **Non-Transactional `generatePayslips` Race Condition:**
   `generatePayslips()` iterates over summaries outside `db.transaction`, updating `employeeAdvances`, `monthlyAttendanceSummary`, and carry-forward advances sequentially. Concurrent invocations can both read `status === 'set_for_salary'` and double-apply or corrupt `employeeAdvances` (`adjusted` vs `pending`). A mid-loop failure leaves `payslip_generated` saved with `advance_recovery` deducted while the advances remain `'pending'` (double-deducting the employee next month).
2. **Paying Unverified & Rejected Attendance/Extra Shifts:**
   - `compileMonthlyAttendance()` counts unverified punches:
     `const verifiedRecords = records.filter(r => r.check_in && (r.status === 'verified' || r.status === 'pending'))`
   - `generatePayslips()` queries `allExtraShifts` without filtering out `rejected` or `absent` statuses:
     `or(eq(attendance.is_extra_shift, true), isNotNull(attendance.extra_shift_type))`
     Employees whose extra shifts were rejected or marked absent still receive `extraShiftPayment`.
3. **Full-Month Absence Still Pays Off-Days:**
   `totalWorkingDays = lastDay` (e.g., 30), while `absentDays` only counts non-off-days/non-holidays (e.g., 26). An employee absent all 30 days receives `4/30` (13.33%) of gross salary unless `presentDays + halfDays === 0` is handled.
4. **Multi-Bonus Loss & Ledger Desync in `updateAndRecalculateSummary`:**
   - Line `const bonusRecord = await client.query.monthlyBonuses.findFirst(...)` drops all bonuses beyond the first record (whereas `compileMonthlyAttendance` and `generatePayslips` sum `findMany`).
   - Recalculating a `payslip_generated` summary wipes `paid_mode`, `pay_date`, `pay_reference_no`, `payment_remarks`, `paid_by`, `paid_at` to `null`, while leaving `paid_amount` and child `salary_payments` rows intact—corrupting the paybook balance.
5. **Negative/NaN Payment Exploit in `markSalaryPaid`:**
   `markSalaryPaid` checks `paidAmount > remainingBalance` but never validates `paidAmount > 0 && Number.isFinite(paidAmount)`. Passing `-5000` inserts a negative payment row and reduces `paid_amount`. Arithmetic also uses IEEE-754 floats instead of integer minor units (paise/cents).

---

### [F-07] HIGH — `next.config.ts` Header Rule Precedence Disables Static & Image Caching
**File:** `next.config.ts`

In `async headers()`, the catch-all rule `source: '/(.*)'` is declared **last**, after `/images/(.*)` and `/api/trpc/(.*)`. In Next.js, later header entries with matching keys override earlier ones:
- `/(.*)` applies `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` to **all routes**, overriding `/images/(.*)` (`public, max-age=86400...`) and breaking immutable browser/CDN caching on `/_next/static/(.*)` JS/CSS chunks.

---

### [F-08] HIGH — Stale Overnight Session Auto-Close & Unsynced Manual Updates
**File:** `lib/services/attendance.service.ts`

1. In `clockIn()`, if `activeSession.date !== today`, it sets `status: 'completed', check_out: activeSession.check_in` (0 hours) on `attendanceSessions` **without updating the parent `attendance` record** (leaving `current_session_status: 'checked_in'`), and can prematurely close valid overnight shifts (e.g., 22:00–06:00).
2. `manualUpdate()` hardcodes `+05:30` IST timestamps (`${recordDate}T${h}:${m}:00+05:30`) and updates `attendance.check_in`/`check_out` **without syncing `attendanceSessions` or recalculating `working_hours`**.

---

## 3. Medium & Low Severity Findings

| ID | File | Finding & Impact |
| :--- | :--- | :--- |
| **M-01** | `next.config.ts` | **Weak CSP & Dead Webpack Config:** `script-src` includes `'unsafe-inline'` and `'unsafe-eval'` alongside unpinned `https://cdn.jsdelivr.net`; `img-src` allows `https:` wildcard. Additionally, `webpack` `splitChunks` configuration is ignored because `package.json` runs `next build --turbopack`. |
| **M-02** | `app/api/biometric/sync/route.ts` | **Plaintext API Key Query:** `eq(tenants.biometric_api_key, token)` stores and compares API keys in plaintext rather than SHA-256 hashes with constant-time comparison. |
| **M-03** | `lib/services/attendance.service.ts` | **Unbounded `getAttendance` for Non-Employee Roles & Redundant Ternary:** `const filterProfileId = isEmployee ? profileId : profileId`. If `role !== 'employee'` (e.g., invalid/unknown role string) and `profileId` is omitted, all active employees are returned. |
| **M-04** | `lib/services/attendance.service.ts` | **Serverless Background Task Risk:** `bulkUploadDailyAttendance` schedules broadcasts inside `setImmediate(() => (async () => { ... })())`, which can be frozen/terminated mid-flight in serverless runtimes after the HTTP response resolves. |
| **M-05** | `lib/services/shifts.service.ts` | **Unconditional Runtime DDL & Ignored Rotation Types:** `ShiftService.ensureSchema()` lacks the `ALLOW_RUNTIME_SCHEMA_FALLBACK === 'true'` guard and swallows errors (`catch (e) {}`). `getEffectiveShiftForDate` only implements `rotation_type === 'weekly'`, silently ignoring `'biweekly'` and `'monthly'` defined in `ShiftAssignmentInput`. |
| **M-06** | `lib/services/shifts.service.ts` | **N+1 Queries & UTC Drift in `allotRoster`:** Runs `O(staff * days)` sequential `findFirst` + `insert/update` calls without a transaction, and uses `new Date(input.startDate)` + `.toISOString().slice(0, 10)` which shifts dates in non-UTC timezones. |
| **M-07** | `lib/services/salary.service.ts` | **Non-Atomic `upsertSalarySetup` & Unconditional Recompile:** `upsertSalarySetup` lacks `db.transaction`, risking two `is_active = true` rows on concurrent requests. `compileMonthlyAttendance` hardcodes `const hasChanges = true`, causing unnecessary writes on every run, and `getPayslipDetail` lacks an internal ownership/role check. |
| **M-08** | `lib/services/attendance.service.ts` | **Inconsistent Session Duration Math:** `verifyAttendanceSession` and `updateAttendanceSession` use `differenceInMinutes` (truncating seconds), whereas `batchUpdateAttendanceSessions` uses millisecond division. |
| **L-01** | All Services | **Pervasive `any` Types & Swallowed Errors:** Extensive use of `any` (`updateData: any`, `results: any[]`, `catch (err: any)`) defeats TypeScript 6 strictness (`ignoreBuildErrors: false`), and multiple `try/catch` blocks swallow DB failures (`ShiftService.getEffectiveShiftForDate` in `clockIn`, `getMonthlySummaries` stale check). |

---

## 4. Prioritized Action Plan

### Phase 1 — Immediate (Blockers / Security & Data Integrity)
1. **Deploy Patch 1 (`/api/biometric/sync` + `AttendanceService` timestamp support):** Enforce `license_expires_at`, require `device.status === 'active'`, cap batch size, sort punches chronologically, reject `punchType === 1` without an active session, and persist actual hardware `punchTime`.
2. **Deploy Patch 2 (`AttendanceService`):** Fail closed on missing `tenantStore` / `masterDb` errors, restrict `source` biometric/geofence bypasses via an explicit `trustedHardwareSync` / internal token flag, fix the `getAttendance` 31-day cap DoS and UTC `.getDay()` drift, and scope `batchUpdateAttendanceSessions` by `attendance_id`.
3. **Deploy Patch 3 (`SalaryService`):** Wrap `generatePayslips` in `db.transaction` with `FOR UPDATE` locks, exclude `rejected`/`absent` records from extra-shift pay, validate `paidAmount > 0 && Number.isFinite(paidAmount)` in `markSalaryPaid`, and fix `findFirst` bonus truncation.
4. **Fix `next.config.ts` `headers()` matcher:** Exclude `_next/static`, `_next/image`, `images/`, and `api/trpc/` from the `no-store` catch-all rule (`source: '/((?!_next/static|_next/image|favicon.ico|images/|api/trpc/).*)'`).

### Phase 2 — Medium-Term (Architectural Hardening)
1. **Eliminate Unscoped `SERVICE_ROLE_KEY` Sync in `ProfileService`:** Pass `tenantId` verification when syncing `public.profiles` / `auth.users`, replace `isSchemaEnsured` boolean with a per-tenant `Set<string>`, and exclude `face_embedding` / `face_embedding_512` from non-matching queries.
2. **Hash Biometric API Keys:** Migrate `tenants.biometric_api_key` to SHA-256 hashed tokens (`biometric_api_key_hash`) and add a unique constraint on `biometric_raw_logs (device_id, biometric_user_id, punch_time)` for idempotent ingestion.
3. **Move Proof Consumption Inside Transactions:** Validate the signed proof statelessly (HMAC/JWT signature + expiry) *before* geofencing, and atomically claim `jti` inside `biometric_consumed_proofs` within the `db.transaction` (rolling back cleanly on any failure).
4. **Harden `ShiftService` & `AttendanceService` Transactions:** Wrap `upsertSalarySetup`, `verifyAttendance`, `manualUpdate`, and `allotRoster` in `db.transaction`; implement `'biweekly'` and `'monthly'` rotation calculations; enforce strict `YYYY-MM-DD` / UUID Zod validation at service boundaries.

### Phase 3 — Long-Term Enhancements
1. **Integer Minor-Unit Payroll Arithmetic:** Perform all salary, pro-rata, and payment balance math in integer paise/cents (`Math.round(val * 100)`) before formatting to decimal strings.
2. **Configurable Payroll Policy for Unverified Punches & Zero-Day Months:** Exclude `pending` punches from finalized payroll (or block `set_for_salary` until all month punches are verified) and add explicit zero-attendance handling for 0-day months.
3. **CSP Nonces & Turbopack Bundle Governance:** Replace `'unsafe-inline'` in `script-src` with per-request nonces in Next.js middleware, pin CDN paths, and audit client chunks with `@next/bundle-analyzer`.

---

## 5. Exact Code Patches & Drop-In Replacements (Top 3 Critical Issues)

### Patch 1: `app/api/biometric/sync/route.ts` — License Expiry, Device Status, Chronological Sorting, Deduplication & Actual `punchTime`
*(Note: Requires adding optional `punchTime?: Date` and `trustedDeviceSync?: boolean` to `AttendanceService.clockIn`/`clockOut` as shown in Patch 2.)*

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { masterDb } from '@/lib/db/master-connection';
import { tenants } from '@/lib/db/master-schema';
import { tenantStorage } from '@/lib/tenant/store';
import { employeeSettings, biometricDevices, biometricRawLogs, attendanceSessions } from '@/lib/db/schema';
import { AttendanceService } from '@/lib/services/attendance.service';
import { formatDateIST, parseBiometricTimestamp } from '@/lib/utils/date-utils';
import { eq, and, desc } from 'drizzle-orm';

interface PunchLog {
    userId: string;
    timestamp: string; // ISO string
    punchType?: number; // 0: Check-In, 1: Check-Out, 2: Break In, 3: Break Out
}

interface SyncPayload {
    deviceId: string;
    logs: PunchLog[];
}

const MAX_SYNC_BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate Request using Tenant-Isolated API Key
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid Authorization header.' }, { status: 401 });
        }

        const token = authHeader.slice(7).trim();
        if (!token) {
            return NextResponse.json({ error: 'Empty token payload.' }, { status: 401 });
        }

        // Query Central master database to match token to a tenant
        const tenant = await masterDb.query.tenants.findFirst({
            where: eq(tenants.biometric_api_key, token),
        });

        if (
            !tenant ||
            tenant.status === 'suspended' ||
            tenant.status === 'cancelled' ||
            (tenant.license_expires_at && Date.now() > new Date(tenant.license_expires_at).getTime())
        ) {
            return NextResponse.json({ error: 'Unauthorized, suspended, or expired workspace key.' }, { status: 401 });
        }

        // 2. Parse & Bound Payload
        const body: SyncPayload = await req.json();
        if (!body.deviceId || typeof body.deviceId !== 'string' || !Array.isArray(body.logs)) {
            return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
        }
        if (body.logs.length > MAX_SYNC_BATCH_SIZE) {
            return NextResponse.json(
                { error: `Batch exceeds maximum of ${MAX_SYNC_BATCH_SIZE} logs per request.` },
                { status: 413 }
            );
        }

        const tenantContext = {
            tenantId: tenant.id,
            slug: tenant.slug,
            databaseUrl: tenant.database_url || null,
            tenantSchema: tenant.tenant_schema || null,
            brandName: tenant.company_name,
            licenseExpiresAt: tenant.license_expires_at ? new Date(tenant.license_expires_at).toISOString() : null,
            trusted: false, // Never bypass subscription checks
        };

        // 3. Process logs chronologically inside the resolved tenant context
        return await tenantStorage.run(tenantContext, async () => {
            let processedCount = 0;
            let errorCount = 0;

            const device = await db.query.biometricDevices.findFirst({
                where: eq(biometricDevices.serial_number, body.deviceId),
            });

            if (!device || device.status !== 'active') {
                return NextResponse.json({ error: 'Unregistered or inactive device for workspace.' }, { status: 403 });
            }

            await db.update(biometricDevices)
                .set({ last_sync_time: new Date(), updated_at: new Date() })
                .where(eq(biometricDevices.id, device.id));

            const locationId = device.location_id || null;

            // Sort logs chronologically so out-of-order device batches do not invert clock-in/out state
            const sortedLogs = [...body.logs]
                .map((log) => ({
                    log,
                    punchTime: parseBiometricTimestamp(log.timestamp),
                }))
                .filter(({ punchTime }) => !Number.isNaN(punchTime.getTime()))
                .sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());

            errorCount += body.logs.length - sortedLogs.length;

            for (const { log, punchTime } of sortedLogs) {
                try {
                    const settings = await db.query.employeeSettings.findFirst({
                        where: eq(employeeSettings.biometric_device_user_id, log.userId),
                    });

                    const profileId = settings?.profile_id || null;
                    const localDate = formatDateIST(punchTime);

                    // Deduplicate identical retries before processing attendance state transitions
                    const duplicateRaw = await db.query.biometricRawLogs.findFirst({
                        where: and(
                            eq(biometricRawLogs.device_id, body.deviceId),
                            eq(biometricRawLogs.biometric_user_id, log.userId),
                            eq(biometricRawLogs.punch_time, punchTime)
                        ),
                    });
                    if (duplicateRaw) {
                        continue;
                    }

                    await db.insert(biometricRawLogs).values({
                        profile_id: profileId,
                        biometric_user_id: log.userId,
                        device_id: body.deviceId,
                        location_id: locationId,
                        punch_time: punchTime,
                        punch_type: log.punchType ?? 0,
                        raw_payload: log as Record<string, unknown>,
                    });

                    if (!profileId) {
                        console.warn(`[Biometric Sync] Unmapped biometric user ID: ${log.userId} in tenant ${tenant.slug}`);
                        errorCount++;
                        continue;
                    }

                    const activeSession = await db.query.attendanceSessions.findFirst({
                        where: and(
                            eq(attendanceSessions.profile_id, profileId),
                            eq(attendanceSessions.date, localDate),
                            eq(attendanceSessions.status, 'active')
                        ),
                        orderBy: [desc(attendanceSessions.check_in)],
                    });

                    if (activeSession) {
                        const checkInTime = new Date(activeSession.check_in).getTime();
                        const secondsSinceCheckIn = (punchTime.getTime() - checkInTime) / 1000;

                        if (secondsSinceCheckIn >= 15 || (log.punchType === 1 && secondsSinceCheckIn >= 0)) {
                            await AttendanceService.clockOut({
                                profileId,
                                email: 'biometric@device.local',
                                localDate,
                                punchTime,
                                source: 'biometric',
                                trustedHardwareSync: true,
                            });
                        }
                    } else {
                        // Do not convert an explicit Check-Out punch (1) into a Clock-In
                        if (log.punchType === 1) {
                            console.warn(`[Biometric Sync] Ignoring orphan check-out for user ${log.userId} on ${localDate}`);
                            continue;
                        }

                        await AttendanceService.clockIn({
                            profileId,
                            email: 'biometric@device.local',
                            localDate,
                            punchTime,
                            source: 'biometric',
                            trustedHardwareSync: true,
                            deviceId: body.deviceId,
                            locationId: locationId || undefined,
                        });
                    }

                    processedCount++;
                } catch (err) {
                    console.error(`[Biometric Sync] Error processing log for user ${log.userId}:`, err);
                    errorCount++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `Processed ${processedCount} punches. Errors: ${errorCount}.`,
            });
        });
    } catch (error) {
        console.error('[Biometric Sync] Fatal error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
```

---

### Patch 2: `lib/services/attendance.service.ts` — Fail-Closed Tenant/Proof Checks, `getAttendance` DoS Fix, UTC `getDay()` Fix, & Session IDOR Fix
Apply these drop-in replacements to the corresponding methods in `lib/services/attendance.service.ts`:

```ts
// Helper: Safe weekday (0-6) without UTC midnight shift
function getWeekdayFromYYYYMMDD(dateStr: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) {
        throwAppError('VALIDATION_FAILED', `Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
    }
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).getDay();
}
```

**1. Fix `getAttendance` 31-day cap DoS & UTC `getDay()`:**
```ts
        // Parse date objects safely to construct the dates list
        const dateRe = /^(\d{4})-(\d{2})-(\d{2})$/;
        const startMatch = dateRe.exec(finalStartDate);
        const endMatch = dateRe.exec(finalEndDate);
        if (!startMatch || !endMatch) {
            throwAppError('VALIDATION_FAILED', 'startDate and endDate must be valid YYYY-MM-DD dates.');
        }

        const start = new Date(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
        const end = new Date(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));
        if (start > end) {
            return [];
        }

        // Cap date range to max 31 days relative to `end` (year/month-safe)
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 31) {
            start.setFullYear(end.getFullYear(), end.getMonth(), end.getDate() - 31);
        }
```
*(And replace `const dateObj = new Date(dateStr); const dayOfWeek = dateObj.getDay()` inside `getAttendance` with `const dayOfWeek = getWeekdayFromYYYYMMDD(dateStr)`.)*

**2. Fix `assertActiveSubscription` to fail closed:**
```ts
    static async assertActiveSubscription() {
        const tenantStore = tenantStorage.getStore();
        if (!tenantStore || !tenantStore.tenantId) {
            throwAppError('FORBIDDEN', 'Tenant context is required for attendance operations.');
        }
        if (tenantStore.trusted) return;

        if (tenantStore.licenseExpiresAt) {
            const expTime = new Date(tenantStore.licenseExpiresAt).getTime();
            if (Date.now() > expTime) {
                const expDateStr = new Date(tenantStore.licenseExpiresAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                });
                throwAppError('FORBIDDEN', `Workspace subscription expired on ${expDateStr}. Attendance operations are disabled until renewed.`);
            }
        }

        const { masterDb } = await import('@/lib/db/master-connection');
        const { tenants: tenantsTable } = await import('@/lib/db/master-schema');

        const tenant = await masterDb.query.tenants.findFirst({
            where: eq(tenantsTable.id, tenantStore.tenantId),
            columns: { status: true, license_expires_at: true },
        });

        if (!tenant) {
            throwAppError('FORBIDDEN', 'Workspace subscription record not found.');
        }
        if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
            throwAppError('FORBIDDEN', 'Workspace is currently suspended. Attendance operations are disabled.');
        }
        if (tenant.license_expires_at && Date.now() > new Date(tenant.license_expires_at).getTime()) {
            const expDateStr = new Date(tenant.license_expires_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
            throwAppError('FORBIDDEN', `Workspace subscription expired on ${expDateStr}. Attendance operations are disabled until renewed.`);
        }
    }
```

**3. Fix `clockIn` / `clockOut` `source` bypass, hardware `punchTime`, and `biometricConsumedProofs` fail-open error handling:**
```ts
        // Inside clockIn (apply identical guard & punchTime logic in clockOut):
        const isTrustedHardware = trustedHardwareSync === true && source === 'biometric';
        const requiresBiometricProof = !isTrustedHardware;
        const requiresGeofence = source === 'mobile' || !isTrustedHardware;

        let consumedProof: ReturnType<typeof consumeAttendanceProof> = null;
        if (requiresBiometricProof) {
            const tenantId = tenantStorage.getStore()?.tenantId;
            consumedProof = consumeAttendanceProof(verificationProof, {
                subject: profileId,
                tenantId: tenantId || '',
                action: 'clock_in', // 'clock_out' in clockOut
                localDate: today,
            });
            if (!consumedProof) {
                throwAppError('FORBIDDEN', 'A fresh biometric verification is required before clocking in.');
            }
        }
        const dayOfWeek = getWeekdayFromYYYYMMDD(today);
        ...
        const now = punchTime ?? new Date();
        ...
        // Inside db.transaction(async (tx) => ...):
        if (requiresBiometricProof && consumedProof?.jti) {
            try {
                await tx.insert(biometricConsumedProofs).values({
                    jti: consumedProof.jti,
                    profile_id: profileId,
                    action: 'clock_in', // 'clock_out' in clockOut
                    expires_at: new Date(Date.now() + 2 * 60 * 1000),
                });
            } catch (err: unknown) {
                const pgErr = err as { code?: string; cause?: { code?: string } };
                if (pgErr?.code === '23505' || pgErr?.cause?.code === '23505') {
                    throwAppError('FORBIDDEN', 'This biometric attendance proof has already been used.');
                }
                throw err; // Never swallow unexpected DB errors inside a transaction
            }
        }
```

**4. Fix `batchUpdateAttendanceSessions` cross-record IDOR:**
```ts
            const updatedRows = await db.update(attendanceSessions)
                .set(updateFields)
                .where(and(
                    eq(attendanceSessions.id, sess.id),
                    eq(attendanceSessions.attendance_id, attendanceId)
                ))
                .returning({ id: attendanceSessions.id });

            if (updatedRows.length === 0) {
                throwAppError('NOT_FOUND', `Session ${sess.id} does not belong to attendance record ${attendanceId}`);
            }
```

---

### Patch 3: `lib/services/salary.service.ts` — Transactional `generatePayslips`, Verified-Only Extra Shifts, Multi-Bonus Fix, & `markSalaryPaid` Validation
Apply these drop-in replacements in `lib/services/salary.service.ts`:

**1. Fix `updateAndRecalculateSummary` multi-bonus aggregation (`findFirst` -> `findMany`):**
```ts
            const bonusRecords = await client.query.monthlyBonuses.findMany({
                where: and(
                    eq(monthlyBonuses.profile_id, existingSummary.profile_id),
                    eq(monthlyBonuses.month, existingSummary.month),
                    eq(monthlyBonuses.year, existingSummary.year)
                )
            });
            const bonusAmt = metrics.monthlyBonus !== undefined
                ? metrics.monthlyBonus
                : bonusRecords.reduce((sum: number, b: { amount: string | null }) => sum + (Number(b.amount) || 0), 0);
            const bonusTitle = metrics.bonusTitle || bonusRecords[0]?.title || 'Monthly Bonus';
            const bonusType = metrics.bonusType || bonusRecords[0]?.bonus_type || 'festival_bonus';
```

**2. Fix `generatePayslips` atomicity (`db.transaction` + `FOR UPDATE`) & exclude `rejected`/`absent` extra shifts:**
```ts
    static async generatePayslips(ids: string[]) {
        if (!ids.length) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'No summary IDs supplied.' });
        }

        return await db.transaction(async (tx) => {
            // Lock target rows in 'set_for_salary' state to prevent concurrent duplicate runs
            const summaries = await tx
                .select()
                .from(monthlyAttendanceSummary)
                .where(and(
                    inArray(monthlyAttendanceSummary.id, ids),
                    eq(monthlyAttendanceSummary.status, 'set_for_salary')
                ))
                .for('update');

            if (summaries.length === 0) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'No valid summaries found for payslip generation. Ensure records are marked "Set for Salary".'
                });
            }

            const firstSummary = summaries[0];
            const lastDayOfMonth = new Date(firstSummary.year, firstSummary.month, 0).getDate();
            const startOfMonth = `${firstSummary.year}-${String(firstSummary.month).padStart(2, '0')}-01`;
            const endOfMonth = `${firstSummary.year}-${String(firstSummary.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

            const profileIds = summaries.map(s => s.profile_id);
            const [allSalarySetups, officeSettingsData, allLocations, punchLocations, allBonuses, allExtraShifts] = await Promise.all([
                tx.query.employeeSalarySetup.findMany({
                    where: inArray(employeeSalarySetup.profile_id, profileIds),
                    orderBy: [desc(employeeSalarySetup.effective_from_year), desc(employeeSalarySetup.effective_from_month)],
                }),
                SmartCache.getOfficeSettingsCached(),
                SmartCache.getOfficeLocationsCached(),
                tx.query.attendance.findMany({
                    where: and(
                        inArray(attendance.profile_id, profileIds),
                        isNotNull(attendance.location_id)
                    ),
                    columns: { profile_id: true, location_id: true }
                }),
                tx.query.monthlyBonuses.findMany({
                    where: and(
                        inArray(monthlyBonuses.profile_id, profileIds),
                        eq(monthlyBonuses.month, firstSummary.month),
                        eq(monthlyBonuses.year, firstSummary.year)
                    )
                }),
                tx.query.attendance.findMany({
                    where: and(
                        inArray(attendance.profile_id, profileIds),
                        gte(attendance.date, startOfMonth),
                        lte(attendance.date, endOfMonth),
                        ne(attendance.status, 'rejected'),
                        ne(attendance.status, 'absent'),
                        or(
                            eq(attendance.is_extra_shift, true),
                            isNotNull(attendance.extra_shift_type)
                        )
                    )
                })
            ]);

            const profileLocationIdMap = new Map<string, string>();
            for (const pl of punchLocations) {
                if (pl.location_id && !profileLocationIdMap.has(pl.profile_id)) {
                    profileLocationIdMap.set(pl.profile_id, pl.location_id);
                }
            }
            const locationsMap = new Map(allLocations.map((l) => [l.id, l]));
            const results: Array<Record<string, unknown>> = [];

            for (const summary of summaries) {
                const employeeSetups = allSalarySetups.filter(s => s.profile_id === summary.profile_id);
                let salarySetup: typeof allSalarySetups[number] | null = null;
                for (const setup of employeeSetups) {
                    const fromVal = setup.effective_from_year * 100 + setup.effective_from_month;
                    const targetVal = summary.year * 100 + summary.month;
                    if (fromVal > targetVal) continue;
                    if (!setup.effective_to_month || !setup.effective_to_year) {
                        salarySetup = setup;
                        break;
                    }
                    const toVal = setup.effective_to_year * 100 + setup.effective_to_month;
                    if (targetVal <= toVal) {
                        salarySetup = setup;
                        break;
                    }
                }

                if (!salarySetup) {
                    results.push({ ...summary, error: 'No salary setup found for this period' });
                    continue;
                }

                const locId = profileLocationIdMap.get(summary.profile_id);
                const empLocation = locId ? locationsMap.get(locId) : (allLocations.length === 1 ? allLocations[0] : null);
                const multiplier = empLocation?.absent_deduction_multiplier ?? officeSettingsData?.absent_deduction_multiplier ?? 1;

                const basic = Number(salarySetup.basic_salary) || 0;
                const hra = Number(salarySetup.hra) || 0;
                const da = Number(salarySetup.da) || 0;
                const ta = Number(salarySetup.ta) || 0;
                const special = Number(salarySetup.special_allowance) || 0;
                const incentiveAmt = Number(salarySetup.incentive) || 0;
                const otherDeductions = Number(salarySetup.other_deductions) || 0;

                const empBonuses = allBonuses.filter(b => b.profile_id === summary.profile_id);
                const bonusAmt = empBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                const bonusTitle = empBonuses.length > 0 ? empBonuses[0].title : 'Monthly Bonus';
                const bonusType = empBonuses.length > 0 ? empBonuses[0].bonus_type : 'festival_bonus';

                const summaryBD = summary.salary_breakdown as Record<string, unknown> | null;
                const extraDays = Number(summaryBD?.extra_days) || 0;

                const empExtraShifts = allExtraShifts.filter(r => r.profile_id === summary.profile_id);
                const fullExtraShifts = empExtraShifts.filter(r => r.extra_shift_type === 'full' || (!r.extra_shift_type && !r.is_half_day)).length;
                const halfExtraShifts = empExtraShifts.filter(r => r.extra_shift_type === 'half' || (!r.extra_shift_type && r.is_half_day)).length;
                const extraShiftEquivDays = empExtraShifts.length > 0
                    ? (fullExtraShifts * 1.0 + halfExtraShifts * 0.5)
                    : (Number(summaryBD?.extra_shift_equivalent_days) || 0);

                const baseGross = basic + hra + da + ta + special + incentiveAmt;
                const totalWorkingDays = summary.total_working_days || 1;
                const absentDays = summary.total_absent_days || 0;
                const halfDays = summary.total_half_days || 0;

                const perDayRate = baseGross / totalWorkingDays;
                const extraDayPayment = Number((extraDays * perDayRate).toFixed(2));
                const extraShiftPayment = Number((extraShiftEquivDays * perDayRate).toFixed(2));
                const absentDeductionVal = Number((absentDays * multiplier * perDayRate).toFixed(2));
                const halfDayDeductionVal = Number((halfDays * 0.5 * perDayRate).toFixed(2));
                const absenceDeduction = Number((absentDeductionVal + halfDayDeductionVal).toFixed(2));

                const grossSalary = Number((baseGross + bonusAmt).toFixed(2));
                const netSalary = Number((grossSalary + extraDayPayment + extraShiftPayment - absenceDeduction - otherDeductions).toFixed(2));

                const lastDay = new Date(summary.year, summary.month, 0).getDate();
                const endDate = `${summary.year}-${String(summary.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                await tx.update(employeeAdvances).set({
                    status: 'pending',
                    adjusted_in_month: null,
                    adjusted_in_year: null,
                }).where(and(
                    eq(employeeAdvances.profile_id, summary.profile_id),
                    eq(employeeAdvances.status, 'adjusted'),
                    or(
                        sql`(${employeeAdvances.date}::date > (${employeeAdvances.adjusted_in_year}::text || '-' || LPAD(${employeeAdvances.adjusted_in_month}::text, 2, '0') || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day')`,
                        gt(employeeAdvances.date, endDate)
                    )
                ));

                const advancesList = await tx.select({
                    amount: employeeAdvances.amount,
                    particulars: employeeAdvances.particulars,
                }).from(employeeAdvances).where(and(
                    eq(employeeAdvances.profile_id, summary.profile_id),
                    or(
                        and(eq(employeeAdvances.status, 'pending'), lte(employeeAdvances.date, endDate)),
                        and(
                            eq(employeeAdvances.status, 'adjusted'),
                            eq(employeeAdvances.adjusted_in_month, summary.month),
                            eq(employeeAdvances.adjusted_in_year, summary.year)
                        )
                    )
                ));

                let carryForwardRecovery = 0;
                let regularAdvanceRecovery = 0;
                for (const adv of advancesList) {
                    const amt = Number(adv.amount) || 0;
                    if (adv.particulars?.startsWith('Salary deficit carry-forward from')) {
                        carryForwardRecovery += amt;
                    } else {
                        regularAdvanceRecovery += amt;
                    }
                }
                const advanceTotal = Number((carryForwardRecovery + regularAdvanceRecovery).toFixed(2));
                const rawTakeHome = Number((netSalary - advanceTotal).toFixed(2));
                const isNegative = rawTakeHome < 0;
                const carryForwardAmount = isNegative ? Math.abs(rawTakeHome) : 0;
                const actualTakeHome = isNegative ? 0 : rawTakeHome;

                const salaryBreakdown = {
                    basic_salary: basic,
                    hra,
                    da,
                    ta,
                    special_allowance: special,
                    incentive: incentiveAmt,
                    monthly_bonus: Number(bonusAmt.toFixed(2)),
                    bonus_title: bonusTitle,
                    bonus_type: bonusType,
                    gross_salary: grossSalary,
                    total_working_days: totalWorkingDays,
                    absent_days: absentDays,
                    half_days: halfDays,
                    extra_days: extraDays,
                    extra_day_payment: extraDayPayment,
                    extra_shift_full: fullExtraShifts || (Number(summaryBD?.extra_shift_full) || 0),
                    extra_shift_half: halfExtraShifts || (Number(summaryBD?.extra_shift_half) || 0),
                    extra_shift_equivalent_days: Number(extraShiftEquivDays.toFixed(1)),
                    extra_shift_payment: extraShiftPayment,
                    absent_deduction_multiplier: multiplier,
                    per_day_rate: Number(perDayRate.toFixed(2)),
                    absence_deduction: absenceDeduction,
                    absent_deduction: absentDeductionVal,
                    half_day_deduction: halfDayDeductionVal,
                    leave_deduction: 0,
                    other_deductions: otherDeductions,
                    net_salary: netSalary,
                    advance_recovery: Number(regularAdvanceRecovery.toFixed(2)),
                    carry_forward_recovery: Number(carryForwardRecovery.toFixed(2)),
                    total_advance_recovery: advanceTotal,
                    take_home: actualTakeHome,
                    carry_forward: Number(carryForwardAmount.toFixed(2)),
                };

                const [updated] = await tx.update(monthlyAttendanceSummary).set({
                    status: 'payslip_generated',
                    gross_salary: grossSalary.toFixed(2),
                    absence_deduction: absenceDeduction.toFixed(2),
                    net_salary: netSalary.toFixed(2),
                    advance_recovery: advanceTotal.toFixed(2),
                    take_home: actualTakeHome.toFixed(2),
                    salary_breakdown: salaryBreakdown,
                    updated_at: new Date(),
                }).where(eq(monthlyAttendanceSummary.id, summary.id)).returning();

                if (advanceTotal > 0) {
                    await tx.update(employeeAdvances).set({
                        status: 'adjusted',
                        adjusted_in_month: summary.month,
                        adjusted_in_year: summary.year,
                    }).where(and(
                        eq(employeeAdvances.profile_id, summary.profile_id),
                        or(
                            and(eq(employeeAdvances.status, 'pending'), lte(employeeAdvances.date, endDate)),
                            and(
                                eq(employeeAdvances.status, 'adjusted'),
                                eq(employeeAdvances.adjusted_in_month, summary.month),
                                eq(employeeAdvances.adjusted_in_year, summary.year)
                            )
                        )
                    ));
                } else {
                    await tx.update(employeeAdvances).set({
                        status: 'pending',
                        adjusted_in_month: null,
                        adjusted_in_year: null,
                    }).where(and(
                        eq(employeeAdvances.profile_id, summary.profile_id),
                        eq(employeeAdvances.status, 'adjusted'),
                        eq(employeeAdvances.adjusted_in_month, summary.month),
                        eq(employeeAdvances.adjusted_in_year, summary.year)
                    ));
                }

                const carryForwardParticulars = `Salary deficit carry-forward from ${MONTH_NAMES[summary.month - 1]} ${summary.year} payslip`;
                await tx.delete(employeeAdvances).where(and(
                    eq(employeeAdvances.profile_id, summary.profile_id),
                    eq(employeeAdvances.particulars, carryForwardParticulars)
                ));

                if (isNegative && carryForwardAmount > 0) {
                    let nextMonth = summary.month + 1;
                    let nextYear = summary.year;
                    if (nextMonth > 12) {
                        nextMonth = 1;
                        nextYear += 1;
                    }
                    const advanceDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

                    await tx.insert(employeeAdvances).values({
                        profile_id: summary.profile_id,
                        date: advanceDate,
                        amount: carryForwardAmount.toFixed(2),
                        particulars: carryForwardParticulars,
                        status: 'pending',
                        created_by: summary.profile_id,
                    });
                }

                results.push(updated);
            }

            return results;
        });
    }
```

**3. Fix `markSalaryPaid` negative/NaN `paidAmount` & minor-unit math:**
```ts
        if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment amount must be a positive number.' });
        }
        const paidPaise = Math.round(paidAmount * 100);
        if (paidPaise <= 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payment amount must be at least 0.01.' });
        }
        // Inside db.transaction after locking `summary`:
        const existingPaidPaise = currentPayments.reduce((s, p) => s + Math.round((Number(p.amount) || 0) * 100), 0);
        const takeHomePaise = Math.round((Number(summary.take_home) || 0) * 100);
        const remainingPaise = takeHomePaise - existingPaidPaise;

        if (paidPaise > remainingPaise) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Payment amount of ${(paidPaise / 100).toFixed(2)} exceeds the remaining balance of ${(remainingPaise / 100).toFixed(2)}`
            });
        }
        // Persist `(paidPaise / 100).toFixed(2)` and `((existingPaidPaise + paidPaise) / 100).toFixed(2)`
```