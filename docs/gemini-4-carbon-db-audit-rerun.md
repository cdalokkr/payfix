### 1. Executive Assessment

The PayFix database is exhibiting classic rapid-feature-velocity debt introduced via the `develop` branch (`departments`, `office_shifts`, `employee_shift_assignments`, `shift_roster`). While core legacy tables (`attendance`) are over-indexed in some areas and under-indexed on foreign keys, the newer scheduling and roster tables have **zero secondary indexing**.

#### High-Risk Bottlenecks
1. **Sequential Scan Amplification on Clock-In & Roster Views (`shift_roster`, `employee_shift_assignments`)**:
   * Every employee clock-in or payroll calculation must resolve the employee's active shift (`employee_shift_assignments` by `profile_id` and `effective_from`/`effective_to`) and daily roster override (`shift_roster` by `profile_id` and `date`). Because neither table has secondary indexes, PostgreSQL executes **O(N) sequential scans** on every request. At 5,000 employees across 1 year (~1.82M roster rows), a single monthly department calendar view will spike CPU to 100% and saturate IOPS.
2. **Write Amplification & HOT-Update Blocking on `attendance`**:
   * `attendance` currently maintains **three overlapping indexes** with `profile_id` as the leading column:
     1. `attendance_profile_id_date_key` (`UNIQUE (profile_id, date)`)
     2. `idx_attendance_profile_date` (`(profile_id, date)`)
     3. `idx_attendance_profile_id` (`(profile_id)`)
   * PostgreSQL B-Tree indexes obey the left-prefix rule. `attendance_profile_id_date_key` **alone** satisfies lookups on `(profile_id, date)` AND `(profile_id)`. The other two indexes are 100% redundant, consuming shared buffer RAM, inflating WAL generation, and slowing down high-frequency clock-in `INSERT`s and clock-out `UPDATE`s.
3. **32 Unindexed Foreign Keys (Lock Contention & Cascade Stalls)**:
   * PostgreSQL does not automatically index the referencing (child) side of a Foreign Key. Whenever a parent row (`office_shifts`, `office_locations`, `departments`, `profiles`) is deleted or has its PK updated, PostgreSQL must verify referential integrity by performing a **full sequential scan** on the child table (`attendance`, `shift_roster`, etc.) while holding row locks. Under concurrent clock-in traffic, deleting or merging a shift/location can trigger cascading lock queues and statement timeouts.
4. **Data Integrity & JSONB Relational Anti-Patterns**:
   * `employee_shift_assignments` lacks a temporal exclusion constraint or partial unique index on active assignments (`effective_to IS NULL`), allowing race conditions to create conflicting active shifts for the same employee.
   * Storing foreign keys inside JSONB arrays (`assigned_shift_ids`, `rotation_shift_ids`) bypasses PostgreSQL FK referential integrity, allowing orphaned shift IDs if a shift is deleted.

#### Multi-Tenant Isolation & Scaling Implications (`public`, `tenant_interspace`, `tenant_primary`)
PayFix uses a **Schema-per-Tenant** architecture (`tenant_*`). While this offers strong logical data isolation, it carries severe operational risks on Supabase if unmanaged:
* **Catalog & Buffer Cache Bloat**: Every table and index multiplied across $N$ tenants creates entries in `pg_class`, `pg_attribute`, and `pg_statistic`. Adding ~25 indexes across 15 tables equals ~375 catalog objects *per tenant*. Beyond ~200–300 tenants on a single Supabase instance, `pg_catalog` bloat degrades query planning latency, autovacuum scheduling, and PostgREST schema cache reloads.
* **Schema Drift**: Because `develop` branch additions lack indexes, tenant schemas provisioned at different times risk diverging in index/constraint definitions unless migrations are strictly deterministic across all `tenant_*` schemas.

---

### 2. Prioritized Remediation Plan (PostgreSQL 15+ DDL)

