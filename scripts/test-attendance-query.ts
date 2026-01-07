/**
 * Test script to verify attendance data for a specific profile
 * Run with: npx tsx scripts/test-attendance-query.ts
 */

// Load environment variables first
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../lib/db';
import { attendance } from '../lib/db/schema';
import { eq, gte, and, sql } from 'drizzle-orm';

const PROFILE_ID = 'c4b9da11-f942-4c2b-b2ef-56dbde3125f8';

// Dynamically calculate today's date in IST
const now = new Date();
const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
const istDate = new Date(now.getTime() + istOffset);
const TODAY = istDate.toISOString().split('T')[0];
console.log('📅 Current IST Date:', TODAY);

async function testAttendanceQuery() {
    console.log('='.repeat(60));
    console.log('Testing attendance query for profile:', PROFILE_ID);
    console.log('Today (local):', TODAY);
    console.log('='.repeat(60));

    try {
        // 1. Fetch all attendance records from last 2 days
        const records = await db.select().from(attendance)
            .where(and(
                eq(attendance.profile_id, PROFILE_ID),
                gte(attendance.date, sql`${TODAY}::date - interval '2 days'`)
            ));

        console.log('\n📊 Attendance records found:', records.length);

        if (records.length === 0) {
            console.log('\n✅ No attendance records found - button should show "Office - In"');
        } else {
            console.log('\nRecords:');
            records.forEach((r, i) => {
                console.log(`\n  [${i + 1}] Date: ${r.date}`);
                console.log(`      Date type: ${typeof r.date}`);
                console.log(`      Date stringified: ${String(r.date)}`);
                console.log(`      Check-in: ${r.check_in || 'NULL'}`);
                console.log(`      Check-out: ${r.check_out || 'NULL'}`);
                console.log(`      Status: ${r.status}`);
            });
        }

        // 2. Test the exact comparison logic used in the fix
        console.log('\n' + '='.repeat(60));
        console.log('Testing date comparison logic:');
        console.log('='.repeat(60));

        const normalizeDate = (d: any): string => {
            if (!d) return '';
            if (d instanceof Date) {
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            return String(d);
        };

        const todayRecord = records.find(r => normalizeDate(r.date) === TODAY);
        const pendingRecord = records.filter(r => !r.check_out).sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];

        console.log('\ntodayRecord:', todayRecord ? {
            date: todayRecord.date,
            check_in: todayRecord.check_in,
            check_out: todayRecord.check_out
        } : 'NULL');

        console.log('pendingRecord:', pendingRecord ? {
            date: pendingRecord.date,
            check_in: pendingRecord.check_in,
            check_out: pendingRecord.check_out
        } : 'NULL');

        // 3. Determine button state
        console.log('\n' + '='.repeat(60));
        console.log('Button state determination:');
        console.log('='.repeat(60));

        const isClockedIn = !!pendingRecord && !pendingRecord.check_out;
        const isMarked = !!todayRecord?.check_in && !!todayRecord?.check_out;

        console.log(`\nisClockedIn: ${isClockedIn}`);
        console.log(`isMarked: ${isMarked}`);

        if (isMarked) {
            console.log('\n🟢 Button should show: "Marked Today\'s"');
        } else if (isClockedIn) {
            console.log('\n🟠 Button should show: "Office - Out"');
        } else {
            console.log('\n🔵 Button should show: "Office - In"');
        }

    } catch (error) {
        console.error('Error:', error);
    }

    process.exit(0);
}

testAttendanceQuery();
