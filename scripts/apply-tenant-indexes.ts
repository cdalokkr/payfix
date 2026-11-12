import 'dotenv/config'
import postgres from 'postgres'

async function applyTenantIndexes() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is missing')

  // Connect directly - strictly targeting tenant_primary and tenant_interspace
  const sql = postgres(url, { max: 1, connect_timeout: 20 })

  const targetSchemas = ['tenant_primary', 'tenant_interspace']

  try {
    console.log('=== APPLYING TENANT-ONLY PERFORMANCE INDEXES & CONSTRAINTS ===')
    console.log('Target Schemas:', targetSchemas)
    console.log('PUBLIC SCHEMA WILL NOT BE TOUCHED AT ALL.\n')

    for (const schema of targetSchemas) {
      console.log(`--- Processing Schema: ${schema} ---`)

      // 1. Attendance foreign key indexes
      console.log(`[${schema}] Creating attendance indexes...`)
      await sql`CREATE INDEX IF NOT EXISTS "idx_attendance_shift_id" ON ${sql(schema + '.attendance')} ("shift_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_attendance_location_id" ON ${sql(schema + '.attendance')} ("location_id")`

      // 2. Profiles and Designations department indexes
      console.log(`[${schema}] Creating profiles/designations department indexes...`)
      await sql`CREATE INDEX IF NOT EXISTS "idx_profiles_department_id" ON ${sql(schema + '.profiles')} ("department_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_designations_department_id" ON ${sql(schema + '.designations')} ("department_id")`

      // 3. Departments indexes
      console.log(`[${schema}] Creating departments indexes...`)
      await sql`CREATE INDEX IF NOT EXISTS "idx_departments_manager_id" ON ${sql(schema + '.departments')} ("manager_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_departments_location_id" ON ${sql(schema + '.departments')} ("location_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_departments_active" ON ${sql(schema + '.departments')} ("is_active")`

      // 4. Office Shifts indexes
      console.log(`[${schema}] Creating office_shifts indexes...`)
      await sql`CREATE INDEX IF NOT EXISTS "idx_office_shifts_dept_id" ON ${sql(schema + '.office_shifts')} ("department_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_office_shifts_loc_id" ON ${sql(schema + '.office_shifts')} ("location_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_office_shifts_active" ON ${sql(schema + '.office_shifts')} ("is_active")`

      // 5. Employee Shift Assignments indexes
      console.log(`[${schema}] Creating employee_shift_assignments indexes...`)
      await sql`CREATE INDEX IF NOT EXISTS "idx_emp_shift_assign_profile_id" ON ${sql(schema + '.employee_shift_assignments')} ("profile_id")`
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_emp_shift_assign_active_uniq" ON ${sql(schema + '.employee_shift_assignments')} ("profile_id") WHERE "effective_to" IS NULL`
      await sql`CREATE INDEX IF NOT EXISTS "idx_emp_shift_assign_dates" ON ${sql(schema + '.employee_shift_assignments')} ("profile_id", "effective_from" DESC, "effective_to")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_emp_shift_assign_loc_id" ON ${sql(schema + '.employee_shift_assignments')} ("location_id")`

      // 6. Shift Roster indexes
      console.log(`[${schema}] Creating shift_roster indexes...`)
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_shift_roster_profile_date_uniq" ON ${sql(schema + '.shift_roster')} ("profile_id", "date") WHERE "is_extra_shift" = false`
      await sql`CREATE INDEX IF NOT EXISTS "idx_shift_roster_profile_date" ON ${sql(schema + '.shift_roster')} ("profile_id", "date")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_shift_roster_dept_date_cov" ON ${sql(schema + '.shift_roster')} ("department_id", "date") INCLUDE ("profile_id", "shift_id", "status", "is_extra_shift")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_shift_roster_date" ON ${sql(schema + '.shift_roster')} ("date")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_shift_roster_shift_id" ON ${sql(schema + '.shift_roster')} ("shift_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_shift_roster_dept_id" ON ${sql(schema + '.shift_roster')} ("department_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_shift_roster_allotted_by" ON ${sql(schema + '.shift_roster')} ("allotted_by")`

      // 7. Department Managers History indexes
      console.log(`[${schema}] Creating department_managers_history indexes...`)
      await sql`CREATE INDEX IF NOT EXISTS "idx_dept_mgr_hist_dept_id" ON ${sql(schema + '.department_managers_history')} ("department_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_dept_mgr_hist_mgr_id" ON ${sql(schema + '.department_managers_history')} ("manager_id")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_dept_mgr_hist_appointed_by" ON ${sql(schema + '.department_managers_history')} ("appointed_by")`

      // 8. Monthly Bonuses indexes
      console.log(`[${schema}] Creating monthly_bonuses indexes...`)
      await sql`CREATE INDEX IF NOT EXISTS "idx_monthly_bonuses_period" ON ${sql(schema + '.monthly_bonuses')} ("year", "month")`
      await sql`CREATE INDEX IF NOT EXISTS "idx_monthly_bonuses_created_by" ON ${sql(schema + '.monthly_bonuses')} ("created_by")`

      console.log(`✓ [${schema}] All indexes applied successfully!\n`)
    }

    console.log('=== ALL TENANT PERFORMANCE INDEXES APPLIED TO TENANT_PRIMARY AND TENANT_INTERSPACE ===')
  } finally {
    await sql.end()
  }
}

applyTenantIndexes().catch(console.error)
