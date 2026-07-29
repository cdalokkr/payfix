/**
 * Database Advances Cleanup Script
 * Run with: npx tsx scripts/clear-advances.ts
 * 
 * Clears/deletes advances:
 * 1. All records before May 1, 2026 for all employees.
 * 2. All records of tonyjaa.aslam@gmail.com (Md Asif).
 * 
 * Also updates/recalculates monthly summaries and carry-forwards where needed.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local FIRST before importing any DB-related modules
config({ path: resolve(process.cwd(), '.env.local') });

// Confirm environment variable is loaded
if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in environment!');
    process.exit(1);
}

async function main() {
    console.log('='.repeat(60));
    console.log('🧹 DATABASE ADVANCES CLEANUP & RECALCULATION');
    console.log('='.repeat(60));

    // Dynamically import DB modules to ensure env vars are loaded
    const { db } = await import('../lib/db');
    const { employeeAdvances, monthlyAttendanceSummary, profiles } = await import('../lib/db/schema');
    const { eq, lt, or, inArray } = await import('drizzle-orm');
    const { SalaryService } = await import('../lib/services/salary.service');

    // 1. Find Md Asif's profile
    const asifEmail = 'tonyjaa.aslam@gmail.com';
    const asifProfile = await db.query.profiles.findFirst({
        where: eq(profiles.email, asifEmail)
    });

    if (asifProfile) {
        console.log(`👤 Found Md Asif: ${asifProfile.full_name} (ID: ${asifProfile.id})`);
    } else {
        console.warn(`⚠️ WARNING: Md Asif profile with email ${asifEmail} not found.`);
    }

    // 2. Identify advances matching the delete criteria
    const deleteConditions: any[] = [];
    deleteConditions.push(lt(employeeAdvances.date, '2026-05-01'));
    if (asifProfile) {
        deleteConditions.push(eq(employeeAdvances.profile_id, asifProfile.id));
    }

    const advancesToDelete = await db.select().from(employeeAdvances).where(
        or(...deleteConditions)
    );

    console.log(`\n🔍 Found ${advancesToDelete.length} advance records matching deletion criteria:`);
    for (const adv of advancesToDelete) {
        console.log(`   - Profile ID: ${adv.profile_id}, Date: ${adv.date}, Amount: ${adv.amount}, Particulars: "${adv.particulars}"`);
    }

    if (advancesToDelete.length === 0) {
        console.log('\n✅ No advance records found to delete. Exiting.');
        process.exit(0);
    }

    // 3. Find unique affected profile IDs
    const affectedProfileIds = Array.from(new Set(advancesToDelete.map(a => a.profile_id)));
    console.log(`\n👥 Affected Profile IDs count: ${affectedProfileIds.length}`);

    // 4. Fetch all monthly summaries for these profiles
    const summaries = await db.select().from(monthlyAttendanceSummary).where(
        inArray(monthlyAttendanceSummary.profile_id as any, affectedProfileIds as any)
    );

    // Sort summaries chronologically: first by year, then by month
    summaries.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    console.log(`📊 Found ${summaries.length} monthly summaries that may be affected.`);

    // 5. Delete the advances
    console.log('\n🗑️ Deleting target advances from employee_advances table...');
    const deleteResult = await db.delete(employeeAdvances).where(
        or(...deleteConditions)
    );
    console.log(`✅ Deletion completed.`);

    // 6. Recalculate affected summaries chronologically
    console.log('\n🔄 Recalculating affected monthly summaries chronologically...');
    for (const summary of summaries) {
        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, summary.profile_id),
            columns: { full_name: true, email: true }
        });

        console.log(`   Recalculating: ${profile?.full_name || 'Unknown'} (${summary.month}/${summary.year}) - Status: ${summary.status}`);
        
        // Map fields to parameters required by updateAndRecalculateSummary
        const existingSummary = {
            id: summary.id,
            profile_id: summary.profile_id,
            month: summary.month,
            year: summary.year,
            status: summary.status,
            total_working_days: summary.total_working_days,
            total_present_days: summary.total_present_days,
            total_absent_days: summary.total_absent_days,
            total_half_days: summary.total_half_days,
            total_leaves: summary.total_leaves,
            total_working_hours: summary.total_working_hours,
            total_extra_hours: summary.total_extra_hours,
            salary_breakdown: summary.salary_breakdown
        };

        const summaryBD = (summary.salary_breakdown as Record<string, any>) || {};
        const metrics = {
            totalWorkingDays: summary.total_working_days || 0,
            presentDays: summary.total_present_days || 0,
            halfDays: summary.total_half_days || 0,
            absentDays: summary.total_absent_days || 0,
            leaveDays: summary.total_leaves || 0,
            totalWorkingHours: Number(summary.total_working_hours) || 0,
            totalExtraHours: Number(summary.total_extra_hours) || 0,
            extraDays: summaryBD.extra_days || 0,
            source: summaryBD.source || 'compiled'
        };

        const updated = await SalaryService.updateAndRecalculateSummary(existingSummary, metrics);
        
        if (summary.status === 'payslip_generated' && updated) {
            console.log(`      -> Old Advance Recovery: ${summary.advance_recovery}, New: ${updated.advance_recovery}`);
            console.log(`      -> Old Take Home: ${summary.take_home}, New: ${updated.take_home}`);
        }
    }

    console.log('\n🎉 Recalculation and database updates completed successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Fatal error executing script:', err);
    process.exit(1);
});
