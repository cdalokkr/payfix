Here is the architectural remediation plan and exact implementation to align `tenant_primary`, `tenant_interspace`, and all future provisioned tenant schemas without touching the `public` schema.

---

### 1. Isolated Tenant Schema DDL Migration (`tenant_primary` & `tenant_interspace`)

This script uses an idempotent PL/pgSQL block scoped strictly to `tenant_primary` and `tenant_interspace`. By applying these indexes and constraints to `tenant_primary`, any subsequent `CREATE TABLE ... (LIKE tenant_primary.<table_name> INCLUDING ALL)` during tenant provisioning will automatically inherit the indexes, defaults, and non-foreign-key constraints.

```sql
-- ============================================================================
-- MIGRATION: Tenant Schema Optimization & Index Parity (NO PUBLIC SCHEMA)
-- Target Schemas: tenant_primary, tenant_interspace
-- ============================================================================

DO $$
DECLARE
    t_schema TEXT;
    target_schemas TEXT[] := ARRAY['tenant_primary', 'tenant_interspace'];
BEGIN
    FOREACH t_schema IN ARRAY target_schemas LOOP
        -- Ensure the schema exists before attempting operations
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = t_schema) THEN
            RAISE NOTICE 'Aligning schema: %', t_schema;

            -- ----------------------------------------------------------------
            -- 1. SHIFT ROSTER INDEXES
            -- ----------------------------------------------------------------
            -- Unique constraint index per employee per day
            EXECUTE format(
                'CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_roster_profile_date_uniq ON %I.shift_roster (profile_id, roster_date)',
                t_schema
            );

            -- Covering index for department roster calendar views
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_shift_roster_dept_date_cov ON %I.shift_roster (department_id, roster_date) INCLUDE (profile_id, shift_id, is_off_day)',
                t_schema
            );

            -- Date range lookup index
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_shift_roster_date ON %I.shift_roster (roster_date)',
                t_schema
            );

            -- FK lookup index on shift_id
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_shift_roster_shift_id ON %I.shift_roster (shift_id)',
                t_schema
            );

            -- ----------------------------------------------------------------
            -- 2. EMPLOYEE SHIFT ASSIGNMENTS INDEXES
            -- ----------------------------------------------------------------
            -- Partial unique index ensuring only 1 active shift assignment per employee
            EXECUTE format(
                'CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_shift_assign_active_uniq ON %I.employee_shift_assignments (profile_id) WHERE is_active = true',
                t_schema
            );

            -- Composite index for historical/effective date range lookups
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_emp_shift_assign_profile_dates ON %I.employee_shift_assignments (profile_id, effective_from DESC, effective_to)',
                t_schema
            );

            -- FK lookup index on shift_id
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_emp_shift_assign_shift_id ON %I.employee_shift_assignments (shift_id)',
                t_schema
            );

            -- ----------------------------------------------------------------
            -- 3. OFFICE SHIFTS INDEXES
            -- ----------------------------------------------------------------
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_office_shifts_department_id ON %I.office_shifts (department_id)',
                t_schema
            );

            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_office_shifts_location_id ON %I.office_shifts (location_id)',
                t_schema
            );

            -- ----------------------------------------------------------------
            -- 4. ATTENDANCE FK INDEXES
            -- ----------------------------------------------------------------
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_attendance_shift_id ON %I.attendance (shift_id)',
                t_schema
            );

            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_attendance_location_id ON %I.attendance (location_id)',
                t_schema
            );

            -- ----------------------------------------------------------------
            -- 5. PROFILES & DESIGNATIONS DEPARTMENT FK INDEXES
            -- ----------------------------------------------------------------
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON %I.profiles (department_id)',
                t_schema
            );

            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_designations_department_id ON %I.designations (department_id)',
                t_schema
            );

            -- ----------------------------------------------------------------
            -- 6. DEPARTMENT MANAGERS HISTORY & MONTHLY BONUSES INDEXES
            -- ----------------------------------------------------------------
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_dept_mgr_hist_dept_dates ON %I.department_managers_history (department_id, effective_from DESC)',
                t_schema
            );

            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_dept_mgr_hist_manager_id ON %I.department_managers_history (manager_id)',
                t_schema
            );

            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_monthly_bonuses_profile_month ON %I.monthly_bonuses (profile_id, bonus_month)',
                t_schema
            );
        END IF;
    END LOOP;
END $$;
```