> **CRITICAL OPERATIONAL WARNING FOR `CONCURRENTLY`:**
> 1. `CREATE INDEX CONCURRENTLY` **cannot** run inside a transaction block (`BEGIN ... COMMIT`) or a PL/pgSQL `DO $$` block. If using Supabase CLI (`supabase db push`), ensure your runner executes non-transactionally, or run via `psql` directly against the **Session / Direct connection (Port 5432)**—never through Transaction Mode (Port 6543).
> 2. If a `CONCURRENTLY` build fails mid-flight (e.g., deadlock or statement timeout), PostgreSQL leaves an `INVALID` index behind. `IF NOT EXISTS` will **silently skip** rebuilding an existing `INVALID` index! Always verify zero invalid indexes exist afterward (`SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;`).

Replace `tenant_primary` below with each target schema (`tenant_interspace`, etc.), or execute via the multi-tenant bash runner provided at the end of this section.

#### Phase 1: High Priority (Immediate Production Stabilization)
Targets hot-path queries: Clock-in/out, Daily/Monthly Roster Calendar, Shift Resolution, and Profile Joins.

```sql
-- Disable timeouts for large concurrent index builds
SET statement_timeout = 0;
SET lock_timeout = '5s'; -- Fail fast if metadata lock cannot be acquired, rather than blocking traffic
SET search_path TO tenant_primary;

-- ============================================================================
-- 1. SHIFT ROSTER (Critical: Eliminates full-table scans on calendar & clock-in)
-- ============================================================================
-- Primary lookup: Employee's roster across a date range (covers profile_id equality too)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_profile_date 
    ON shift_roster (profile_id, date);

-- Enforce uniqueness for primary daily shift (prevents duplicate regular shift assignments)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_shift_roster_regular_shift 
    ON shift_roster (profile_id, date) 
    WHERE is_extra_shift = false;

-- Department monthly calendar view: WHERE department_id = $1 AND date BETWEEN $2 AND $3
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_dept_date 
    ON shift_roster (department_id, date);

-- Global daily payroll/attendance sweep: WHERE date = $1 AND status = $2
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_date_status 
    ON shift_roster (date, status);

-- Foreign Key support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_shift_id 
    ON shift_roster (shift_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_allotted_by 
    ON shift_roster (allotted_by) 
    WHERE allotted_by IS NOT NULL;


-- ============================================================================
-- 2. EMPLOYEE SHIFT ASSIGNMENTS (Critical: Clock-in shift resolution & integrity)
-- ============================================================================
-- Lookup employee shift history & effective date ranges
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_profile_dates 
    ON employee_shift_assignments (profile_id, effective_from DESC, effective_to);

-- Prevent multiple concurrent open-ended ("current") shift assignments per employee
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_emp_shift_assign_active_profile 
    ON employee_shift_assignments (profile_id) 
    WHERE effective_to IS NULL;

-- Foreign Key support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_location_id 
    ON employee_shift_assignments (location_id) 
    WHERE location_id IS NOT NULL;

-- Optional: Only add if querying inside JSONB arrays via @> operator
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_shift_ids_gin 
    ON employee_shift_assignments USING gin (assigned_shift_ids jsonb_path_ops);


-- ============================================================================
-- 3. ATTENDANCE (Critical: Missing FKs + Drop Redundant Write-Amplifying Indexes)
-- ============================================================================
-- Missing Foreign Keys (prevents locks on office_shifts / office_locations changes & speeds up analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_shift_id 
    ON attendance (shift_id) 
    WHERE shift_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_location_id 
    ON attendance (location_id) 
    WHERE location_id IS NOT NULL;

-- Composite index for HR Admin Daily Dashboard (Location + Date + Status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_location_date_status 
    ON attendance (location_id, date, status);

-- DROP REDUNDANT INDEXES: Covered completely by UNIQUE constraint `attendance_profile_id_date_key (profile_id, date)`
-- Verify idx_attendance_profile_date has no WHERE clause or expression before dropping!
DROP INDEX CONCURRENTLY IF EXISTS idx_attendance_profile_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_attendance_profile_date;


-- ============================================================================
-- 4. PROFILES & DESIGNATIONS (Critical: Joins on every authenticated request)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_department_id 
    ON profiles (department_id) 
    WHERE department_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designations_department_id 
    ON designations (department_id) 
    WHERE department_id IS NOT NULL;
```

