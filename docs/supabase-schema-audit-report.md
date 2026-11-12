# PayFix Database Schema & Indexing Audit Report
**Target Environment:** Supabase (PostgreSQL 15+)  
**Architecture:** Schema-per-Tenant (`public`, `tenant_interspace`, `tenant_primary`)  

---

## 1. Executive Assessment

### High-Risk Bottlenecks & Operational Hazards
1. **Unbounded Sequential Scans on Core Operational Paths (`shift_roster` & `employee_shift_assignments`):**
   - **Impact:** The new workforce management modules introduced in the `develop` branch lack basic secondary indexes. Every time an employee loads their dashboard, clocks in, or a manager renders a monthly departmental roster view, PostgreSQL is forced to execute a **Sequential Scan (`Seq Scan`)** across the entire table. 
   - **Scaling Implication:** While unnoticeable in staging with <1,000 rows, this causes CPU saturation, buffer pool thrashing, and exponential latency degradation ($O(N)$ complexity) as `shift_roster` grows by `Employees × 365` rows per year per tenant.

2. **Data Integrity & Race Condition Vulnerabilities:**
   - **`shift_roster`:** Lacks a `UNIQUE` constraint on `(profile_id, date)` (or `(profile_id, date, shift_id)` if split shifts are allowed). Concurrent API requests can create duplicate shift assignments for the same employee on the same day.
   - **`employee_shift_assignments`:** Lacks an exclusion constraint or partial unique index on active assignments (`effective_to IS NULL`). An employee can inadvertently hold multiple conflicting primary shift regimens simultaneously.

3. **Unindexed Foreign Keys (32 Identified) & Lock Amplification:**
   - **Impact:** In PostgreSQL, foreign key constraints automatically index the *target* (parent) primary key, **not** the *referencing* (child) column. 
   - **Lock Hazard:** Whenever a parent record in `office_locations`, `office_shifts`, or `departments` is deleted or has its primary key updated, PostgreSQL must verify that no child rows exist in `attendance`, `profiles`, or `shift_roster`. Without child indexes, PostgreSQL acquires locks and performs full table scans on massive child tables like `attendance`, leading to cascading query timeouts and potential connection pool exhaustion.

4. **Redundant Index Bloat on `attendance`:**
   - `attendance` currently maintains **three overlapping indexes** on `profile_id`:
     1. `attendance_profile_id_date_key` (`UNIQUE (profile_id, date)`)
     2. `idx_attendance_profile_date` (`(profile_id, date)`) — **100% redundant** with the `UNIQUE` constraint index.
     3. `idx_attendance_profile_id` (`(profile_id)`) — **99% redundant** because PostgreSQL B-Tree indexes can use the leading column of `(profile_id, date)` for single-column `profile_id` lookups.
   - **Impact:** Every `INSERT` and `UPDATE` on `attendance` pays a 3x write amplification penalty, increasing WAL generation, slowing down clock-in mutations, and bloating RAM cache (`shared_buffers`).

5. **Multi-Tenant Supabase RLS Performance Penalty:**
   - Supabase relies heavily on Row-Level Security (RLS). When RLS policies evaluate joins or subqueries against `profiles.department_id` or `employee_shift_assignments.profile_id` without supporting indexes, the planner cannot push down predicates into an `Index Scan`. A single REST API call via PostgREST can trigger nested loop sequential scans across thousands of rows.

---

## 2. Prioritized Remediation Plan (DDL Migrations)

> **⚠️ Execution Note on `CREATE INDEX CONCURRENTLY`:**
> - `CONCURRENTLY` prevents blocking writes (`INSERT`/`UPDATE`/`DELETE`) on live production tables by acquiring only a `SHARE UPDATE EXCLUSIVE` lock.
> - **Crucial:** PostgreSQL forbids running `CREATE INDEX CONCURRENTLY` inside a transaction block (`BEGIN ... COMMIT`) or inside a `DO $$ ... $$` PL/pgSQL block.
> - If running via Supabase CLI migrations (`supabase db push`), ensure your migration runner does not wrap the file in a single transaction, or execute these per-schema via a direct session-mode connection (`psql`).
> - Below, scripts are explicitly scoped to `<schema_name>` (e.g., `tenant_primary`). Repeat execution for `public` and `tenant_interspace`.

