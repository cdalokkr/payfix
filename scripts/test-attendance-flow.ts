/**
 * Test script to verify the full attendance flow
 * Run with: npx tsx scripts/test-attendance-flow.ts
 * 
 * This script tests:
 * 1. Check current state (should be "Office - In")
 * 2. Simulate clock-in → state becomes "Office - Out"
 * 3. Simulate clock-out → state becomes "Marked Today's"
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const PROFILE_ID = 'c4b9da11-f942-4c2b-b2ef-56dbde3125f8';

// Get today's date in IST
function getTodayIST(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(now);
}

function getButtonState(record: any): string {
    if (!record) return '🔵 "Office - In" (no record)';
    if (record.check_in && record.check_out) return '🟢 "Marked Today\'s"';
    if (record.check_in && !record.check_out) return '🟠 "Office - Out"';
    return '🔵 "Office - In" (unexpected state)';
}

async function testAttendanceFlow() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing Supabase environment variables');
        console.log('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
        console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
        process.exit(1);
    }

    // Use service role key to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const TODAY = getTodayIST();

    console.log('='.repeat(60));
    console.log('🔄 Testing Attendance Flow');
    console.log('📅 Date:', TODAY);
    console.log('👤 Profile:', PROFILE_ID);
    console.log('='.repeat(60));

    // Step 1: Check initial state
    console.log('\n📌 STEP 1: Initial State');
    console.log('-'.repeat(40));

    let { data: record, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('profile_id', PROFILE_ID)
        .eq('date', TODAY)
        .maybeSingle();

    if (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }

    console.log('  Record:', record ? 'EXISTS' : 'NONE');
    console.log('  Button State:', getButtonState(record));

    // Step 2: Simulate Clock-In
    console.log('\n📌 STEP 2: Simulating Clock-In');
    console.log('-'.repeat(40));

    if (record) {
        console.log('  ⚠️ Record already exists, deleting first...');
        await supabase.from('attendance').delete().eq('id', record.id);
    }

    const { data: clockInRecord, error: clockInError } = await supabase
        .from('attendance')
        .insert({
            profile_id: PROFILE_ID,
            date: TODAY,
            check_in: new Date().toISOString(),
            status: 'pending'
        })
        .select()
        .single();

    if (clockInError) {
        console.error('❌ Clock-in error:', clockInError.message);
        process.exit(1);
    }

    console.log('  ✅ Clock-in inserted');
    console.log('  Button State:', getButtonState(clockInRecord));
    console.log('  → Expected: 🟠 "Office - Out"');

    // Wait a moment
    await new Promise(r => setTimeout(r, 1000));

    // Step 3: Simulate Clock-Out
    console.log('\n📌 STEP 3: Simulating Clock-Out');
    console.log('-'.repeat(40));

    const { data: clockOutRecord, error: clockOutError } = await supabase
        .from('attendance')
        .update({
            check_out: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', clockInRecord.id)
        .select()
        .single();

    if (clockOutError) {
        console.error('❌ Clock-out error:', clockOutError.message);
        process.exit(1);
    }

    console.log('  ✅ Clock-out updated');
    console.log('  Button State:', getButtonState(clockOutRecord));
    console.log('  → Expected: 🟢 "Marked Today\'s"');

    // Final verification
    console.log('\n📌 FINAL: Verification');
    console.log('-'.repeat(40));

    const { data: finalRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('profile_id', PROFILE_ID)
        .eq('date', TODAY)
        .single();

    console.log('  Date:', finalRecord?.date);
    console.log('  Check-in:', finalRecord?.check_in);
    console.log('  Check-out:', finalRecord?.check_out);
    console.log('  Working Hours:', finalRecord?.working_hours);
    console.log('  Status:', finalRecord?.status);
    console.log('  Final Button State:', getButtonState(finalRecord));

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed - Refresh UI to verify button states');
    console.log('='.repeat(60));

    process.exit(0);
}

testAttendanceFlow().catch(console.error);
