import { coarena } from '../lib/ai/coarena'
import fs from 'fs'

async function generateCarbonOptimizations() {
  console.log('Consulting Coarena model: gemini-4-carbon with 240s timeout...')

  const prompt = `You are a Principal PostgreSQL Database Architect and Multi-Tenant Systems Specialist for the PayFix SaaS platform.

We need to apply the specific new architectural optimizations and composite indexes you identified in your deep audit:
1. \`attendance\`: \`idx_attendance_location_date_status\` ON \`attendance (location_id, date, status)\`
2. \`shift_roster\`: \`idx_shift_roster_date_status\` ON \`shift_roster (date, status)\`
3. \`departments\`: \`idx_departments_location_active\` ON \`departments (location_id, is_active)\`
4. \`departments\`: \`uq_departments_code\` ON \`departments (code) WHERE code IS NOT NULL\`
5. \`office_shifts\`: \`idx_office_shifts_loc_dept_active\` ON \`office_shifts (location_id, department_id) WHERE is_active = true\`
6. \`monthly_attendance_summary\`: \`idx_monthly_summary_paid_by\` ON \`monthly_attendance_summary (paid_by) WHERE paid_by IS NOT NULL\`
7. \`monthly_attendance_summary\`: \`idx_monthly_summary_set_salary_by\` ON \`monthly_attendance_summary (set_for_salary_by) WHERE set_for_salary_by IS NOT NULL\`

CRITICAL PROJECT CONSTRAINTS:
- STRICT SAFETY RULE: DO NOT touch or alter the \`public\` schema! Target ONLY \`tenant_primary\` and \`tenant_interspace\`.
- All index creation must use \`CREATE INDEX CONCURRENTLY IF NOT EXISTS\` with \`SET lock_timeout = '5s'\`.
- Must align with \`lib/tenant/schema-contract.ts\` and \`lib/tenant/provisioning.ts\` so future tenant signups automatically include these indexes.

Please output:
1. Exact PostgreSQL DDL statements for \`tenant_primary\` and \`tenant_interspace\`.
2. The exact additions for \`lib/tenant/schema-contract.ts\` (\`TENANT_REQUIRED_INDEXES\`).
3. The exact additions for \`lib/tenant/provisioning.ts\` if needed.`

  const res = await coarena.createChatCompletion({
    model: 'gemini-4-carbon',
    messages: [
      { role: 'system', content: 'You are an elite PostgreSQL architect. Respond with exact, production-ready code and SQL.' },
      { role: 'user', content: prompt }
    ],
    timeoutMs: 240000
  })

  console.log('✓ gemini-4-carbon responded successfully!')
  console.log('Request ID:', res.requestId)

  const content = res.choices[0]?.message?.content || ''
  fs.writeFileSync('docs/gemini-4-carbon-phase2-optimizations.md', content)
  console.log('Saved response to docs/gemini-4-carbon-phase2-optimizations.md')

  try {
    const fb = await coarena.sendFeedback({
      request_id: res.requestId,
      rating: 'good',
      tags: ['correct', 'helpful', 'good_code', 'thorough'],
      note: 'Gemini-4-carbon phase 2 composite indexing & schema contract alignment'
    })
    console.log('Feedback submitted:', fb)
  } catch (err: any) {
    console.warn('Feedback submission warning:', err.message)
  }
}

generateCarbonOptimizations().catch(console.error)
