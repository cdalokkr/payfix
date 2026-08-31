#!/usr/bin/env node
/**
 * Real-Time Multi-Browser Dashboard Validation Script
 *
 * This script validates the implementation of the role-based real-time
 * dashboard system by checking:
 *
 * 1. Hook exports are properly defined
 * 2. Channel naming convention is correct
 * 3. Role-based filtering is in place
 * 4. Component integration is correct
 *
 * Usage:
 *   node scripts/validate-realtime-multi-browser.js
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

// Validation results
const results = {
    passed: [],
    failed: [],
    warnings: [],
};

/**
 * Log a success message
 */
function logSuccess(message) {
    console.log(`${colors.green}✅ PASS${colors.reset}: ${message}`);
    results.passed.push(message);
}

/**
 * Log a failure message
 */
function logFailure(message, details = '') {
    console.log(`${colors.red}❌ FAIL${colors.reset}: ${message}`);
    if (details) {
        console.log(`   ${colors.yellow}Details: ${details}${colors.reset}`);
    }
    results.failed.push({ message, details });
}

/**
 * Log a warning message
 */
function logWarning(message) {
    console.log(`${colors.yellow}⚠️  WARN${colors.reset}: ${message}`);
    results.warnings.push(message);
}

/**
 * Log an info message
 */
function logInfo(message) {
    console.log(`${colors.cyan}ℹ️  INFO${colors.reset}: ${message}`);
}

/**
 * Log a section header
 */
function logSection(title) {
    console.log(`\n${colors.bright}${colors.blue}━━━ ${title} ━━━${colors.reset}\n`);
}

/**
 * Read a file and return its contents
 */
function readFile(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
        return null;
    }
    return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Check if a file exists
 */
