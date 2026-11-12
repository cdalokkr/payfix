import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { SalaryService } from '../lib/services/salary.service';
import { tenantStorage } from '../lib/tenant/store';

async function main() {
    console.log('--- Testing Salary Book (Passbook) ---');
    const tenantContext = {
        tenantId: 'c3e28d92-e3ea-4fe0-8efd-927ce550b666',
        slug: 'primary',
        databaseUrl: process.env.DATABASE_URL || null,
        tenantSchema: 'tenant_primary',
        brandName: 'PayFix Corporate',
        trusted: true
    };

    await tenantStorage.run(tenantContext, async () => {
        const book = await SalaryService.getSalaryBook();
        console.log(`✅ Fetched master salary book:`);
        console.log(`   - Total Payslip Records: ${book.records.length}`);
        console.log(`   - Total Employees in Ledger: ${book.employeeLedger.length}`);
        console.log(`   - Grand Total Gross: ₹${book.grandTotals.totalGross}`);
        console.log(`   - Grand Total Net: ₹${book.grandTotals.totalTakeHome}`);
        console.log(`   - Grand Total Paid: ₹${book.grandTotals.totalPaid}`);
        console.log(`   - Grand Total Due: ₹${book.grandTotals.totalBalanceDue}`);
        console.log(`   - Available Years: ${JSON.stringify(book.availableYears)}`);

        if (book.employeeLedger.length > 0) {
            const firstEmp = book.employeeLedger[0];
            console.log(`\n✅ Testing individual employee passbook for ${firstEmp.profile.fullName}:`);
            const empBook = await SalaryService.getSalaryBook({ profileId: firstEmp.profile.id });
            console.log(`   - Records for this employee: ${empBook.records.length}`);
            console.log(`   - Employee Total Gross: ₹${empBook.grandTotals.totalGross}`);
            console.log(`   - Employee Total Paid: ₹${empBook.grandTotals.totalPaid}`);
            console.log(`   - Employee Balance Due: ₹${empBook.grandTotals.totalBalanceDue}`);
        }
    });

    console.log('\n--- Salary Book Test PASSED! ---');
    process.exit(0);
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
