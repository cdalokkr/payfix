/**
 * Debug script to check exact date format returned by Drizzle
 * Run with: npx tsx scripts/debug-drizzle-date.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../lib/db';
import { attendance } from '../lib/db/schema';
import { eq, gte, and, sql, desc } from 'drizzle-orm';

const PROFILE_ID = 'c4b9da11-f942-4c2b-b2ef-56dbde3125f8';

async function debugDrizzleDate() {
    console.log('='.repeat(60));
    console.log('🔍 Debugging Drizzle Date Format');
    console.log('='.repeat(60));

    // Calculate today using different methods
    const jsDate = new Date();
    const todayJS = jsDate.toISOString().split('T')[0];

    const localYear = jsDate.getFullYear();
    const localMonth = String(jsDate.getMonth() + 1).padStart(2, '0');
    const localDay = String(jsDate.getDate()).padStart(2, '0');
    const todayLocal = `${localYear}-${localMonth}-${localDay}`;

    console.log('\n📅 Date Calculations:');
    console.log('  JS ISO Date:', todayJS);
    console.log('  Local Date:', todayLocal);
    console.log('  Are they equal?', todayJS === todayLocal);

    // Direct Drizzle query
    console.log('\n📊 Direct Drizzle Query Results:');
    console.log('-'.repeat(60));

    // Query ALL attendance records for this profile (last 5 days)
    const records = await db.select().from(attendance)
        .where(and(
            eq(attendance.profile_id, PROFILE_ID),
            gte(attendance.date, sql`CURRENT_DATE - INTERVAL '5 days'`)
        ))
        .orderBy(desc(attendance.date));

    if (records.length === 0) {
        console.log('  No records found in last 5 days');
    } else {
        console.log(`  Found ${records.length} records:\n`);

        records.forEach((r, i) => {
            console.log(`  [Record ${i + 1}]`);
            console.log(`    date value:`, r.date);
            console.log(`    date type:`, typeof r.date);
            console.log(`    date instanceof Date:`, (r.date as any) instanceof Date);
            console.log(`    date.constructor.name:`, r.date?.constructor?.name);
            console.log(`    JSON.stringify(date):`, JSON.stringify(r.date));
            console.log(`    String(date):`, String(r.date));

            // Try to match
            console.log(`    === todayLocal (${todayLocal})?`, r.date === todayLocal);
            console.log(`    String(date) === todayLocal?`, String(r.date) === todayLocal);

            // If it's a Date object
            if ((r.date as any) instanceof Date) {
                const dateObj = r.date as any as Date;
                const normalized = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                console.log(`    Normalized from Date:`, normalized);
                console.log(`    normalized === todayLocal?`, normalized === todayLocal);
            }

            console.log('');
        });
    }

    // Test the exact normalizeDate function from server
    console.log('\n🔧 Testing normalizeDate function:');
    console.log('-'.repeat(60));

    const normalizeDate = (d: any): string => {
        if (!d) return '';
        if (d instanceof Date) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return String(d);
    };

    records.forEach((r, i) => {
        const normalized = normalizeDate(r.date);
        console.log(`  Record ${i + 1}: "${normalized}" === "${todayLocal}"? ${normalized === todayLocal}`);
    });

    // Find today's record
    const todayRecord = records.find(r => normalizeDate(r.date) === todayLocal);
    console.log('\n📋 Today Record:', todayRecord ? {
        id: todayRecord.id,
        date: todayRecord.date,
        check_in: todayRecord.check_in,
        check_out: todayRecord.check_out,
        status: todayRecord.status
    } : 'NOT FOUND');

    // Determine button state
    const isClockedIn = todayRecord?.check_in && !todayRecord?.check_out;
    const isMarked = todayRecord?.check_in && todayRecord?.check_out;

    console.log('\n🎯 Button State:');
    if (!todayRecord) {
        console.log('  🔵 BUTTON: "Office - In" (no record for today)');
    } else if (isMarked) {
        console.log('  🟢 BUTTON: "Marked Today" (both check_in and check_out exist)');
    } else if (isClockedIn) {
        console.log('  🟠 BUTTON: "Office - Out" (check_in exists, no check_out)');
    } else {
        console.log('  🔵 BUTTON: "Office - In" (record exists but no check_in?)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug completed');
    console.log('='.repeat(60));

    process.exit(0);
}

debugDrizzleDate().catch(console.error);