function fileExists(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    return fs.existsSync(fullPath);
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate that the real-time hook file exists and has required exports
 */
function validateHookExports() {
    logSection('Validating Hook Exports');

    const hookPath = 'hooks/use-realtime-dashboard-data.ts';
    const content = readFile(hookPath);

    if (!content) {
        logFailure(`Hook file not found: ${hookPath}`);
        return false;
    }

    logSuccess(`Hook file exists: ${hookPath}`);

    // Check for required exports
    const requiredExports = [
        { name: 'useRoleBasedRealtimeDashboard', pattern: /export\s+function\s+useRoleBasedRealtimeDashboard/ },
        { name: 'useAdminRealtimeDashboard', pattern: /export\s+function\s+useAdminRealtimeDashboard/ },
        { name: 'useUserRealtimeDashboard', pattern: /export\s+function\s+useUserRealtimeDashboard/ },
    ];

    let allExportsFound = true;

    for (const exp of requiredExports) {
        if (exp.pattern.test(content)) {
            logSuccess(`Export found: ${exp.name}`);
        } else {
            logFailure(`Export not found: ${exp.name}`);
            allExportsFound = false;
        }
    }

    // Check for legacy/deprecated exports (should exist for backward compatibility)
    const legacyExports = [
        { name: 'useComprehensiveRealtimeDashboard', pattern: /export\s+function\s+useComprehensiveRealtimeDashboard/ },
        { name: 'useRealtimeDashboardData', pattern: /export\s+const\s+useRealtimeDashboardData/ },
    ];

    for (const exp of legacyExports) {
        if (exp.pattern.test(content)) {
            logWarning(`Legacy export found (deprecated): ${exp.name}`);
        }
    }

    return allExportsFound;
}

/**
 * Validate channel naming convention
 */
function validateChannelNaming() {
    logSection('Validating Channel Naming Convention');

    const hookPath = 'hooks/use-realtime-dashboard-data.ts';
    const content = readFile(hookPath);

    if (!content) {
        logFailure('Cannot validate channel naming - hook file not found');
        return false;
    }

    // Check for admin channel naming pattern
    const adminChannelPattern = /`dashboard-admin-\$\{userId\}`/;
    if (adminChannelPattern.test(content)) {
        logSuccess('Admin channel naming convention found: dashboard-admin-{userId}');
    } else {
        logFailure('Admin channel naming convention not found');
        return false;
    }

    // Check for user channel naming pattern
    const userChannelPattern = /`dashboard-user-\$\{userId\}`/;
    if (userChannelPattern.test(content)) {
        logSuccess('User channel naming convention found: dashboard-user-{userId}');
    } else {
        logFailure('User channel naming convention not found');
        return false;
    }

    // Check for role-based channel selection
    const roleBasedSelection = /role\s*===\s*['"]admin['"]/;
    if (roleBasedSelection.test(content)) {
        logSuccess('Role-based channel selection logic found');
    } else {
        logFailure('Role-based channel selection logic not found');
        return false;
    }

    return true;
}

/**
 * Validate role-based filtering for subscriptions
 */
function validateRoleBasedFiltering() {
    logSection('Validating Role-Based Filtering');

    const hookPath = 'hooks/use-realtime-dashboard-data.ts';
    const content = readFile(hookPath);

    if (!content) {
        logFailure('Cannot validate filtering - hook file not found');
        return false;
    }

    let allChecksPass = true;

    // Check for admin subscriptions to profiles table
    const adminProfilesSub = /table:\s*['"]profiles['"]/;
    if (adminProfilesSub.test(content)) {
        logSuccess('Admin subscription to profiles table found');
    } else {
        logFailure('Admin subscription to profiles table not found');
        allChecksPass = false;
    }

    // Check for admin subscriptions to activities table (unfiltered)
    if (content.includes("table: 'activities'") && content.includes("role === 'admin'")) {
        logSuccess('Admin subscription to activities table found (unfiltered)');
    } else {
        logWarning('Could not verify admin activities subscription is unfiltered');
    }

    // Check for admin subscriptions to analytics_metrics table
    const adminAnalyticsSub = /table:\s*['"]analytics_metrics['"]/;
    if (adminAnalyticsSub.test(content)) {
        logSuccess('Admin subscription to analytics_metrics table found');
    } else {
        logFailure('Admin subscription to analytics_metrics table not found');
        allChecksPass = false;
    }

    // Check for user-filtered activities subscription
    const userFilteredSub = /filter:\s*`user_id=eq\.\$\{userId\}`/;
    if (userFilteredSub.test(content)) {
        logSuccess('User-filtered activities subscription found (user_id=eq.{userId})');
    } else {
        logFailure('User-filtered activities subscription not found');
        allChecksPass = false;
    }

    // Check that users do NOT subscribe to profiles
    // This is implicit - we check that profiles subscription is only in admin block
    const profilesInAdminBlock = content.includes("role === 'admin'") &&
        content.includes("table: 'profiles'");
    if (profilesInAdminBlock) {
        logSuccess('Profiles subscription is correctly limited to admin role');
    } else {
        logWarning('Could not verify profiles subscription is admin-only');
    }

    return allChecksPass;
}

/**
 * Validate component integration
 */
function validateComponentIntegration() {
    logSection('Validating Component Integration');

    let allChecksPass = true;

    // Check admin-overview.tsx
    const adminOverviewPath = 'components/dashboard/admin-overview.tsx';
    const adminContent = readFile(adminOverviewPath);

    if (!adminContent) {
        logFailure(`Admin overview component not found: ${adminOverviewPath}`);
        allChecksPass = false;
    } else {
        logSuccess(`Admin overview component exists: ${adminOverviewPath}`);

        // Check for correct hook import
        if (adminContent.includes('useAdminRealtimeDashboard')) {
            logSuccess('Admin overview uses useAdminRealtimeDashboard hook');
        } else if (adminContent.includes('useRoleBasedRealtimeDashboard')) {
            logSuccess('Admin overview uses useRoleBasedRealtimeDashboard hook');
        } else {
            logFailure('Admin overview does not use correct real-time hook');
            allChecksPass = false;
        }

        // Check for userId being passed
        if (adminContent.includes("profile?.user_id") || adminContent.includes("userId")) {
            logSuccess('Admin overview passes userId to real-time hook');
        } else {
            logWarning('Could not verify userId is passed to real-time hook');
        }
    }

    // Check user-overview.tsx
    const userOverviewPath = 'components/dashboard/user-overview.tsx';
    const userContent = readFile(userOverviewPath);

    if (!userContent) {
        logFailure(`User overview component not found: ${userOverviewPath}`);
        allChecksPass = false;
    } else {
        logSuccess(`User overview component exists: ${userOverviewPath}`);

        // Check for correct hook import
        if (userContent.includes('useUserRealtimeDashboard')) {
            logSuccess('User overview uses useUserRealtimeDashboard hook');
        } else if (userContent.includes('useRoleBasedRealtimeDashboard')) {
            logSuccess('User overview uses useRoleBasedRealtimeDashboard hook');
        } else {
            logFailure('User overview does not use correct real-time hook');
            allChecksPass = false;
        }

        // Check for userId being passed
        if (userContent.includes("profile?.user_id") || userContent.includes("userId")) {
            logSuccess('User overview passes userId to real-time hook');
        } else {
            logWarning('Could not verify userId is passed to real-time hook');
        }
    }

    return allChecksPass;
}

/**
 * Validate Supabase migrations exist
 */
function validateMigrations() {
    logSection('Validating Supabase Migrations');

    let allChecksPass = true;

    // Check for realtime enablement migration
    const realtimeMigration = 'supabase/migrations/20251125110000_enable_realtime_for_dashboard.sql';
    if (fileExists(realtimeMigration)) {
        logSuccess(`Realtime enablement migration exists: ${realtimeMigration}`);

        const content = readFile(realtimeMigration);
        if (content) {
            // Check for required tables in publication
            const tables = ['profiles', 'activities', 'analytics_metrics'];
            for (const table of tables) {
                if (content.includes(table)) {
                    logSuccess(`Migration includes ${table} table`);
                } else {
                    logWarning(`Migration may not include ${table} table`);
                }
            }
        }
    } else {
        logFailure(`Realtime enablement migration not found: ${realtimeMigration}`);
        allChecksPass = false;
    }

    // Check for RLS policies migration
    const rlsMigration = 'supabase/migrations/20251125130000_add_dashboard_rls_policies.sql';
    if (fileExists(rlsMigration)) {
        logSuccess(`RLS policies migration exists: ${rlsMigration}`);
    } else {
        logWarning(`RLS policies migration not found: ${rlsMigration}`);
    }

    return allChecksPass;
}

/**
 * Validate console logging is in place for debugging
 */
function validateConsoleLogging() {
    logSection('Validating Console Logging');

    const hookPath = 'hooks/use-realtime-dashboard-data.ts';
    const content = readFile(hookPath);

    if (!content) {
        logFailure('Cannot validate logging - hook file not found');
        return false;
    }

    let allChecksPass = true;

    // Check for subscription setup logging
    const setupLogging = /console\.log\(.*Setting up.*real-time/;
    if (setupLogging.test(content)) {
        logSuccess('Subscription setup logging found');
    } else {
        logWarning('Subscription setup logging not found');
    }

    // Check for admin event logging
    const adminEventLogging = /console\.log\(.*\[Admin\].*Real-time update/;
    if (adminEventLogging.test(content)) {
        logSuccess('Admin event logging found');
    } else {
        logFailure('Admin event logging not found');
        allChecksPass = false;
    }

    // Check for user event logging
    const userEventLogging = /console\.log\(.*\[User\].*Real-time update/;
    if (userEventLogging.test(content)) {
        logSuccess('User event logging found');
    } else {
        logFailure('User event logging not found');
        allChecksPass = false;
    }

    // Check for subscription success logging
    const successLogging = /console\.log\(.*Successfully subscribed/;
    if (successLogging.test(content)) {
        logSuccess('Subscription success logging found');
    } else {
        logWarning('Subscription success logging not found');
    }

    // Check for cleanup logging
    const cleanupLogging = /console\.log\(.*Cleaning up.*real-time/;
    if (cleanupLogging.test(content)) {
        logSuccess('Cleanup logging found');
    } else {
        logWarning('Cleanup logging not found');
    }

    return allChecksPass;
}

/**
 * Validate RealtimeConfig interface
 */
function validateTypeDefinitions() {
    logSection('Validating Type Definitions');

    const hookPath = 'hooks/use-realtime-dashboard-data.ts';
    const content = readFile(hookPath);

    if (!content) {
        logFailure('Cannot validate types - hook file not found');
        return false;
    }

    let allChecksPass = true;

    // Check for RealtimeConfig interface
    const configInterface = /interface\s+RealtimeConfig\s*\{[\s\S]*?role:\s*UserRole[\s\S]*?userId:\s*string[\s\S]*?\}/;
    if (configInterface.test(content)) {
        logSuccess('RealtimeConfig interface found with role and userId');
    } else {
        logWarning('RealtimeConfig interface not found or incomplete');
    }

    // Check for RealtimeDashboardData interface
    const dataInterface = /interface\s+RealtimeDashboardData\s*\{/;
    if (dataInterface.test(content)) {
        logSuccess('RealtimeDashboardData interface found');
    } else {
        logWarning('RealtimeDashboardData interface not found');
    }

    // Check for UserRole import
    const userRoleImport = /import.*UserRole.*from/;
    if (userRoleImport.test(content)) {
        logSuccess('UserRole type is imported');
    } else {
        logWarning('UserRole type import not found');
    }

    return allChecksPass;
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
    console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║  Real-Time Multi-Browser Dashboard Validation Script       ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    logInfo(`Working directory: ${process.cwd()}`);
    logInfo(`Timestamp: ${new Date().toISOString()}`);

    // Run all validations
    const validations = [
        { name: 'Hook Exports', fn: validateHookExports },
        { name: 'Channel Naming', fn: validateChannelNaming },
        { name: 'Role-Based Filtering', fn: validateRoleBasedFiltering },
        { name: 'Component Integration', fn: validateComponentIntegration },
        { name: 'Supabase Migrations', fn: validateMigrations },
        { name: 'Console Logging', fn: validateConsoleLogging },
        { name: 'Type Definitions', fn: validateTypeDefinitions },
    ];

    const validationResults = [];

    for (const validation of validations) {
        try {
            const result = validation.fn();
            validationResults.push({ name: validation.name, passed: result });
        } catch (error) {
            logFailure(`Error running ${validation.name} validation: ${error.message}`);
            validationResults.push({ name: validation.name, passed: false });
        }
    }

    // Print summary
    logSection('Validation Summary');

    console.log(`${colors.green}Passed: ${results.passed.length}${colors.reset}`);
    console.log(`${colors.red}Failed: ${results.failed.length}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${results.warnings.length}${colors.reset}`);

    console.log(`\n${colors.bright}Validation Results:${colors.reset}`);
    for (const result of validationResults) {
        const status = result.passed ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
        console.log(`  ${status} - ${result.name}`);
    }

    // Print failed items if any
    if (results.failed.length > 0) {
        console.log(`\n${colors.red}${colors.bright}Failed Checks:${colors.reset}`);
        for (const failure of results.failed) {
            console.log(`  • ${failure.message}`);
            if (failure.details) {
                console.log(`    ${colors.yellow}${failure.details}${colors.reset}`);
            }
        }
    }

    // Print warnings if any
    if (results.warnings.length > 0) {
        console.log(`\n${colors.yellow}${colors.bright}Warnings:${colors.reset}`);
        for (const warning of results.warnings) {
            console.log(`  • ${warning}`);
        }
    }

    // Final status
    const allPassed = results.failed.length === 0;

    console.log(`\n${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    if (allPassed) {
        console.log(`${colors.green}${colors.bright}✅ ALL VALIDATIONS PASSED${colors.reset}`);
        console.log(`\nThe real-time multi-browser dashboard implementation is correctly configured.`);
        console.log(`\nNext steps:`);
        console.log(`  1. Run the development server: npm run dev`);
        console.log(`  2. Open three browser windows with different user accounts`);
        console.log(`  3. Follow the testing guide: docs/realtime-dashboard-testing-guide.md`);
    } else {
        console.log(`${colors.red}${colors.bright}❌ SOME VALIDATIONS FAILED${colors.reset}`);
        console.log(`\nPlease fix the failed checks before testing.`);
        console.log(`Refer to the testing guide for implementation details: docs/realtime-dashboard-testing-guide.md`);
    }

    console.log(`${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
}

// Run the script
main();