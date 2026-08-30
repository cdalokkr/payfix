# Tenant Database Audit — 2026-08-30

## Scope

This audit reviewed the live Supabase project's tenant registry, tenant-table
RLS state, policies, owners, table/index statistics, foreign-key coverage,
high-volume query plans, biometric retention, and vector indexes. It did not
alter `public` or biometric template data.

## Current tenant state

- One active tenant is registered: `primary` using `tenant_primary`.
- The registry entry points to an existing schema.
- All 19 tenant tables are owned by `postgres`.
- Tenant RLS and forced RLS are disabled on every tenant table.
- No tenant-schema RLS policies exist.

RLS remains intentionally deferred. Direct PostgreSQL connections use a
tenant-first `search_path`, and the owner role can bypass ordinary RLS. Enabling
JWT-dependent policies now would risk breaking PWA and kiosk requests without
creating a reliable database boundary. The prerequisites in
`docs/tenant-rls-readiness.md` still apply.

## Measured workload

- `activities`: about 2,971 rows; index-heavy access.
- `attendance`: about 850 rows; approximately 3,028 index scans versus 77
  sequential scans.
- `attendance_sessions`: about 76 live rows and 57 dead rows; approximately 321
  sequential scans versus 130 index scans.
- `notifications`: about 4,637 live rows and 735 dead rows; existing user/read
  indexes are actively used.
- `profiles`: 15 rows; sequential scans are reasonable at this size.
- `biometric_verification_attempts`: 41 rows; retention and per-profile plans
  use the existing `created_at` and `(profile_id, created_at)` indexes.
- `kiosk_devices`: 3 rows; sequential scans are cheaper than index scans at the
  current size.

These values come from cumulative PostgreSQL statistics and should be read as
workload direction, not permanent totals.

## Index findings

Eight foreign-key or workload access paths lacked a complete, non-partial
leading index:

1. `attendance_sessions.attendance_id`
2. `attendance_sessions.profile_id` plus its date/check-in lookup
3. `biometric_raw_logs.profile_id`
4. `kiosk_devices.created_by`
5. `kiosk_devices.location_id`
6. `office_locations.created_by`
7. `profile_photo_requests.profile_id` plus status/created-time lookup
8. `profile_photo_requests.reviewed_by`

The tenant-only migration adds these indexes. The two composite indexes match
observed application queries and also provide leading-column foreign-key
coverage. The remaining indexes protect joins and parent-row delete/update
checks.

Supabase recorded this migration as
`20260830110424_add_tenant_fk_and_workload_indexes`. A post-migration audit
reported no remaining tenant foreign keys without a complete, non-partial
leading index.

Post-migration `EXPLAIN` results confirmed:

- Attendance-session lookup changed from a sequential scan to
  `attendance_sessions_profile_date_checkin_idx`.
- Pending profile-photo lookup changed from a sequential scan and explicit sort
  to `profile_photo_requests_profile_status_created_idx`.

No existing index is removed. Some indexes appear structurally redundant, but
cumulative usage shows that PostgreSQL still selects several of them. Removing
indexes based on a single statistics window would be premature.

Supabase's performance advisor reports newly created indexes as unused until
normal traffic increments their scan counters. This immediate post-creation
warning is expected; the query planner already selects the two workload
indexes in `EXPLAIN`. Reassess all unused-index warnings only after a
representative traffic window.

## Vector search

Both 128-dimensional and 512-dimensional HNSW cosine indexes exist. With only
11 non-null 512-dimensional templates, PostgreSQL correctly prefers a
sequential scan and in-memory sort. The HNSW index is appropriate for future
growth; forcing it now would be slower. No vector-index change is recommended.

## Maintenance

- Autovacuum/autoanalyze is operating on the active larger tables.
- `attendance_sessions` has a high dead-row ratio at a small absolute size.
  Monitor it as usage grows; no manual vacuum or table rewrite is justified.
- Biometric verification retention uses the existing `created_at` index.
  Keep the 90-day cleanup, but monitor execution time before considering
  batching or partitioning.
- The migration is additive and idempotent. It targets only schemas whose names
  start with `tenant_`.

## Other advisor findings

Supabase also reports security warnings involving `public`-schema
`SECURITY DEFINER` functions, the `vector` extension location, one
public table with RLS but no policy, and disabled Auth leaked-password
protection. These are not tenant-index defects and were not changed because
this task explicitly excludes `public` schema changes. They should be reviewed
separately with compatibility testing for the legacy release line.

## RLS decision

Do not enable tenant RLS yet. The safe sequence is:

1. Introduce a non-owner application role.
2. Set trusted transaction-local tenant identity for web, background, and kiosk
   requests.
3. Create two non-production tenants.
4. Run cross-tenant hostname, cookie, query, header, CRUD, and pairing tests.
5. Add tenant policies and force RLS only after all legitimate PWA, kiosk,
   enrollment, approval, and reporting flows pass.

## Monitoring

Re-run `scripts/audit-tenant-isolation.sql` after material tenant growth or
before enabling RLS. Review sequential/index scan ratios, dead tuples, unused
indexes over a representative statistics window, vector-index use, and any new
unindexed foreign keys.