---

### 2. TypeScript Contract & Provisioning Updates

#### A. Update `lib/tenant/schema-contract.ts`

Note: PostgreSQL's `CREATE TABLE ... (LIKE ... INCLUDING ALL)` copies indexes, check constraints, and defaults, **but it does not copy `FOREIGN KEY` constraints** (and if it did, they would point back to `tenant_primary` instead of the new tenant's local schema). Therefore, ordering `CANONICAL_TENANT_TABLES` by topological dependency and explicitly declaring `TENANT_REQUIRED_FOREIGN_KEYS` is critical.

```typescript
// lib/tenant/schema-contract.ts

export const CANONICAL_TEMPLATE_SCHEMA = 'tenant_primary';

/**
 * Topologically sorted table list so parent tables are always cloned
 * before child tables during schema provisioning.
 */
export const CANONICAL_TENANT_TABLES = [
  // Core organizational & reference tables
  'locations',
  'departments',
  'designations',
  'profiles',
  'office_shifts',

  // Operational & workforce management tables
  'department_managers_history',
  'employee_shift_assignments',
  'shift_roster',
  'attendance',
  'leaves',
  'holidays',

  // Compensation & financial tables
  'payroll',
  'monthly_bonuses',
  // ... preserve any other existing canonical tables here
] as const;

export type CanonicalTenantTable = (typeof CANONICAL_TENANT_TABLES)[number];

export const CANONICAL_TENANT_COLUMNS: Record<CanonicalTenantTable, readonly string[]> = {
  // ... preserve existing table column definitions ...
  locations: ['id', 'name', 'address', 'latitude', 'longitude', 'radius_meters', 'is_active', 'created_at', 'updated_at'],
  profiles: [
    'id',
    'email',
    'full_name',
    'role',
    'department_id',
    'designation_id',
    'location_id',
    'is_active',
    'created_at',
    'updated_at',
  ],
  designations: ['id', 'title', 'department_id', 'is_active', 'created_at', 'updated_at'],
  attendance: [
    'id',
    'profile_id',
    'shift_id',
    'location_id',
    'date',
    'check_in',
    'check_out',
    'status',
    'created_at',
    'updated_at',
  ],
  leaves: ['id', 'profile_id', 'leave_type', 'start_date', 'end_date', 'status', 'created_at', 'updated_at'],
  holidays: ['id', 'name', 'date', 'location_id', 'created_at', 'updated_at'],
  payroll: ['id', 'profile_id', 'month', 'year', 'net_salary', 'status', 'created_at', 'updated_at'],

  // --- NEW DEVELOP BRANCH TABLES ---
  departments: [
    'id',
    'name',
    'code',
    'description',
    'manager_id',
    'is_active',
    'created_at',
    'updated_at',
  ],
  office_shifts: [
    'id',
    'name',
    'start_time',
    'end_time',
    'grace_period_minutes',
    'department_id',
    'location_id',
    'is_night_shift',
    'is_active',
    'created_at',
    'updated_at',
  ],
  employee_shift_assignments: [
    'id',
    'profile_id',
    'shift_id',
    'effective_from',
    'effective_to',
    'is_active',
    'assigned_by',
    'created_at',
    'updated_at',
  ],
  shift_roster: [
    'id',
    'profile_id',
    'department_id',
    'shift_id',
    'roster_date',
    'is_off_day',
    'notes',
    'created_by',
    'created_at',
    'updated_at',
  ],
  department_managers_history: [
    'id',
    'department_id',
    'manager_id',
    'effective_from',
    'effective_to',
    'assigned_by',
    'created_at',
  ],
  monthly_bonuses: [
    'id',
    'profile_id',
    'bonus_month',
    'amount',
    'reason',
    'approved_by',
    'status',
    'created_at',
    'updated_at',
  ],
};

export interface TenantIndexContract {
  table: CanonicalTenantTable;
  indexName: string;
  /** SQL expression starting after ON <schema>.<table> */
  definitionSql: string;
  unique?: boolean;
}

export const TENANT_REQUIRED_INDEXES: readonly TenantIndexContract[] = [
  // Shift Roster
  {
    table: 'shift_roster',
    indexName: 'idx_shift_roster_profile_date_uniq',
    unique: true,
    definitionSql: '(profile_id, roster_date)',
  },
  {
    table: 'shift_roster',
    indexName: 'idx_shift_roster_dept_date_cov',
    definitionSql: '(department_id, roster_date) INCLUDE (profile_id, shift_id, is_off_day)',
  },
  {
    table: 'shift_roster',
    indexName: 'idx_shift_roster_date',
    definitionSql: '(roster_date)',
  },
  {
    table: 'shift_roster',
    indexName: 'idx_shift_roster_shift_id',
    definitionSql: '(shift_id)',
  },

  // Employee Shift Assignments
  {
    table: 'employee_shift_assignments',
    indexName: 'idx_emp_shift_assign_active_uniq',
    unique: true,
    definitionSql: '(profile_id) WHERE is_active = true',
  },
  {
    table: 'employee_shift_assignments',
    indexName: 'idx_emp_shift_assign_profile_dates',
    definitionSql: '(profile_id, effective_from DESC, effective_to)',
  },
  {
    table: 'employee_shift_assignments',
    indexName: 'idx_emp_shift_assign_shift_id',
    definitionSql: '(shift_id)',
  },

  // Office Shifts
  {
    table: 'office_shifts',
    indexName: 'idx_office_shifts_department_id',
    definitionSql: '(department_id)',
  },
  {
    table: 'office_shifts',
    indexName: 'idx_office_shifts_location_id',
    definitionSql: '(location_id)',
  },

  // Attendance
  {
    table: 'attendance',
    indexName: 'idx_attendance_shift_id',
    definitionSql: '(shift_id)',
  },
  {
    table: 'attendance',
    indexName: 'idx_attendance_location_id',
    definitionSql: '(location_id)',
  },

  // Profiles & Designations
  {
    table: 'profiles',
    indexName: 'idx_profiles_department_id',
    definitionSql: '(department_id)',
  },
  {
    table: 'designations',
    indexName: 'idx_designations_department_id',
    definitionSql: '(department_id)',
  },

  // Department Managers History & Monthly Bonuses
  {
    table: 'department_managers_history',
    indexName: 'idx_dept_mgr_hist_dept_dates',
    definitionSql: '(department_id, effective_from DESC)',
  },
  {
    table: 'department_managers_history',
    indexName: 'idx_dept_mgr_hist_manager_id',
    definitionSql: '(manager_id)',
  },
  {
    table: 'monthly_bonuses',
    indexName: 'idx_monthly_bonuses_profile_month',
    definitionSql: '(profile_id, bonus_month)',
  },
];

export interface TenantForeignKeyContract {
  table: CanonicalTenantTable;
  constraintName: string;
  column: string;
  refTable: CanonicalTenantTable;
  refColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export const TENANT_REQUIRED_FOREIGN_KEYS: readonly TenantForeignKeyContract[] = [
  // Profiles & Designations -> Departments
  {
    table: 'profiles',
    constraintName: 'fk_profiles_department',
    column: 'department_id',
    refTable: 'departments',
    refColumn: 'id',
    onDelete: 'SET NULL',
  },
  {
    table: 'designations',
    constraintName: 'fk_designations_department',
    column: 'department_id',
    refTable: 'departments',
    refColumn: 'id',
    onDelete: 'SET NULL',
  },

  // Departments -> Profiles (Manager)
  {
    table: 'departments',
    constraintName: 'fk_departments_manager',
    column: 'manager_id',
    refTable: 'profiles',
    refColumn: 'id',
    onDelete: 'SET NULL',
  },

  // Office Shifts -> Departments & Locations
  {
    table: 'office_shifts',
    constraintName: 'fk_office_shifts_department',
    column: 'department_id',
    refTable: 'departments',
    refColumn: 'id',
    onDelete: 'SET NULL',
  },
  {
    table: 'office_shifts',
    constraintName: 'fk_office_shifts_location',
    column: 'location_id',
    refTable: 'locations',
    refColumn: 'id',
    onDelete: 'SET NULL',
  },

  // Employee Shift Assignments -> Profiles & Office Shifts
  {
    table: 'employee_shift_assignments',
    constraintName: 'fk_emp_shift_assign_profile',
    column: 'profile_id',
    refTable: 'profiles',
    refColumn: 'id',
    onDelete: 'CASCADE',
  },
  {
    table: 'employee_shift_assignments',
    constraintName: 'fk_emp_shift_assign_shift',
    column: 'shift_id',
    refTable: 'office_shifts',
    refColumn: 'id',
    onDelete: 'RESTRICT',
  },

  // Shift Roster -> Profiles, Departments, Office Shifts
  {
    table: 'shift_roster',
    constraintName: 'fk_shift_roster_profile',
    column: 'profile_id',
    refTable: 'profiles',
    refColumn: 'id',
    onDelete: 'CASCADE',
  },
  {
    table: 'shift_roster',
    constraintName: 'fk_shift_roster_department',
    column: 'department_id',
    refTable: 'departments',
    refColumn: 'id',
    onDelete: 'CASCADE',
  },
  {
    table: 'shift_roster',
    constraintName: 'fk_shift_roster_shift',
    column: 'shift_id',
    refTable: 'office_shifts',
    refColumn: 'id',
    onDelete: 'RESTRICT',
  },

  // Attendance -> Office Shifts & Locations
  {
    table: 'attendance',
    constraintName: 'fk_attendance_shift',
    column: 'shift_id',
    refTable: 'office_shifts',
    refColumn: 'id',
    onDelete: 'SET NULL',
  },
  {
    table: 'attendance',
    constraintName: 'fk_attendance_location',
    column: 'location_id',
    refTable: 'locations',
    refColumn: 'id',
    onDelete: 'SET NULL',
  },

  // Department Managers History -> Departments & Profiles
  {
    table: 'department_managers_history',
    constraintName: 'fk_dept_mgr_hist_department',
    column: 'department_id',
    refTable: 'departments',
    refColumn: 'id',
    onDelete: 'CASCADE',
  },
  {
    table: 'department_managers_history',
    constraintName: 'fk_dept_mgr_hist_manager',
    column: 'manager_id',
    refTable: 'profiles',
    refColumn: 'id',
    onDelete: 'CASCADE',
  },

  // Monthly Bonuses -> Profiles
  {
    table: 'monthly_bonuses',
    constraintName: 'fk_monthly_bonuses_profile',
    column: 'profile_id',
    refTable: 'profiles',
    refColumn: 'id',
    onDelete: 'CASCADE',
  },
];
```

