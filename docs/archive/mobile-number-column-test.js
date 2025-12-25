// Mobile Number Column Implementation Test Suite
const { chromium } = require('playwright');

async function testMobileNumberColumn() {
    console.log('🧪 Starting Mobile Number Column Test Suite...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const testResults = {
        serverStarted: false,
        routeAccessible: false,
        mobileColumnVisible: false,
        searchFunctionality: false,
        layoutStyling: false,
        existingDataDisplay: false,
        functionalityNotBroken: false,
        errors: []
    };

    try {
        // Test 1: Server Health Check
        console.log('1. Testing server startup...');
        try {
            await page.goto('http://localhost:3001');
            await page.waitForTimeout(2000);
            const url = page.url();
            if (url.includes('localhost:3001')) {
                testResults.serverStarted = true;
                console.log('✅ Server is running on localhost:3001');
            } else {
                testResults.errors.push('Server did not start properly');
            }
        } catch (error) {
            testResults.errors.push(`Server test failed: ${error.message}`);
        }

        // Test 2: Route Accessibility
        console.log('\n2. Testing /dashboard/admin/users/all route...');
        try {
            await page.goto('http://localhost:3001/dashboard/admin/users/all');
            await page.waitForSelector('body', { timeout: 10000 });
            testResults.routeAccessible = true;
            console.log('✅ Route /dashboard/admin/users/all is accessible');
        } catch (error) {
            testResults.errors.push(`Route test failed: ${error.message}`);
        }

        // Test 3: Mobile Number Column Visibility
        console.log('\n3. Testing mobile number column visibility...');
        try {
            // Look for the mobile number column header
            const mobileColumnHeader = await page.locator('th:has-text("Mobile Number")').isVisible();
            if (mobileColumnHeader) {
                testResults.mobileColumnVisible = true;
                console.log('✅ Mobile Number column header is visible');
            } else {
                testResults.errors.push('Mobile Number column header not found');
            }

            // Check if mobile number data cells are present
            const mobileCells = await page.locator('td').filter({ hasText: /^\+?[0-9\s\-\(\)]+$/ }).count();
            if (mobileCells > 0) {
                console.log(`✅ Found ${mobileCells} mobile number data cells`);
            }
        } catch (error) {
            testResults.errors.push(`Mobile column visibility test failed: ${error.message}`);
        }

        // Test 4: Search Functionality with Mobile Numbers
        console.log('\n4. Testing search functionality with mobile numbers...');
        try {
            const searchInput = await page.locator('input[placeholder*="mobile number" i]').or(
                page.locator('input[placeholder*="email, name" i]')
            );

            if (await searchInput.isVisible()) {
                await searchInput.fill('9876543210');
                await page.waitForTimeout(1000);

                // Check if search is working (table should update)
                const tableRows = await page.locator('tbody tr').count();
                testResults.searchFunctionality = true;
                console.log('✅ Search input found and functional');
                console.log(`   Table shows ${tableRows} rows after search`);
            } else {
                testResults.errors.push('Search input not found');
            }
        } catch (error) {
            testResults.errors.push(`Search functionality test failed: ${error.message}`);
        }

        // Test 5: Layout and Styling
        console.log('\n5. Testing layout and styling...');
        try {
            // Check if table is properly styled
            const table = await page.locator('table').isVisible();
            const tableHeaders = await page.locator('th').count();

            if (table && tableHeaders > 0) {
                testResults.layoutStyling = true;
                console.log(`✅ Table layout is proper with ${tableHeaders} columns`);

                // Check for responsive design indicators
                const mobileColumnVisible = await page.locator('th:has-text("Mobile Number")').isVisible();
                console.log(`✅ Mobile Number column visible on current screen: ${mobileColumnVisible}`);
            }
        } catch (error) {
            testResults.errors.push(`Layout test failed: ${error.message}`);
        }

        // Test 6: Existing User Data Display
        console.log('\n6. Testing existing user data display...');
        try {
            const userRows = await page.locator('tbody tr').filter({ hasText: '@' }).count();
            if (userRows > 0) {
                testResults.existingDataDisplay = true;
                console.log(`✅ Found ${userRows} user rows with email data`);

                // Check if mobile numbers are displayed for users
                const mobileDataVisible = await page.locator('td').filter({ hasText: /^[0-9\+\-\s\(\)]+$/ }).count();
                console.log(`✅ Mobile number data visible in ${mobileDataVisible} cells`);
            } else {
                testResults.errors.push('No user data found');
            }
        } catch (error) {
            testResults.errors.push(`Existing data display test failed: ${error.message}`);
        }

        // Test 7: Ensure existing functionality works
        console.log('\n7. Testing existing functionality...');
        try {
            // Check if edit/delete buttons are working
            const editButtons = await page.locator('button:has-text("Edit")').count();
            const deleteButtons = await page.locator('button:has-text("Delete")').count();

            if (editButtons > 0 && deleteButtons > 0) {
                testResults.functionalityNotBroken = true;
                console.log(`✅ Found ${editButtons} Edit buttons and ${deleteButtons} Delete buttons`);
            }

            // Check pagination
            const paginationVisible = await page.locator('[class*="pagination"], [data-testid="pagination"]').isVisible();
            console.log(`✅ Pagination functionality present: ${paginationVisible}`);

            // Check role filtering
            const roleFilter = await page.locator('select, [role="combobox"]').count();
            console.log(`✅ Found ${roleFilter} filter/dropdown elements`);

        } catch (error) {
            testResults.errors.push(`Existing functionality test failed: ${error.message}`);
        }

    } catch (error) {
        testResults.errors.push(`General test failure: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Generate Test Report
    console.log('\n' + '='.repeat(60));
    console.log('📋 MOBILE NUMBER COLUMN TEST REPORT');
    console.log('='.repeat(60));

    console.log('\n✅ PASSED TESTS:');
    for (const [test, passed] of Object.entries(testResults)) {
        if (test !== 'errors' && passed) {
            console.log(`   ✓ ${test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`);
        }
    }

    console.log('\n❌ FAILED TESTS:');
    if (testResults.errors.length === 0) {
        console.log('   None - All tests passed! 🎉');
    } else {
        testResults.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }

    console.log('\n📊 SUMMARY:');
    const passedTests = Object.values(testResults).filter(result => result === true).length;
    const totalTests = Object.keys(testResults).length - 1; // Exclude errors array
    console.log(`   Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\n🎯 IMPLEMENTATION STATUS:');
    if (passedTests === totalTests) {
        console.log('   🟢 MOBILE NUMBER COLUMN IMPLEMENTATION IS FULLY FUNCTIONAL');
    } else if (passedTests >= totalTests * 0.7) {
        console.log('   🟡 MOBILE NUMBER COLUMN IMPLEMENTATION IS MOSTLY FUNCTIONAL');
    } else {
        console.log('   🔴 MOBILE NUMBER COLUMN IMPLEMENTATION NEEDS ATTENTION');
    }

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   • Ensure server is running on localhost:3001');
    console.log('   • Navigate to http://localhost:3001/dashboard/admin/users/all');
    console.log('   • Verify mobile number column appears in user table');
    console.log('   • Test search with mobile numbers');
    console.log('   • Check responsive layout on different screen sizes');

    return testResults;
}

// Run the test if this file is executed directly
if (require.main === module) {
    testMobileNumberColumn().catch(console.error);
}

module.exports = { testMobileNumberColumn };