---

### Phase 1: High Priority (Immediate Production Hotfix)
*Targets high-frequency read paths, clock-in flows, roster views, and index de-duplication.*

```sql
-- ============================================================================
-- PHASE 1: HIGH PRIORITY REMEDIATION
-- Replace `tenant_primary` with `public` and `tenant_interspace` per run.
-- Run outside of a transaction block!
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ATTENDANCE: Foreign Key Indexes & Redundant Index Cleanup
-- ----------------------------------------------------------------------------

-- Index foreign keys for fast location/shift analytics and lock prevention
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_location_id 
    ON tenant_primary.attendance (location_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_shift_id 
    ON tenant_primary.attendance (shift_id);

-- Drop exact duplicate index (covered by UNIQUE constraint `attendance_profile_id_date_key`)
DROP INDEX CONCURRENTLY IF EXISTS tenant_primary.idx_attendance_profile_date;

-- Drop single-column prefix duplicate (covered by leading column of `attendance_profile_id_date_key`)
DROP INDEX CONCURRENTLY IF EXISTS tenant_primary.idx_attendance_profile_id;


-- ----------------------------------------------------------------------------
-- 2. SHIFT ROSTER: Calendar Views, Lookups, and Data Integrity
-- ----------------------------------------------------------------------------

-- Primary lookup & integrity: 1 regular shift per employee per day
-- Note: If an employee can have multiple extra shifts per day, change to:
-- UNIQUE (profile_id, date, shift_id)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_profile_date_uniq 
    ON tenant_primary.shift_roster (profile_id, date) 
    WHERE is_extra_shift = false;

-- General fallback index if extra shifts exist for the same profile + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_profile_date 
    ON tenant_primary.shift_roster (profile_id, date);

-- Monthly Department Calendar View: WHERE department_id = X AND date BETWEEN Y AND Z
-- INCLUDE clause enables Index-Only Scans for rendering calendar grids without heap fetches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_dept_date_cov 
    ON tenant_primary.shift_roster (department_id, date) 
    INCLUDE (profile_id, shift_id, status, is_extra_shift);

-- Global date-range queries (e.g., daily cron jobs evaluating today's roster)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_date 
    ON tenant_primary.shift_roster (date);

-- Foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_shift_id 
    ON tenant_primary.shift_roster (shift_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_allotted_by 
    ON tenant_primary.shift_roster (allotted_by) 
    WHERE allotted_by IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 3. EMPLOYEE SHIFT ASSIGNMENTS: Clock-in Resolution & Active Regimen
-- ----------------------------------------------------------------------------

-- Enforce only ONE currently active (open-ended) shift assignment per employee
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_active_uniq 
    ON tenant_primary.employee_shift_assignments (profile_id) 
    WHERE effective_to IS NULL;

-- Historical & date-bounded assignment resolution:
-- Optimizes: WHERE profile_id = $1 AND effective_from <= $2 AND (effective_to IS NULL OR effective_to >= $2)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_profile_dates 
    ON tenant_primary.employee_shift_assignments (profile_id, effective_from DESC, effective_to);

-- Foreign key index for location-based shift assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_location_id 
    ON tenant_primary.employee_shift_assignments (location_id);

-- GIN indexes for JSONB containment queries (e.g., finding who is assigned to a deleted/modified shift ID)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_assigned_ids_gin 
    ON tenant_primary.employee_shift_assignments USING gin (assigned_shift_ids jsonb_path_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emp_shift_assign_rotation_ids_gin 
    ON tenant_primary.employee_shift_assignments USING gin (rotation_shift_ids jsonb_path_ops);


-- ----------------------------------------------------------------------------
-- 4. PROFILES & DESIGNATIONS: Unindexed Department Foreign Keys
-- ----------------------------------------------------------------------------

-- Critical for RLS policies, org charts, and department filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_department_id 
    ON tenant_primary.profiles (department_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designations_department_id 
    ON tenant_primary.designations (department_id);
```