#### B. Update `lib/tenant/provisioning.ts`

Ensure `alignCanonicalTenantSchema` enforces a strict guard against `public`, clones missing columns for drifted schemas, applies `TENANT_REQUIRED_INDEXES`, and binds intra-schema `TENANT_REQUIRED_FOREIGN_KEYS`.

```typescript
// lib/tenant/provisioning.ts

import {
  CANONICAL_TEMPLATE_SCHEMA,
  CANONICAL_TENANT_TABLES,
  TENANT_REQUIRED_INDEXES,
  TENANT_REQUIRED_FOREIGN_KEYS,
} from './schema-contract';

interface SqlExecutor {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

const VALID_TENANT_SCHEMA_REGEX = /^tenant_[a-z0-9_]+$/;

function assertValidTenantSchema(schemaName: string): void {
  if (schemaName === 'public' || !VALID_TENANT_SCHEMA_REGEX.test(schemaName)) {
    throw new Error(
      `[TenantProvisioning] Forbidden or invalid tenant schema name "${schemaName}". Must match /^tenant_[a-z0-9_]+$/ and never touch "public".`
    );
  }
}

export async function alignCanonicalTenantSchema(
  db: SqlExecutor,
  schemaName: string
): Promise<void> {
  assertValidTenantSchema(schemaName);

  // 1. Ensure target tenant schema exists
  await db.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

  // 2. Clone all canonical tables from tenant_primary (inherits PKs, Checks, Defaults, and Indexes)
  for (const table of CANONICAL_TENANT_TABLES) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."${table}" (
        LIKE "${CANONICAL_TEMPLATE_SCHEMA}"."${table}" INCLUDING ALL
      );
    `);

    // Backfill any newly added columns if the table already existed in an older tenant schema
    await db.query(`
      DO $$
      DECLARE
        col RECORD;
      BEGIN
        FOR col IN
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = '${CANONICAL_TEMPLATE_SCHEMA}'
            AND table_name = '${table}'
            AND column_name NOT IN (
              SELECT column_name
              FROM information_schema.columns
              WHERE table_schema = '${schemaName}'
                AND table_name = '${table}'
            )
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS %I %s %s %s',
            '${schemaName}',
            '${table}',
            col.column_name,
            col.data_type,
            CASE WHEN col.column_default IS NOT NULL THEN 'DEFAULT ' || col.column_default ELSE '' END,
            CASE WHEN col.is_nullable = 'NO' AND col.column_default IS NOT NULL THEN 'NOT NULL' ELSE '' END
          );
        END LOOP;
      END $$;
    `);
  }

  // 3. Explicitly verify and create all required performance & partial indexes
  for (const idx of TENANT_REQUIRED_INDEXES) {
    const uniqueKeyword = idx.unique ? 'UNIQUE' : '';
    await db.query(`
      CREATE ${uniqueKeyword} INDEX IF NOT EXISTS "${idx.indexName}"
      ON "${schemaName}"."${idx.table}" ${idx.definitionSql};
    `);
  }

  // 4. Re-bind Foreign Keys strictly within the isolated tenant schema
  // (LIKE ... INCLUDING ALL does not copy Foreign Keys)
  for (const fk of TENANT_REQUIRED_FOREIGN_KEYS) {
    const onDeleteClause = fk.onDelete ? `ON DELETE ${fk.onDelete}` : '';
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = '${schemaName}'
            AND c.conname = '${fk.constraintName}'
        ) THEN
          ALTER TABLE "${schemaName}"."${fk.table}"
          ADD CONSTRAINT "${fk.constraintName}"
          FOREIGN KEY ("${fk.column}")
          REFERENCES "${schemaName}"."${fk.refTable}" ("${fk.refColumn}")
          ${onDeleteClause};
        END IF;
      END $$;
    `);
  }
}
```

