import { calculateAttendanceExtraHours } from '../lib/utils/attendance-extra-hours'

function assert(description: string, actual: any, expected: any) {
    if (actual === expected) {
        console.log(`✅ [PASS] ${description}: ${actual}`);
    } else {
        console.error(`❌ [FAIL] ${description}: expected ${expected}, got ${actual}`);
        process.exitCode = 1;
    }
}

console.log('--- RUNNING ATTENDANCE EXTRA HOURS TESTS ---\n');

// Test Case 1: Alok test user (Nov 4th screenshot: 09:09 PM to 09:13 PM, office 10am-7pm, duty 8h, 4 mins worked)
{
    const res = calculateAttendanceExtraHours({
        checkIn: '2026-11-04T21:09:00+05:30',
        checkOut: '2026-11-04T21:13:00+05:30',
        officeTiming: {
            check_in_time: '10:00:00',
            check_out_time: '19:00:00',
            buffer_minutes: 15
        },
        workingHours: 0.05,
        dutyHours: 8,
        date: '2026-11-04'
    });
    assert('Case 1 (Alok test user 4-min punch)', res.extraHours, 0);
    assert('Case 1 early extra', res.earlyExtraHours, 0);
    assert('Case 1 late extra', res.lateExtraHours, 0);
}

// Test Case 2: Hotel Staff 1:00 PM to 7:00 PM shift, works 1:00 PM to 11:30 PM (6h shift, 10.5h worked)
{
    const res = calculateAttendanceExtraHours({
        checkIn: '2026-11-05T13:00:00+05:30',
        checkOut: '2026-11-05T23:30:00+05:30',
        shiftTiming: {
            startTime: '13:00:00',
            endTime: '19:00:00',
            dutyHours: 6,
            bufferMinutes: 15
        },
        workingHours: 10.5,
        dutyHours: 6,
        date: '2026-11-05'
    });
    assert('Case 2 (Hotel staff 1pm-7pm shift, out at 11:30pm)', res.extraHours, 4.5);
    assert('Case 2 late extra hours', res.lateExtraHours, 4.5);
    assert('Case 2 source applied', res.ruleApplied.source, 'shift');
}

// Test Case 3: Early arrival (09:15 AM to 07:00 PM, office 10am-7pm, 45 mins before start)
{
    const res = calculateAttendanceExtraHours({
        checkIn: '2026-11-05T09:15:00+05:30',
        checkOut: '2026-11-05T19:00:00+05:30',
        officeTiming: {
            check_in_time: '10:00:00',
            check_out_time: '19:00:00',
            buffer_minutes: 15
        },
        workingHours: 9.75,
        dutyHours: 8,
        date: '2026-11-05'
    });
    assert('Case 3 (Early arrival 09:15 AM)', res.extraHours, 0.75);
    assert('Case 3 early extra hours', res.earlyExtraHours, 0.75);
}

// Test Case 4: Grace buffer (Leaves 10 mins after end time, <= 15 mins buffer)
{
    const res = calculateAttendanceExtraHours({
        checkIn: '2026-11-05T10:05:00+05:30',
        checkOut: '2026-11-05T19:10:00+05:30',
        officeTiming: {
            check_in_time: '10:00:00',
            check_out_time: '19:00:00',
            buffer_minutes: 15
        },
        workingHours: 9.08,
        dutyHours: 8,
        date: '2026-11-05'
    });
    assert('Case 4 (Within 15-min buffer)', res.extraHours, 0);
}

// Test Case 5: Overnight Shift (22:00 to 06:00, checks in 21:30, checks out 07:30)
{
    const res = calculateAttendanceExtraHours({
        checkIn: '2026-11-05T22:30:00+05:30',
        checkOut: '2026-11-06T07:30:00+05:30',
        shiftTiming: {
            startTime: '22:00:00',
            endTime: '06:00:00',
            isOvernight: true,
            dutyHours: 8,
            bufferMinutes: 15
        },
        workingHours: 9,
        dutyHours: 8,
        date: '2026-11-05'
    });
    // 06:00 to 07:30 is 1.5 hours late extra
    assert('Case 5 (Overnight shift late extra)', res.lateExtraHours, 1.5);
    assert('Case 5 total extra', res.extraHours, 1.5);
}

// Test Case 6: Cross-Month Night Shift with Overtime (Oct 31 22:00 -> Nov 1 08:00)
// Scheduled: 22:00 to 06:00 (8h), actual: 22:00 to 08:00 (10h, 2h late OT)
{
    const res = calculateAttendanceExtraHours({
        checkIn: '2026-10-31T22:00:00+05:30',
        checkOut: '2026-11-01T08:00:00+05:30',
        shiftTiming: {
            startTime: '22:00:00',
            endTime: '06:00:00',
            isOvernight: true,
            dutyHours: 8,
            bufferMinutes: 15
        },
        workingHours: 10,
        dutyHours: 8,
        date: '2026-10-31'
    });
    assert('Case 6 (Cross-month Oct 31 -> Nov 1 late extra)', res.lateExtraHours, 2);
    assert('Case 6 (Cross-month total extra)', res.extraHours, 2);
    assert('Case 6 rule source', res.ruleApplied.source, 'shift');
}

console.log('\n--- ALL TEST CASES COMPLETED ---');
