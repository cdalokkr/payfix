### 1. Production PostgreSQL DDL (`tenant_primary` & `tenant_interspace`)

> **Execution Note:** `CREATE [UNIQUE] INDEX CONCURRENTLY` cannot be executed inside an explicit `BEGIN ... COMMIT` transaction block. Execute this script via `psql` with autocommit enabled (default) or execute each statement in its own independent connection cycle in your migration runner. `SET lock_timeout = '5s'` applies at the session level to protect live tenant traffic during initial ShareUpdateExclusive lock acquisition.

#### Pre-Flight Duplicate Check (Run Read-Only Before Migration)
Because item #4 introduces a partial `UNIQUE` index (`uq_departments_code`), verify zero duplicate non-null codes exist in either tenant schema before running the DDL:
```sql
SELECT 'tenant_primary' AS tenant_schema, code, COUNT(*)
FROM tenant_primary.departments
WHERE code IS NOT NULL
GROUP BY code HAVING COUNT(*) > 1
UNION ALL
SELECT 'tenant_interspace' AS tenant_schema, code, COUNT(*)
FROM tenant_interspace.departments
WHERE code IS NOT NULL
GROUP BY code HAVING COUNT(*) > 1;
```

#### Exact Migration SQL (Zero `public` Schema Impact)
```sql
-- ============================================================================
-- SESSION SAFETY GUARDS
-- ============================================================================
SET lock_timeout = '5s';
SET statement_timeout = '0'; -- Prevent timeout abort during concurrent index build

-- ============================================================================
-- SCHEMA: tenant_primary
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_location_date_status
  ON tenant_primary.attendance (location_id, date, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_date_status
  ON tenant_primary.shift_roster (date, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_location_active
  ON tenant_primary.departments (location_id, is_active);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_departments_code
  ON tenant_primary.departments (code)
  WHERE code IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_loc_dept_active
  ON tenant_primary.office_shifts (location_id, department_id)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_paid_by
  ON tenant_primary.monthly_attendance_summary (paid_by)
  WHERE paid_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_set_salary_by
  ON tenant_primary.monthly_attendance_summary (set_for_salary_by)
  WHERE set_for_salary_by IS NOT NULL;

-- ============================================================================
-- SCHEMA: tenant_interspace
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_location_date_status
  ON tenant_interspace.attendance (location_id, date, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_roster_date_status
  ON tenant_interspace.shift_roster (date, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_location_active
  ON tenant_interspace.departments (location_id, is_active);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_departments_code
  ON tenant_interspace.departments (code)
  WHERE code IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_shifts_loc_dept_active
  ON tenant_interspace.office_shifts (location_id, department_id)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_paid_by
  ON tenant_interspace.monthly_attendance_summary (paid_by)
  WHERE paid_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_summary_set_salary_by
  ON tenant_interspace.monthly_attendance_summary (set_for_salary_by)
  WHERE set_for_salary_by IS NOT NULL;

-- ============================================================================
-- POST-MIGRATION VALIDATION (Ensure zero INVALID concurrent builds)
-- ============================================================================
SELECT
  n.nspname AS schema_name,
  c.relname AS index_name,
  i.indisvalid AS is_valid,
  i.indisunique AS is_unique
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('tenant_primary', 'tenant_interspace')
  AND c.relname IN (
    'idx_attendance_location_date_status',
    'idx_shift_roster_date_status',
    'idx_departments_location_active',
    'uq_departments_code',
    'idx_office_shifts_loc_dept_active',
    'idx_monthly_summary_paid_by',
    'idx_monthly_summary_set_salary_by'
  )
ORDER BY n.nspname, c.relname;
```

---

### 2. Additions for `lib/tenant/schema-contract.ts`

Add these 7 entries to `TENANT_REQUIRED_INDEXES`. Depending on whether your contract array uses structured metadata objects or index name strings, apply the exact matching block below:

#### Pattern A: Structured Contract Entries (Recommended / Standard Schema-Contract Pattern)
```typescript
// Inside lib/tenant/schema-contract.ts -> TENANT_REQUIRED_INDEXES
export interface TenantIndexContract {
  table: string;
  name: string;
  columns: readonly string[];
  unique?: boolean;
  where?: string;
}

// Append to TENANT_REQUIRED_INDEXES:
  {
    table: 'attendance',
    name: 'idx_attendance_location_date_status',
    columns: ['location_id', 'date', 'status'],
  },
  {
    table: 'shift_roster',
    name: 'idx_shift_roster_date_status',
    columns: ['date', 'status'],
  },
  {
    table: 'departments',
    name: 'idx_departments_location_active',
    columns: ['location_id', 'is_active'],
  },
  {
    table: 'departments',
    name: 'uq_departments_code',
    columns: ['code'],
    unique: true,
    where: 'code IS NOT NULL',
  },
  {
    table: 'office_shifts',
    name: 'idx_office_shifts_loc_dept_active',
    columns: ['location_id', 'department_id'],
    where: 'is_active = true',
  },
  {
    table: 'monthly_attendance_summary',
    name: 'idx_monthly_summary_paid_by',
    columns: ['paid_by'],
    where: 'paid_by IS NOT NULL',
  },
  {
    table: 'monthly_attendance_summary',
    name: 'idx_monthly_summary_set_salary_by',
    columns: ['set_for_salary_by'],
    where: 'set_for_salary_by IS NOT NULL',
  },
```

*(If `TENANT_REQUIRED_INDEXES` in your codebase is typed as `Record<string, readonly string[]>` keyed by table name or a flat `readonly string[]` list of index names for `pg_indexes` assertions, add the exact names: `'idx_attendance_location_date_status'`, `'idx_shift_roster_date_status'`, `'idx_departments_location_active'`, `'uq_departments_code'`, `'idx_office_shifts_loc_dept_active'`, `'idx_monthly_summary_paid_by'`, `'idx_monthly_summary_set_salary_by'`.)*

---

### 3. Additions for `lib/tenant/provisioning.ts`

How new tenant schemas inherit these indexes depends on how `lib/tenant/provisioning.ts` bootstraps a new tenant:

#### Case 1: Template Cloning (`CREATE TABLE new_tenant.x (LIKE tenant_primary.x INCLUDING ALL)`)
If `provisioning.ts` clones table structures from `tenant_primary` using `INCLUDING ALL` (or `INCLUDING INDEXES`), PostgreSQL automatically clones composite, partial, and unique indexes onto the newly provisioned schema—**except** PostgreSQL auto-generates names like `departments_code_idx` for cloned non-constraint indexes unless explicitly renamed or created. Verify that your schema-contract validator checks `TENANT_REQUIRED_INDEXES` by exact `indexname`; if it does, execute the explicit DDL block in Case 2 during provisioning so `pg_indexes.indexname` matches `TENANT_REQUIRED_INDEXES` 1:1.

#### Case 2: Explicit Tenant DDL Provisioning (Inside Transaction vs. Post-Transaction Step)
> **Critical Architectural Nuance:** Tenant provisioning normally runs inside a `BEGIN ... COMMIT` transaction block. PostgreSQL **forbids** `CREATE INDEX CONCURRENTLY` inside a transaction block (`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`).
> - For brand-new, empty tenant schemas inside a provisioning transaction, standard `CREATE [UNIQUE] INDEX IF NOT EXISTS` takes `< 1ms` and blocks zero users because the tenant does not exist yet.
> - If your provisioning pipeline runs a post-commit non-transactional index/backfill phase (or shared idempotent tenant-sync helper), run `CONCURRENTLY` outside the transaction block with explicit identifier quoting and zero `public` schema fallback.

Add this helper and invoke it in `lib/tenant/provisioning.ts`:

```typescript
// Inside lib/tenant/provisioning.ts

const ASSERT_TENANT_SCHEMA_REGEX = /^tenant_[a-z0-9_]+$/;

function quoteTenantSchema(schemaName: string): string {
  if (schemaName === 'public' || !ASSERT_TENANT_SCHEMA_REGEX.test(schemaName)) {
    throw new Error(
      `[TenantProvisioning] Refusing to execute tenant DDL on invalid or forbidden schema: "${schemaName}"`
    );
  }
  return `"${schemaName}"`;
}

/**
 * Builds the 7 audit-mandated composite & partial indexes for a tenant schema.
 *
 * @param schemaName Target tenant schema (strictly validated; never `public`)
 * @param options.concurrent Set `true` ONLY when executing outside a BEGIN/COMMIT block
 *                           (e.g., post-commit provisioning step or live tenant sync).
 *                           Set `false` when running inside the initial transactional
 *                           empty-schema provisioning block.
 */
export function buildTenantOptimizationIndexStatements(
  schemaName: string,
  options: { concurrent: boolean }
): string[] {
  const s = quoteTenantSchema(schemaName);
  const concurrently = options.concurrent ? 'CONCURRENTLY ' : '';

  return [
    `CREATE INDEX ${concurrently}IF NOT EXISTS idx_attendance_location_date_status ON ${s}.attendance (location_id, date, status)`,
    `CREATE INDEX ${concurrently}IF NOT EXISTS idx_shift_roster_date_status ON ${s}.shift_roster (date, status)`,
    `CREATE INDEX ${concurrently}IF NOT EXISTS idx_departments_location_active ON ${s}.departments (location_id, is_active)`,
    `CREATE UNIQUE INDEX ${concurrently}IF NOT EXISTS uq_departments_code ON ${s}.departments (code) WHERE code IS NOT NULL`,
    `CREATE INDEX ${concurrently}IF NOT EXISTS idx_office_shifts_loc_dept_active ON ${s}.office_shifts (location_id, department_id) WHERE is_active = true`,
    `CREATE INDEX ${concurrently}IF NOT EXISTS idx_monthly_summary_paid_by ON ${s}.monthly_attendance_summary (paid_by) WHERE paid_by IS NOT NULL`,
    `CREATE INDEX ${concurrently}IF NOT EXISTS idx_monthly_summary_set_salary_by ON ${s}.monthly_attendance_summary (set_for_salary_by) WHERE set_for_salary_by IS NOT NULL`,
  ];
}

/**
 * Post-commit / Non-transactional execution helper (uses lock_timeout = '5s' + CONCURRENTLY)
 */
export async function applyTenantOptimizationIndexesConcurrently(
  client: { query: (sql: string) => Promise<unknown> },
  schemaName: string
): Promise<void> {
  quoteTenantSchema(schemaName); // Guard up-front: blocks 'public' immediately

  await client.query(`SET lock_timeout = '5s'`);
  const statements = buildTenantOptimizationIndexStatements(schemaName, {
    concurrent: true,
  });

  for (const sql of statements) {
    await client.query(sql);
  }
}
```

#### Wiring into `provisionTenantSchema(...)`:
1. **If `provisionTenantSchema` runs inside `BEGIN ... COMMIT`:** Execute `buildTenantOptimizationIndexStatements(schemaName, { concurrent: false })` right after table creation, **or** call `await applyTenantOptimizationIndexesConcurrently(client, schemaName)` immediately **after** `await client.query('COMMIT')` on the dedicated `pg.Client` before releasing it back to the pool.
2. **Contract Verification:** If `provisioning.ts` calls `assertTenantSchemaContract(client, schemaName)` at the end of signup, ensure it runs **after** `applyTenantOptimizationIndexesConcurrently` completes so all 7 indexes in `TENANT_REQUIRED_INDEXES` pass `pg_indexes` + `pg_index.indisvalid = true` validation.