---

### 3. Verification Steps

Run the following read-only verification queries to confirm 100% parity across `tenant_primary`, `tenant_interspace`, and any newly registered tenant schema.

#### Step 1: Verify `public` Schema Was Untouched
```sql
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_shift_roster_profile_date_uniq',
    'idx_emp_shift_assign_active_uniq'
  );
-- Expected output: 0 rows
```

#### Step 2: Audit Index Parity Across `tenant_primary` and `tenant_interspace`
```sql
WITH required_indexes(indexname) AS (
  VALUES
    ('idx_shift_roster_profile_date_uniq'),
    ('idx_shift_roster_dept_date_cov'),
    ('idx_shift_roster_date'),
    ('idx_shift_roster_shift_id'),
    ('idx_emp_shift_assign_active_uniq'),
    ('idx_emp_shift_assign_profile_dates'),
    ('idx_emp_shift_assign_shift_id'),
    ('idx_office_shifts_department_id'),
    ('idx_office_shifts_location_id'),
    ('idx_attendance_shift_id'),
    ('idx_attendance_location_id'),
    ('idx_profiles_department_id'),
    ('idx_designations_department_id'),
    ('idx_dept_mgr_hist_dept_dates'),
    ('idx_dept_mgr_hist_manager_id'),
    ('idx_monthly_bonuses_profile_month')
),
target_schemas(schemaname) AS (
  VALUES ('tenant_primary'), ('tenant_interspace')
)
SELECT
  s.schemaname,
  r.indexname AS required_index,
  CASE WHEN i.indexname IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM target_schemas s
CROSS JOIN required_indexes r
LEFT JOIN pg_indexes i
  ON i.schemaname = s.schemaname
 AND i.indexname = r.indexname
ORDER BY status DESC, s.schemaname, r.indexname;
-- Expected output: All 32 rows (16 per schema) marked as 'PRESENT'
```

#### Step 3: Dry-Run New Tenant Onboarding (Transactional Rollback Test)
Test that `CREATE TABLE ... (LIKE tenant_primary.<table_name> INCLUDING ALL)` and the provisioning contract produce an identical schema for a brand-new tenant:
```sql
BEGIN;

-- Simulate provisioning a new tenant
CREATE SCHEMA tenant_smoke_test;
CREATE TABLE tenant_smoke_test.shift_roster (LIKE tenant_primary.shift_roster INCLUDING ALL);
CREATE TABLE tenant_smoke_test.employee_shift_assignments (LIKE tenant_primary.employee_shift_assignments INCLUDING ALL);

-- Verify that INCLUDING ALL automatically cloned the new indexes from tenant_primary
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'tenant_smoke_test'
ORDER BY tablename, indexname;

ROLLBACK;
```