---

### Phase 2: Medium Priority (Organizational & Payroll Modules)
*Targets master-data lookups, payroll processing, and remaining unindexed FKs.*

```sql
-- ============================================================================
-- PHASE 2: MEDIUM PRIORITY REMEDIATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS: Lookups, Hierarchy, and Uniqueness
-- ----------------------------------------------------------------------------

-- Ensure department codes are unique per tenant
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_code_uniq 
    ON tenant_primary.departments (code);

-- Foreign key & filter indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_location_id 
    ON tenant_primary.departments (location_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_manager_id 
    ON tenant_primary.departments (manager_id) 
    WHERE manager_id IS NOT NULL;

-- Partial index for active department dropdowns in UI
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_active 
    ON tenant_primary.departments (location_id, name) 
    WHERE is_active = true;


-- ----------------------------------------------------------------------------
-- 2. OFFICE SHIFTS: Shift Selection & Default Resolution
-- ----------------------------------------------------------------------------

-- Ensure shift codes are unique per tenant
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_code_uniq 
    ON tenant_primary.office_shifts (code);

-- Composite index for UI filters and shift resolution by Location + Department
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_loc_dept_active 
    ON tenant_primary.office_shifts (location_id, department_id) 
    WHERE is_active = true;

-- Standalone FK index on department_id (since it is second in the composite index above)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_department_id 
    ON tenant_primary.office_shifts (department_id) 
    WHERE department_id IS NOT NULL;

-- Fast lookup for fallback default shifts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_default 
    ON tenant_primary.office_shifts (location_id, is_default) 
    WHERE is_default = true AND is_active = true;


-- ----------------------------------------------------------------------------
-- 3. MONTHLY ATTENDANCE SUMMARY & BONUSES: Audit FKs & Payroll Runs
-- ----------------------------------------------------------------------------

-- Partial FK indexes: only index rows where audit user IDs are populated (saves 50-80% index space)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_paid_by 
    ON tenant_primary.monthly_attendance_summary (paid_by) 
    WHERE paid_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_set_salary_by 
    ON tenant_primary.monthly_attendance_summary (set_for_salary_by) 
    WHERE set_for_salary_by IS NOT NULL;

-- Optimize bulk payroll batch processing by (year, month) for monthly_bonuses
-- (Existing index has `profile_id` as the leading column, making bulk period queries scan the entire index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_bonuses_period 
    ON tenant_primary.monthly_bonuses (year, month);
```

---

### Automated Diagnostic Query: Catching All 32 Unindexed Foreign Keys
Because 32 unindexed foreign keys were flagged in telemetry across the schemas, run this diagnostic query in the Supabase SQL Editor to automatically generate the exact `CREATE INDEX CONCURRENTLY` statements for every remaining unindexed FK across `public`, `tenant_interspace`, and `tenant_primary`:

```sql
WITH unindexed_fks AS (
    SELECT
        ns.nspname AS schema_name,
        cl.relname AS table_name,
        con.conname AS constraint_name,
        att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl ON con.conrelid = cl.oid
    JOIN pg_namespace ns ON cl.relnamespace = ns.oid
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND array_length(con.conkey, 1) = 1 -- Single-column FKs
      AND ns.nspname IN ('public', 'tenant_interspace', 'tenant_primary')
      AND NOT EXISTS (
          SELECT 1
          FROM pg_index idx
          WHERE idx.indrelid = con.conrelid
            AND idx.indkey[0] = con.conkey[1] -- Check if FK column is the leading column of any index
            AND idx.indisvalid
      )
)
SELECT 
    format(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_%I_%I ON %I.%I (%I);',
        table_name, column_name, schema_name, table_name, column_name
    ) AS ddl_statement
FROM unindexed_fks
ORDER BY schema_name, table_name, column_name;
```

