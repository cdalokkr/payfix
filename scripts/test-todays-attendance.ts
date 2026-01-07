/**
 * Test script to verify today's attendance for a specific profile
 * Run with: npx tsx scripts/test-todays-attendance.ts
 */

// Load environment variables first
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const PROFILE_ID = 'c4b9da11-f942-4c2b-b2ef-56dbde3125f8';

// Dynamically calculate today's date in IST (YYYY-MM-DD format)
function getTodayIST(): string {
    const now = new Date();
    // Format for IST timezone
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD format
    return formatter.format(now);
}

async function testTodayAttendance() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('❌ Missing Supabase environment variables');
        console.log('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
        console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const TODAY = getTodayIST();

    console.log('='.repeat(60));
    console.log('📅 Testing attendance for TODAY:', TODAY);
    console.log('👤 Profile ID:', PROFILE_ID);
    console.log('='.repeat(60));

    try {
        // Query today's attendance record
        const { data: todayRecord, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('profile_id', PROFILE_ID)
            .eq('date', TODAY)
            .maybeSingle();

        if (error) {
            console.error('❌ Database error:', error.message);
            process.exit(1);
        }

        console.log('\n📊 Today\'s Attendance Record:');
        console.log('-'.repeat(60));

        if (!todayRecord) {
            console.log('  No attendance record found for today');
            console.log('\n🔵 BUTTON STATE: "Office - In"');
            console.log('   → User has not clocked in yet');
        } else {
            console.log('  ID:', todayRecord.id);
            console.log('  Date:', todayRecord.date);
            console.log('  Check-in:', todayRecord.check_in || 'NULL');
            console.log('  Check-out:', todayRecord.check_out || 'NULL');
            console.log('  Working Hours:', todayRecord.working_hours || 'NULL');
            console.log('  Status:', todayRecord.status);
            console.log('  Is Extra Day:', todayRecord.is_extra_day);
            console.log('  Is Half Day:', todayRecord.is_half_day);
            console.log('  Created At:', todayRecord.created_at);

            // Determine button state
            const hasCheckIn = !!todayRecord.check_in;
            const hasCheckOut = !!todayRecord.check_out;

            console.log('\n📋 Button State Logic:');
            console.log('  hasCheckIn:', hasCheckIn);
            console.log('  hasCheckOut:', hasCheckOut);

            if (hasCheckIn && hasCheckOut) {
                console.log('\n🟢 BUTTON STATE: "Marked Today\'s"');
                console.log('   → User has completed attendance (in + out)');
            } else if (hasCheckIn && !hasCheckOut) {
                console.log('\n🟠 BUTTON STATE: "Office - Out"');
                console.log('   → User is clocked in, waiting for clock out');
            } else {
                console.log('\n🔵 BUTTON STATE: "Office - In"');
                console.log('   → Unexpected state: has record but no check_in');
            }
        }

        // Also fetch recent records for context
        console.log('\n\n' + '='.repeat(60));
        console.log('📅 Recent Attendance Records (last 3 days):');
        console.log('='.repeat(60));

        const { data: recentRecords, error: recentError } = await supabase
            .from('attendance')
            .select('date, check_in, check_out, status, working_hours')
            .eq('profile_id', PROFILE_ID)
            .gte('date', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: false });

        if (recentError) {
            console.error('❌ Error fetching recent records:', recentError.message);
        } else if (recentRecords && recentRecords.length > 0) {
            recentRecords.forEach((r, i) => {
                console.log(`\n  [${i + 1}] Date: ${r.date}`);
                console.log(`      Check-in:  ${r.check_in || 'NULL'}`);
                console.log(`      Check-out: ${r.check_out || 'NULL'}`);
                console.log(`      Status:    ${r.status}`);
                console.log(`      Hours:     ${r.working_hours || 'NULL'}`);
            });
        } else {
            console.log('  No recent records found');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed');
    console.log('='.repeat(60));

    process.exit(0);
}

testTodayAttendance();
