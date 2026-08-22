/**
 * Integration regression test for two kiosk punches arriving at the same time.
 *
 * Usage:
 *   pnpm exec tsx scripts/test-kiosk-concurrency.ts <profile-id> <email> <yyyy-mm-dd>
 *
 * The supplied profile/date must be an isolated test fixture. The test does
 * not delete attendance data so it cannot remove a real employee's punches.
 */
import assert from 'node:assert/strict'
import { db } from '@/lib/db'
import { attendanceSessions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { AttendanceService } from '@/lib/services/attendance.service'

const [profileId, email, localDate] = process.argv.slice(2)
if (!profileId || !email || !localDate) {
    throw new Error('Usage: test-kiosk-concurrency.ts <profile-id> <email> <yyyy-mm-dd>')
}

const attempts = await Promise.allSettled([
    AttendanceService.clockIn({ profileId, email, localDate, source: 'kiosk' }),
    AttendanceService.clockIn({ profileId, email, localDate, source: 'kiosk' }),
])

const successfulAttempts = attempts.filter(attempt => attempt.status === 'fulfilled')
assert.equal(successfulAttempts.length, 1, 'exactly one concurrent kiosk check-in should commit')

const activeSessions = await db.query.attendanceSessions.findMany({
    where: and(
        eq(attendanceSessions.profile_id, profileId),
        eq(attendanceSessions.date, localDate),
        eq(attendanceSessions.status, 'active'),
    ),
})
assert.equal(activeSessions.length, 1, 'concurrent kiosk attempts must leave one active session')

console.log('Kiosk concurrency test passed: one check-in and one active session.')