*(Architectural Follow-up for `employee_shift_assignments`)*: In a maintenance window, enable `CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA extensions;` and add an exclusion constraint to mathematically guarantee zero overlapping date ranges per employee:
```sql
ALTER TABLE employee_shift_assignments
ADD CONSTRAINT excl_emp_shift_overlapping_dates
EXCLUDE USING gist (
    profile_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
);
```

---

#### Phase 2: Medium Priority (Master Data, Payroll Batching & Remaining FKs)

```sql
SET statement_timeout = 0;
SET lock_timeout = '5s';
SET search_path TO tenant_primary;

-- ============================================================================
-- 5. DEPARTMENTS
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_location_active 
    ON departments (location_id, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_manager_id 
    ON departments (manager_id) 
    WHERE manager_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_departments_code 
    ON departments (code) 
    WHERE code IS NOT NULL;


-- ============================================================================
-- 6. OFFICE SHIFTS
-- ============================================================================
-- Covers active shift dropdowns filtered by location and/or department
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_loc_dept_active 
    ON office_shifts (location_id, department_id) 
    WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_department_id 
    ON office_shifts (department_id) 
    WHERE department_id IS NOT NULL;


-- ============================================================================
-- 7. MONTHLY ATTENDANCE SUMMARY & MONTHLY BONUSES
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_paid_by 
    ON monthly_attendance_summary (paid_by) 
    WHERE paid_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_set_salary_by 
    ON monthly_attendance_summary (set_for_salary_by) 
    WHERE set_for_salary_by IS NOT NULL;

-- Batch payroll runs query bonuses across ALL employees for a given (year, month),
-- which `monthly_bonuses_profile_month_year_title_idx` cannot serve due to leading `profile_id`
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_bonuses_period 
    ON monthly_bonuses (year, month);
```

#### Automated Generator for All Remaining Unindexed Foreign Keys (Across All 32 Constraints)
Run this read-only diagnostic query in the Supabase SQL Editor. It inspects `pg_constraint` and `pg_index` across `public` and all `tenant_*` schemas and outputs exact, copy-pasteable `CREATE INDEX CONCURRENTLY` statements for every remaining unindexed FK:

