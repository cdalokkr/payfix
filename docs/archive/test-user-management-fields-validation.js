#!/usr/bin/env node

/**
 * Comprehensive Test: Sex and Date of Birth Fields Display Validation
 * 
 * This script validates that the UserManagement component properly displays
 * sex and date of birth fields after the migration and component updates.
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const PROJECT_ROOT = 'd:/saaskit-sone4.5/my-fullstack-app';
const USER_MANAGEMENT_FILE = path.join(PROJECT_ROOT, 'components/dashboard/user-management.tsx');
const MIGRATION_FILE = path.join(PROJECT_ROOT, 'supabase/migrations/20251117134923_add_sex_column_to_profiles.sql');
const TYPES_FILE = path.join(PROJECT_ROOT, 'types/index.ts');

// Test results
const testResults = {
  tests: [],
  passed: 0,
  failed: 0,
  warnings: 0
};

/**
 * Add a test result
 */
function addTestResult(testName, status, message, details = null) {
  const result = {
    name: testName,
    status, // 'PASS', 'FAIL', 'WARN'
    message,
    details
  };
  
  testResults.tests.push(result);
  
  // Fix the counter increment logic
  if (status === 'PASS') {
    testResults.passed++;
  } else if (status === 'FAIL') {
    testResults.failed++;
  } else if (status === 'WARN') {
    testResults.warnings++;
  }
  
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${testName}: ${message}`);
  
  if (details) {
    console.log(`   Details: ${details}`);
  }
}

/**
 * Test 1: Verify migration file exists and has correct content
 */
function testMigrationFile() {
  console.log('\n🔍 Testing Migration File...');
  
  if (!fs.existsSync(MIGRATION_FILE)) {
    addTestResult(
      'Migration File Existence',
      'FAIL',
      'Migration file does not exist',
      `Expected location: ${MIGRATION_FILE}`
    );
    return;
  }
  
  addTestResult(
    'Migration File Existence',
    'PASS',
    'Migration file exists'
  );
  
  const migrationContent = fs.readFileSync(MIGRATION_FILE, 'utf8');
  
  // Check for sex column addition
  if (migrationContent.includes('ADD COLUMN sex')) {
    addTestResult(
      'Migration File Content - Sex Column',
      'PASS',
      'Sex column migration included'
    );
  } else {
    addTestResult(
      'Migration File Content - Sex Column',
      'FAIL',
      'Sex column migration not found',
      migrationContent
    );
  }
  
  // Check for constraint
  if (migrationContent.includes('CHECK (sex IN')) {
    addTestResult(
      'Migration File Content - Sex Constraint',
      'PASS',
      'Sex column constraint included'
    );
  } else {
    addTestResult(
      'Migration File Content - Sex Constraint',
      'WARN',
      'Sex column constraint not found',
      'This might be acceptable depending on requirements'
    );
  }
}

/**
 * Test 2: Verify TypeScript types include new fields
 */
function testTypeScriptTypes() {
  console.log('\n🔍 Testing TypeScript Types...');
  
  if (!fs.existsSync(TYPES_FILE)) {
    addTestResult(
      'Types File Existence',
      'FAIL',
      'Types file does not exist',
      `Expected location: ${TYPES_FILE}`
    );
    return;
  }
  
  addTestResult(
    'Types File Existence',
    'PASS',
    'Types file exists'
  );
  
  const typesContent = fs.readFileSync(TYPES_FILE, 'utf8');
  
  // Check for date_of_birth field
  if (typesContent.includes('date_of_birth')) {
    addTestResult(
      'TypeScript Types - Date of Birth',
      'PASS',
      'date_of_birth field included in Profile type'
    );
  } else {
    addTestResult(
      'TypeScript Types - Date of Birth',
      'FAIL',
      'date_of_birth field not found in Profile type'
    );
  }
  
  // Check for sex field
  if (typesContent.includes('sex')) {
    addTestResult(
      'TypeScript Types - Sex Field',
      'PASS',
      'sex field included in Profile type'
    );
  } else {
    addTestResult(
      'TypeScript Types - Sex Field',
      'FAIL',
      'sex field not found in Profile type'
    );
  }
}

/**
 * Test 3: Verify UserManagement component includes new columns
 */
function testUserManagementComponent() {
  console.log('\n🔍 Testing UserManagement Component...');
  
  if (!fs.existsSync(USER_MANAGEMENT_FILE)) {
    addTestResult(
      'UserManagement Component Existence',
      'FAIL',
      'UserManagement component does not exist',
      `Expected location: ${USER_MANAGEMENT_FILE}`
    );
    return;
  }
  
  addTestResult(
    'UserManagement Component Existence',
    'PASS',
    'UserManagement component exists'
  );
  
  const componentContent = fs.readFileSync(USER_MANAGEMENT_FILE, 'utf8');
  
  // Check for table header columns
  const tableHeaderMatch = componentContent.match(/<TableHead>.*?<\/TableHead>/gs);
  if (tableHeaderMatch) {
    const headers = tableHeaderMatch.join(' ');
    
    if (headers.includes('Sex')) {
      addTestResult(
        'UserManagement Table Header - Sex Column',
        'PASS',
        'Sex column header found in table'
      );
    } else {
      addTestResult(
        'UserManagement Table Header - Sex Column',
        'FAIL',
        'Sex column header not found in table'
      );
    }
    
    if (headers.includes('Date of Birth')) {
      addTestResult(
        'UserManagement Table Header - Date of Birth Column',
        'PASS',
        'Date of Birth column header found in table'
      );
    } else {
      addTestResult(
        'UserManagement Table Header - Date of Birth Column',
        'FAIL',
        'Date of Birth column header not found in table'
      );
    }
  } else {
    addTestResult(
      'UserManagement Table Headers',
      'FAIL',
      'Table headers not found in component'
    );
  }
  
  // Check for table row data rendering
  if (componentContent.includes('user.sex')) {
    addTestResult(
      'UserManagement Data Display - Sex Field',
      'PASS',
      'Sex field rendering found in component'
    );
  } else {
    addTestResult(
      'UserManagement Data Display - Sex Field',
      'FAIL',
      'Sex field rendering not found in component'
    );
  }
  
  if (componentContent.includes('user.date_of_birth')) {
    addTestResult(
      'UserManagement Data Display - Date of Birth Field',
      'PASS',
      'Date of birth field rendering found in component'
    );
  } else {
    addTestResult(
      'UserManagement Data Display - Date of Birth Field',
      'FAIL',
      'Date of birth field rendering not found in component'
    );
  }
  
  // Check for proper date formatting
  if (componentContent.includes('toLocaleDateString')) {
    addTestResult(
      'UserManagement Date Formatting',
      'PASS',
      'Date formatting using toLocaleDateString found'
    );
  } else {
    addTestResult(
      'UserManagement Date Formatting',
      'WARN',
      'Date formatting might not be optimal',
      'Consider using toLocaleDateString for consistent date display'
    );
  }
  
  // Check for search functionality including new fields
  if (componentContent.includes('user.sex?.toLowerCase().includes(searchLower)')) {
    addTestResult(
      'UserManagement Search - Sex Field',
      'PASS',
      'Search functionality includes sex field'
    );
  } else {
    addTestResult(
      'UserManagement Search - Sex Field',
      'WARN',
      'Search functionality does not include sex field'
    );
  }
  
  if (componentContent.includes('user.date_of_birth?.toLowerCase().includes(searchLower)')) {
    addTestResult(
      'UserManagement Search - Date of Birth Field',
      'PASS',
      'Search functionality includes date_of_birth field'
    );
  } else {
    addTestResult(
      'UserManagement Search - Date of Birth Field',
      'WARN',
      'Search functionality does not include date_of_birth field'
    );
  }
  
  // Check for proper colSpan in empty state
  const colSpanMatch = componentContent.match(/colSpan=\{(\d+)\}/);
  if (colSpanMatch) {
    const colSpan = parseInt(colSpanMatch[1]);
    if (colSpan >= 6) {
      addTestResult(
        'UserManagement Table Structure',
        'PASS',
        `Proper colSpan (${colSpan}) for 6-column table`
      );
    } else {
      addTestResult(
        'UserManagement Table Structure',
        'FAIL',
        `Incorrect colSpan (${colSpan}) for expanded table`,
        'Should be at least 6 for Email, Full Name, Sex, Date of Birth, Role, Actions'
      );
    }
  }
}

/**
 * Test 4: Verify component has proper error handling
 */
function testErrorHandling() {
  console.log('\n🔍 Testing Error Handling...');
  
  const componentContent = fs.readFileSync(USER_MANAGEMENT_FILE, 'utf8');
  
  // Check for null/undefined handling for sex field
  if (componentContent.includes('user.sex ||') || componentContent.includes('user.sex ??')) {
    addTestResult(
      'Error Handling - Sex Field',
      'PASS',
      'Proper null/undefined handling for sex field'
    );
  } else {
    addTestResult(
      'Error Handling - Sex Field',
      'WARN',
      'No explicit null handling for sex field',
      'Consider using user.sex || \'-\' for consistent display'
    );
  }
  
  // Check for null/undefined handling for date_of_birth field
  if (componentContent.includes('user.date_of_birth ?')) {
    addTestResult(
      'Error Handling - Date of Birth Field',
      'PASS',
      'Proper null/undefined handling for date_of_birth field'
    );
  } else {
    addTestResult(
      'Error Handling - Date of Birth Field',
      'WARN',
      'No explicit null handling for date_of_birth field',
      'Consider using conditional rendering for dates'
    );
  }
}

/**
 * Test 5: Integration with ModernAddUserForm
 */
function testModernAddUserFormIntegration() {
  console.log('\n🔍 Testing ModernAddUserForm Integration...');
  
  const modernAddUserFormPath = path.join(PROJECT_ROOT, 'components/dashboard/ModernAddUserForm.tsx');
  
  if (!fs.existsSync(modernAddUserFormPath)) {
    addTestResult(
      'ModernAddUserForm Existence',
      'WARN',
      'ModernAddUserForm file not found',
      `Expected location: ${modernAddUserFormPath}`
    );
    return;
  }
  
  addTestResult(
    'ModernAddUserForm Existence',
    'PASS',
    'ModernAddUserForm exists'
  );
  
  const formContent = fs.readFileSync(modernAddUserFormPath, 'utf8');
  
  // Check for sex field integration
  if (formContent.includes('sex') && formContent.includes('editingUser?.sex')) {
    addTestResult(
      'ModernAddUserForm - Sex Field Integration',
      'PASS',
      'Sex field properly integrated in ModernAddUserForm'
    );
  } else {
    addTestResult(
      'ModernAddUserForm - Sex Field Integration',
      'FAIL',
      'Sex field not properly integrated in ModernAddUserForm'
    );
  }
  
  // Check for date_of_birth field integration
  if (formContent.includes('date_of_birth') && formContent.includes('editingUser?.date_of_birth')) {
    addTestResult(
      'ModernAddUserForm - Date of Birth Integration',
      'PASS',
      'Date of birth field properly integrated in ModernAddUserForm'
    );
  } else {
    addTestResult(
      'ModernAddUserForm - Date of Birth Integration',
      'FAIL',
      'Date of birth field not properly integrated in ModernAddUserForm'
    );
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  console.log('\n📊 GENERATING TEST REPORT...');
  
  const report = {
    summary: {
      totalTests: testResults.tests.length,
      passed: testResults.passed,
      failed: testResults.failed,
      warnings: testResults.warnings,
      successRate: ((testResults.passed / testResults.tests.length) * 100).toFixed(1) + '%'
    },
    timestamp: new Date().toISOString(),
    tests: testResults.tests,
    recommendations: []
  };
  
  // Add recommendations based on failed tests
  const failedTests = testResults.tests.filter(test => test.status === 'FAIL');
  const warningTests = testResults.tests.filter(test => test.status === 'WARN');
  
  if (failedTests.length > 0) {
    report.recommendations.push('Address all failed tests before production deployment');
  }
  
  if (warningTests.length > 0) {
    report.recommendations.push('Review warning tests for potential improvements');
  }
  
  if (testResults.failed === 0) {
    report.recommendations.push('All critical tests passed - implementation is ready for production');
  }
  
  // Write report to file
  const reportPath = path.join(PROJECT_ROOT, 'user-management-fields-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Test report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Main test execution
 */
function main() {
  console.log('🚀 Starting Comprehensive UserManagement Fields Validation Test');
  console.log('=' .repeat(60));
  
  try {
    testMigrationFile();
    testTypeScriptTypes();
    testUserManagementComponent();
    testErrorHandling();
    testModernAddUserFormIntegration();
    
    const report = generateTestReport();
    
    console.log('\n' + '=' .repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    // Exit with appropriate code
    process.exit(report.summary.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Execute tests if run directly
if (require.main === module) {
  main();
}

module.exports = { main, addTestResult, testResults };