---

## 3. Multi-Tenant Schema Contract Considerations for Supabase

Running a **Schema-per-Tenant** architecture (`public`, `tenant_interspace`, `tenant_primary`) on Supabase requires strict operational guardrails, as Supabase is natively designed around a single-schema (`public`) + Row-Level Security (`tenant_id`) model.

### 1. Schema Drift & Migration Parity
- **The Problem:** As observed in your telemetry, features merged from `develop` (`departments`, `office_shifts`, `shift_roster`) can easily create schema drift where one tenant schema has an index or constraint and another does not.
- **Remediation:** Never maintain manual SQL files per tenant. Use a deterministic schema-template runner or a migration wrapper that iterates over a central `public.tenants` registry table.
- **Verification Contract:** Implement a CI check that compares `information_schema.columns`, `pg_indexes`, and `pg_constraint` hashes across `tenant_primary` and `tenant_interspace`. Any discrepancy should fail the deployment pipeline.

### 2. PostgREST (`Accept-Profile` / `Content-Profile`) & Catalog Bloat
- **How Supabase Routes Schemas:** When using the Supabase JS client (`supabase.schema('tenant_interspace').from('attendance')`), PostgREST switches the schema context using HTTP headers (`Accept-Profile` for `GET`, `Content-Profile` for mutations).
- **Exposed Schemas Limit:** Every tenant schema added to PostgREST's `db-schemas` configuration forces PostgREST to introspect all tables, views, functions, and foreign keys across *all* exposed schemas into its in-memory schema cache upon startup or `NOTIFY pgrst, 'reload schema'`.
- **Scaling Ceiling:** Schema-per-tenant works well for **5 to ~50 enterprise tenants**. Beyond 100+ schemas:
  - PostgREST schema cache reloads will spike CPU and take several seconds.
  - `pg_class` and `pg_attribute` system catalogs bloat, degrading `pg_dump` times and autovacuum scheduling.
  - Each PostgreSQL backend caches catalog metadata (`relcache`) per session for every table it touches across every tenant schema, multiplying memory usage per connection.

### 3. `SECURITY DEFINER` Functions & `search_path` Injection
- If you share stored procedures/RPCs in the `public` schema that operate on tenant schemas dynamically via `search_path`, avoid relying on session-level `SET search_path`.
- In Supabase, explicitly qualify schema references or pass the tenant context via JWT claims (`auth.jwt() ->> 'tenant_schema'`) inside carefully locked-down RPCs, and always set `SET search_path = ''` on `SECURITY DEFINER` functions where strict isolation is required.

### 4. RLS Performance with Multi-Schema Functions
- Whenever an RLS policy calls a helper function (e.g., `get_current_user_role()` or `auth.uid()`), **always wrap scalar functions in an `(SELECT ...)` initPlan** and mark helper functions as `STABLE`:
  ```sql
  -- BAD: Evaluated once per row scanned!
  USING (profile_id = auth.uid())

  -- GOOD: Cached by PostgreSQL planner as an InitPlan (evaluated once per query)
  USING (profile_id = (SELECT auth.uid()))
  ```

---

## 4. Supabase Connection Pooler Best Practices (Supavisor vs. PgBouncer)

Supabase has transitioned from legacy single-tenant PgBouncer instances to **Supavisor** (a cloud-native, multi-tenant Elixir connection pooler), though dedicated PgBouncer remains available on custom enterprise configurations.

### Connection Modes Matrix