```sql
WITH fk_constraints AS (
    SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name,
        con.conrelid AS table_oid,
        con.conkey AS fk_attnums,
        ARRAY(
            SELECT a.attname
            FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
            ORDER BY k.ord
        ) AS fk_columns
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f'
      AND (n.nspname = 'public' OR n.nspname LIKE 'tenant\_%')
),
indexed_Check AS (
    SELECT
        fk.*,
        EXISTS (
            SELECT 1
            FROM pg_index i
            WHERE i.indrelid = fk.table_oid
              AND i.indisvalid
              AND i.indpred IS NULL -- Must be a full index to protect FK deletes unconditionally
              -- Check if leading index columns match FK columns (in any prefix order for equality)
              AND (i.indkey::smallint[])[0 : array_length(fk.fk_attnums, 1) - 1] @> fk.fk_attnums
              AND fk.fk_attnums @> (i.indkey::smallint[])[0 : array_length(fk.fk_attnums, 1) - 1]
        ) AS is_indexed
    FROM fk_constraints fk
)
SELECT format(
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON %I.%I (%s);',
    left('idx_' || table_name || '_' || array_to_string(fk_columns, '_'), 63),
    schema_name,
    table_name,
    array_to_string(array_agg(quote_ident(col)), ', ')
) AS ddl_statement
FROM indexed_check, unnest(fk_columns) AS col
WHERE NOT is_indexed
GROUP BY schema_name, table_name, constraint_name, fk_columns
ORDER BY schema_name, table_name;
```
*(Note: Partial indexes `WHERE col IS NOT NULL` optimize query speed and space, and PostgreSQL skips FK checks when the parent is deleted if child rows are NULL—however, PostgreSQL's planner still scans unless a full index exists when validating parent `DELETE`/`UPDATE` triggers. For tables where parent rows are actually deleted rather than soft-deleted via `is_active = false`, use full indexes without `WHERE col IS NOT NULL`.)*

#### Multi-Tenant Non-Transactional Rollout Script
To apply your DDL file across all `tenant_*` schemas safely outside a transaction block:
```bash
#!/usr/bin/env bash
set -euo pipefail

# MUST use Direct Connection or Session Mode Pooler (Port 5432), NOT Port 6543
DB_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

SCHEMAS=$(psql "$DB_URL" -Atc "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' ORDER BY nspname;")

for SCHEMA in $SCHEMAS; do
  echo "==> Applying indexes to schema: $SCHEMA"
  sed "s/SET search_path TO tenant_primary;/SET search_path TO ${SCHEMA};/g" ./indexes_migration.sql \
    | psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction=off
done

echo "==> Checking for INVALID indexes..."
psql "$DB_URL" -c "SELECT n.nspname, c.relname AS index_name FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE NOT i.indisvalid;"
```

---

### 3. Multi-Tenant Schema Contract Considerations for Supabase

Running a Schema-per-Tenant (`public`, `tenant_interspace`, `tenant_primary`) architecture on Supabase requires strict adherence to a **Schema Contract** across PostgREST, Auth/RLS, and PostgreSQL internals:

1. **PostgREST `db_schemas` & Schema Cache Reload Bottlenecks**:
   * Supabase exposes schemas via the PostgREST `pgrst.db_schemas` setting. Every exposed `tenant_*` schema is introspected into PostgREST's in-memory schema cache whenever `NOTIFY pgrst, 'reload schema'` fires (or via the `pgrst_watch` DDL event trigger).
   * **Risk**: At >100 tenant schemas, reloading the PostgREST schema cache takes several seconds and spikes CPU/memory on the API gateway, causing transient `503` or `PGRST002` errors during deployments.
   * **Mitigation**: If your backend (Next.js/Node/Edge Functions) connects directly via SQL/ORM rather than client-side `supabase-js` PostgREST calls, **do not expose `tenant_*` schemas in PostgREST**. Keep only `public` exposed and route tenant queries through backend services or tightly controlled RPCs.

2. **Cross-Tenant Leakage via `Accept-Profile` / `Content-Profile`**:
   * If `supabase-js` (`supabase.schema('tenant_interspace').from('attendance')`) IS used directly from the browser/mobile app, PostgREST switches schemas purely via HTTP headers (`Accept-Profile` / `Content-Profile`).
   * **Contract Rule**: An authenticated user from `tenant_primary` can trivially spoof the HTTP header `Accept-Profile: tenant_interspace`! Therefore, **every table in every `tenant_*` schema MUST have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)** AND an explicit tenant-assertion policy reading from immutable `app_metadata` (never `user_metadata`, which users can mutate via `supabase.auth.updateUser()`):
     ```sql
     -- Enforce inside every tenant_<slug> table policy:
     ((auth.jwt() -> 'app_metadata' ->> 'tenant_schema') = current_schema())
     ```

3. **`SECURITY DEFINER` Function Hijacking**:
   * In multi-schema setups, developers often write shared helper functions in `public` marked `SECURITY DEFINER`.
   * If `search_path` is dynamically set per tenant, a `SECURITY DEFINER` function without a locked `SET search_path` is vulnerable to privilege escalation, OR conversely, if locked to `SET search_path = public`, it will fail to resolve `tenant_*` tables.
   * **Contract Rule**: Shared functions operating on tenant tables should use **`SECURITY INVOKER`** (the default) so RLS and the caller's `search_path` apply naturally.

4. **Shared vs. Isolated Reference Tables (`public` vs `tenant_*`)**:
   * Never create Foreign Keys from `tenant_*` tables to high-churn tables in `public`, and **never** create FKs from `public` into `tenant_*`. Cross-schema FKs to `auth.users(id)` are acceptable for `profiles.id`, but avoid `ON DELETE CASCADE` on `auth.users` if audit/payroll retention laws require preserving historical `attendance` and `monthly_attendance_summary` records for terminated users.

5. **Ceiling of Schema-per-Tenant & Shared-Schema Horizon**:
   * Plan an architectural ceiling: Schema-per-tenant works cleanly on Supabase up to **~150–250 tenants**. If PayFix targets thousands of SMB tenants, freeze new schema creation and migrate toward a **Shared-Schema (`tenant_id` column + Composite Indexes leading with `tenant_id` + RLS)** model before `pg_class` exceeds 100,000+ relations.

---

### 4. Supabase Connection Pooler Best Practices (Supavisor vs. PgBouncer)

