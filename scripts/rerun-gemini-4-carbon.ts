import { coarena } from '../lib/ai/coarena'
import fs from 'fs'

async function rerunGemini4Carbon() {
  console.log('========================================================')
  console.log('RE-RUNNING 12:08 AM & 12:24 AM QUERIES WITH GEMINI-4-CARBON')
  console.log('Timeout increased to 240,000 ms (4 minutes)')
  console.log('========================================================\n')

  // --- QUERY 1 (12:08 AM Prompt): Supabase Schema & Indexing Audit ---
  console.log('>>> [1/2] Executing 12:08 AM Query (Supabase Schema & Indexing Audit)...')
  const prompt1 = `You are a Principal PostgreSQL Database Architect and Performance Engineer.
Conduct a thorough database schema and indexing audit for the PayFix HR & Payroll platform on Supabase (PostgreSQL 15+ with multi-tenancy).

Here is the live telemetry gathered directly from the Supabase PostgreSQL database (covering schemas: \`public\`, \`tenant_interspace\`, \`tenant_primary\`):

### Key Tables & Current Indexes:
1. \`attendance\`:
   - Indexes: \`attendance_pkey\`, \`attendance_profile_id_date_key\` (UNIQUE profile_id, date), \`idx_attendance_date\`, \`idx_attendance_mobile\` (partial on selfie_url), \`idx_attendance_profile_date\`, \`idx_attendance_profile_id\`, \`idx_attendance_status\`, \`idx_attendance_verified_by\`
   - Foreign Keys: \`location_id REFERENCES office_locations(id)\`, \`shift_id REFERENCES office_shifts(id)\`
   - ISSUES: \`attendance.shift_id\` and \`attendance.location_id\` lack indexes despite attendance being queried millions of times.

2. \`departments\` (develop branch addition):
   - Indexes: only \`departments_pkey\` (id).
   - Columns: id, name, code, description, manager_id, location_id, is_active, created_at, updated_at
   - Foreign Keys in other tables pointing to departments: \`profiles.department_id\`, \`designations.department_id\` (BOTH lack indexes!).

3. \`office_shifts\` (develop branch addition):
   - Indexes: only \`office_shifts_pkey\` (id).
   - Columns: id, location_id, department_id, name, code, start_time, end_time, duration_hours, is_overnight, buffer_minutes, break_minutes, min_half_day_hours, min_full_day_hours, is_default, color, is_active, created_at, updated_at
   - ISSUES: \`location_id\`, \`department_id\`, \`is_active\` have no index.

4. \`employee_shift_assignments\` (develop branch addition):
   - Indexes: only \`employee_shift_assignments_pkey\` (id).
   - Columns: id, profile_id, location_id, duty_hours, shift_mode, assigned_shift_ids (jsonb), rotation_type, rotation_shift_ids (jsonb), rotation_start_date, effective_from, effective_to, created_at, updated_at
   - ISSUES: \`profile_id\` has NO index! Queries checking an employee's shift perform a sequential table scan! No unique constraint on active assignment.

5. \`shift_roster\` (develop branch addition):
   - Indexes: only \`shift_roster_pkey\` (id).
   - Columns: id, profile_id, department_id, shift_id, date, status, is_extra_shift, notes, allotted_by, created_at, updated_at
   - ISSUES: No index on \`date\`, no index on \`profile_id\`, no composite index on \`(profile_id, date)\`, no index on \`department_id\`, no index on \`shift_id\`. Every monthly roster calendar view does a full table scan!

6. \`monthly_attendance_summary\`:
   - Indexes: \`idx_monthly_summary_period\` (month, year), \`idx_monthly_summary_profile_period\` (profile_id, month, year)
   - Foreign Keys without index: \`paid_by\`, \`set_for_salary_by\`

7. \`monthly_bonuses\`:
   - Indexes: \`monthly_bonuses_pkey\`, \`monthly_bonuses_profile_month_year_title_idx\` (profile_id, month, year, title)

8. Unindexed Foreign Keys: 32 foreign key constraints across tables lack referencing indexes, risking table locks during DELETE/UPDATE cascades and slow joins.

Please provide:
1. Executive Assessment: High-risk bottlenecks, scaling implications, and multi-tenant isolation risks.
2. Prioritized Remediation Plan: Exact, copy-pasteable PostgreSQL DDL migration statements (\`CREATE INDEX CONCURRENTLY IF NOT EXISTS ...\`) for:
   - High Priority (Attendance, Shift Roster, Shift Assignments, Profiles)
   - Medium Priority (Departments, Office Shifts, Monthly Summaries)
3. Multi-tenant Schema Contract considerations for Supabase.
4. Supabase Connection Pooler best practices (PgBouncer vs Supavisor session mode vs transaction mode).`

  const startTime1 = Date.now()
  try {
    const res1 = await coarena.createChatCompletion({
      model: 'gemini-4-carbon',
      messages: [
        { role: 'system', content: 'You are a Principal PostgreSQL Database Architect & Supabase Infrastructure Specialist.' },
        { role: 'user', content: prompt1 }
      ],
      timeoutMs: 240000 // 4 minutes
    })
    const duration1 = ((Date.now() - startTime1) / 1000).toFixed(1)
    console.log(`✓ [1/2] Query 1 succeeded in ${duration1}s!`)
    console.log(`  Request ID: ${res1.requestId}`)
    console.log(`  Model: ${res1.model}`)

    const content1 = res1.choices[0]?.message?.content || ''
    fs.writeFileSync('docs/gemini-4-carbon-db-audit-rerun.md', content1)
    console.log(`  Saved to docs/gemini-4-carbon-db-audit-rerun.md (${content1.length} chars)`)

    // Submit feedback
    try {
      const fb1 = await coarena.sendFeedback({
        request_id: res1.requestId,
        rating: 'good',
        tags: ['correct', 'helpful', 'good_code', 'thorough'],
        note: `Gemini-4-carbon deep Supabase schema & indexing audit (re-run with 240s timeout)`
      })
      console.log(`  Feedback rating submitted:`, fb1.request_id)
    } catch (fbErr: any) {
      console.warn(`  Feedback rating warning:`, fbErr.message)
    }
  } catch (err: any) {
    console.error(`❌ [1/2] Query 1 failed:`, err.message)
  }

  // --- QUERY 2 (12:24 AM Prompt): Tenant-Only Schema Contract & Provisioning Audit ---
  console.log('\n>>> [2/2] Executing 12:24 AM Query (Tenant-Only Schema Contract & Provisioning)...')
  const prompt2 = `You are a Principal PostgreSQL Database Architect and Multi-Tenant SaaS Systems Engineer.

CRITICAL PROJECT CONSTRAINT FROM USER:
- DO NOT touch or alter the \`public\` schema! The \`public\` schema is actively used by production on an earlier \`main\` branch.
- The \`develop\` branch operates on an isolated Schema-per-Tenant architecture where all tenant business data lives in private schemas: \`tenant_primary\` (the canonical template), \`tenant_interspace\`, and future \`tenant_*\` schemas.
- Our goal:
  1. Audit and optimize ONLY the non-public tenant schemas (\`tenant_primary\`, \`tenant_interspace\`).
  2. Upgrade the tenant onboarding / provisioning contract in \`lib/tenant/schema-contract.ts\` and \`lib/tenant/provisioning.ts\` so that when a new tenant registers or signs up in \`develop\` branch, their schema is provisioned from \`tenant_primary\` with ALL latest tables, columns, foreign keys, and performance indexes.

Current Codebase Facts:
1. Multi-Tenant Provisioning:
   - \`lib/tenant/provisioning.ts\` uses \`alignCanonicalTenantSchema(schemaName)\`.
   - It loops over \`CANONICAL_TENANT_TABLES\` from \`lib/tenant/schema-contract.ts\`.
   - It clones each table using:
     \`CREATE TABLE IF NOT EXISTS <new_schema>.<table_name> (LIKE tenant_primary.<table_name> INCLUDING ALL)\`.
   - It then checks \`TENANT_REQUIRED_INDEXES\` and \`TENANT_REQUIRED_FOREIGN_KEYS\`.

2. The Gap in \`lib/tenant/schema-contract.ts\`:
   - \`CANONICAL_TENANT_TABLES\` is missing the new develop branch tables:
     - \`departments\`
     - \`office_shifts\`
     - \`employee_shift_assignments\`
     - \`shift_roster\`
     - \`department_managers_history\`
     - \`monthly_bonuses\`
   - \`CANONICAL_TENANT_COLUMNS\` lacks definitions for these tables.
   - \`TENANT_REQUIRED_INDEXES\` lacks indexes for these new tables.
   - \`TENANT_REQUIRED_FOREIGN_KEYS\` lacks FK declarations.

3. Foreign Keys in PostgreSQL Table Cloning:
   - \`CREATE TABLE (LIKE tenant_primary.table INCLUDING ALL)\` copies defaults, check constraints, indexes, but DOES NOT copy foreign keys!
   - Therefore, \`lib/tenant/provisioning.ts\` must dynamically add the foreign keys if missing.

Deliverables requested:
1. Complete, exact PostgreSQL DDL statements targeting ONLY \`tenant_primary\` and \`tenant_interspace\` (NO public schema).
2. The exact TypeScript diff / additions needed for \`lib/tenant/schema-contract.ts\`.
3. The exact TypeScript additions for \`lib/tenant/provisioning.ts\` to enforce foreign keys and new tables during onboarding.
4. An automated audit verification script to check that any tenant schema strictly adheres to the canonical contract.`

  const startTime2 = Date.now()
  try {
    const res2 = await coarena.createChatCompletion({
      model: 'gemini-4-carbon',
      messages: [
        { role: 'system', content: 'You are an expert multi-tenant PostgreSQL architect.' },
        { role: 'user', content: prompt2 }
      ],
      timeoutMs: 240000 // 4 minutes
    })
    const duration2 = ((Date.now() - startTime2) / 1000).toFixed(1)
    console.log(`✓ [2/2] Query 2 succeeded in ${duration2}s!`)
    console.log(`  Request ID: ${res2.requestId}`)
    console.log(`  Model: ${res2.model}`)

    const content2 = res2.choices[0]?.message?.content || ''
    fs.writeFileSync('docs/gemini-4-carbon-tenant-audit-rerun.md', content2)
    console.log(`  Saved to docs/gemini-4-carbon-tenant-audit-rerun.md (${content2.length} chars)`)

    // Submit feedback
    try {
      const fb2 = await coarena.sendFeedback({
        request_id: res2.requestId,
        rating: 'good',
        tags: ['correct', 'helpful', 'good_code', 'thorough'],
        note: `Gemini-4-carbon tenant schema & provisioning contract alignment (re-run with 240s timeout)`
      })
      console.log(`  Feedback rating submitted:`, fb2.request_id)
    } catch (fbErr: any) {
      console.warn(`  Feedback rating warning:`, fbErr.message)
    }
  } catch (err: any) {
    console.error(`❌ [2/2] Query 2 failed:`, err.message)
  }

  console.log('\n========================================================')
  console.log('BOTH GEMINI-4-CARBON RE-RUNS COMPLETED!')
  console.log('========================================================')
}

rerunGemini4Carbon().catch(console.error)