| Feature / Workload | Transaction Mode (`Port 6543`) | Session Mode (`Port 5432` via Pooler) | Direct Connection (`Port 5432` Direct DB) |
| :--- | :--- | :--- | :--- |
| **Connection Lifecycle** | Borrowed only for the duration of a single transaction (`BEGIN...COMMIT`). | Pinned to the client for the entire TCP session. | Dedicated Postgres backend process on the DB host. |
| **Concurrency Scaling** | **Extreme** (Thousands of serverless clients share ~20-50 DB connections). | **Low** (1 client = 1 backend connection until disconnect). | **Low** (Hard-capped by `max_connections`). |
| **Session State (`SET`)** | ❌ **Unsafe** (`SET search_path` leaks or resets between queries unless `SET LOCAL` is used). | ✅ **Safe** (Session variables and temp tables persist). | ✅ **Safe**. |
| **Prepared Statements** | ⚠️ Requires protocol-level handling or disabling client-side prepare. | ✅ Fully Supported. | ✅ Fully Supported. |
| **`CREATE INDEX CONCURRENTLY`** | ❌ **Fails / Unsafe** | ✅ Supported. | ✅ **Recommended** for DDL & Migrations. |
| **Ideal PayFix Use Case** | Next.js / Edge Functions / Node.js API / Mobile Client bursts. | Long-lived backend workers needing advisory locks or temp tables. | GitHub Actions CI/CD, Prisma/Drizzle/Supabase CLI Migrations. |

---

### Critical Best Practices for PayFix's Multi-Tenant Architecture

#### 1. Never Use Session-Level `SET search_path` in Transaction Mode (Port 6543)
This is the **#1 cause of cross-tenant data leaks** in schema-per-tenant PostgreSQL applications.
- **The Hazard:** If your backend connects on Port `6543` (Transaction Mode) and runs:
  ```sql
  SET search_path TO tenant_interspace, public;
  SELECT * FROM attendance;
  ```
  Those two statements run as **two separate transactions**, potentially on **two different PostgreSQL backend connections**. Connection A gets tainted with `tenant_interspace`, while your `SELECT` runs on Connection B (which might be pointing to `tenant_primary` from a previous request!).
- **The Solution:**
  1. **Always fully qualify table names** in application queries (`SELECT * FROM tenant_interspace.attendance`), **OR**
  2. Wrap the `search_path` change and the query inside a single explicit transaction using `SET LOCAL`:
     ```sql
     BEGIN;
     SET LOCAL search_path TO tenant_interspace, public;
     SELECT * FROM attendance WHERE date = CURRENT_DATE;
     COMMIT;
     ```
     `SET LOCAL` guarantees the setting is automatically reverted the instant the transaction commits or rolls back.

#### 2. ORM & Driver Configuration for Port 6543 (Transaction Mode)
If PayFix uses an ORM (Prisma, Drizzle, TypeORM) or `pg` / `postgres.js` in serverless environments (Vercel, AWS Lambda, Supabase Edge Functions):
- **Prisma:** Append `?pgbouncer=true&connection_limit=1` to `DATABASE_URL` (Port `6543`), and set `DIRECT_URL` to Port `5432` for migrations.
- **Postgres.js (`postgres` npm package):** Disable prepared statements when connecting to port `6543`:
  ```typescript
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  ```
  *(Note: Supavisor recently added protocol-level prepared statement support, but disabling client-side named prepared statements in serverless functions remains the safest defense against `prepared statement "s0" already exists` errors).*

#### 3. Right-Sizing the Pool (`max_connections` vs. Pool Size)
- Do **not** allocate 100% of PostgreSQL's `max_connections` to Supavisor/PgBouncer.
- **Rule of Thumb Allocation:**
  - **40% - 50%** to Supavisor Transaction Pool (Application API traffic).
  - **20% - 30%** reserved for Supabase PostgREST, Auth (GoTrue), and Realtime internal services.
  - **20%** free headroom for Direct Connections (migrations, `CREATE INDEX CONCURRENTLY`, `pg_dump`, emergency debugging).
- **Statement Timeout Guardrail:** Set a global or role-level timeout on your API connection role so a single unindexed query cannot pin a pooler connection indefinitely:
  ```sql
  ALTER ROLE authenticator SET statement_timeout = '10s';
  ALTER ROLE authenticated SET statement_timeout = '8s';
  ```