Supabase has deprecated dedicated per-project PgBouncer in favor of **Supavisor** (a cloud-native, multi-tenant Elixir connection pooler), alongside optional Dedicated Pooler (PgBouncer co-located on your compute instance for Pro/Enterprise plans).

#### Connection Modes & Port Topology
| Mode | Host / Port | Connection Lifecycle | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **Transaction Mode** | `*.pooler.supabase.com:6543` | Backend PG connection assigned **only for the duration of a single transaction**, then returned to pool. | Serverless functions (Vercel, Edge Functions), Next.js API routes, high-concurrency app servers. |
| **Session Mode** | `*.pooler.supabase.com:5432` | Backend PG connection pinned to client until disconnect. | Persistent backend workers, `pg_dump`, interactive GUI clients (TablePlus/DBeaver), **running `CREATE INDEX CONCURRENTLY`** (if IPv4-only). |
| **Direct Connection** | `db.<ref>.supabase.co:5432` | Bypasses Supavisor completely; speaks directly to Postgres (IPv6 default unless IPv4 add-on enabled). | Zero proxy overhead; ideal for CI/CD migrations, `CONCURRENTLY` DDL, logical replication. |

#### Critical Rules for PayFix's Multi-Tenant Architecture on Port `6543` (Transaction Mode)

1. **NEVER Execute Session-Level `SET search_path` in Transaction Mode**:
   * **The Trap**: If your backend runs `await db.query("SET search_path TO tenant_interspace")` followed by `await db.query("SELECT * FROM attendance")` as two separate pool queries on Port `6543`, **two major bugs occur**:
     1. Query 2 may grab a *different* physical connection from the pool and query `public` or fail!
     2. Worse, Connection 1 is returned to the pool *polluted* with `tenant_interspace`, potentially serving **another tenant's data** on a subsequent un-scoped query (**Catastrophic Cross-Tenant Data Leak**).
   * **The Fix**: Always wrap tenant queries in an explicit transaction using `SET LOCAL` (which automatically resets on `COMMIT`/`ROLLBACK`), OR explicitly schema-qualify every SQL identifier:
     ```sql
     BEGIN;
     SET LOCAL search_path TO tenant_interspace, public;
     SELECT * FROM attendance WHERE profile_id = $1 AND date = $2;
     COMMIT;
     ```

2. **Prepared Statements Handling**:
   * While newer Supavisor versions added protocol-level prepared statement multiplexing, client libraries/ORMs that issue named SQL-level `PREPARE` statements or rely on legacy PgBouncer semantics will throw `prepared statement "s0" already exists` (`42P05`) or `does not exist` (`26000`) on Port `6543`.
   * **Configuration**:
     * **Prisma**: Append `?pgbouncer=true&connection_limit=1` (for serverless) to `DATABASE_URL` (`:6543`), and set `DIRECT_URL` (`:5432`) for migrations.
     * **`postgres.js` (porsager)**: Set `{ prepare: false }` when connecting to `:6543`.
     * **Drizzle / `node-postgres` (`pg`)**: Avoid named statements (`name: '...'` in query config) on `:6543`.

3. **Pool Sizing Formula (`max_client_conn` vs. `default_pool_size`)**:
   * Supabase reserves ~40–60% of `max_connections` for internal services (`supabase_auth_admin`, `authenticator`/PostgREST, `supabase_storage_admin`, Realtime).
   * Set Supavisor's **Pool Size** (`default_pool_size`) to **`min(CPU_Cores * 4, Available_Non_Reserved_PG_Connections * 0.75)`**:
     * *Example (Compute Small - 2 vCPU, 2GB RAM, ~90 `max_connections`)*: Keep Supavisor Pool Size at **15–25**. Setting pool size to 60+ on a 2-core instance causes severe OS context-switching and LWLock contention during concurrent clock-in bursts (e.g., 9:00 AM shift start), *reducing* total throughput.
   * For sub-millisecond latency without regional proxy hops on high-throughput payroll runs, enable the **Dedicated Pooler (PgBouncer)** on Supabase Pro/Team—it runs directly on your Postgres VM, eliminating the network hop between Supavisor's shared Elixir cluster and your database.