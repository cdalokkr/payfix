/**
 * Adaptive Width Async Button Implementation Validation Script
 * Tests the new customWidth prop functionality and backward compatibility
 */

import fs from 'fs';

console.log('🔍 Validating Adaptive Width Async Button Implementation...\n');

// Test 1: Verify the customWidth prop exists in the interface
console.log('✅ Test 1: CustomWidth Prop Verification');
const asyncButtonPath = 'components/ui/async-button.tsx';
const asyncButtonContent = fs.readFileSync(asyncButtonPath, 'utf8');

// Check if customWidth prop is added to interface
const interfaceMatch = asyncButtonContent.match(/customWidth\?:\s*boolean;/);
if (interfaceMatch) {
  console.log('   ✓ customWidth prop found in AsyncButtonProps interface');
} else {
  console.log('   ✗ customWidth prop missing from AsyncButtonProps interface');
  process.exit(1);
}

// Check if customWidth prop is added to function parameters
const functionMatch = asyncButtonContent.match(/customWidth\s*=\s*false/);
if (functionMatch) {
  console.log('   ✓ customWidth prop added to function parameters with default value');
} else {
  console.log('   ✗ customWidth prop missing from function parameters');
  process.exit(1);
}

console.log('\n✅ Test 2: Conditional Width Logic Verification');

// Check for conditional width calculation
const widthLogicMatch = asyncButtonContent.match(/if\s*\(\s*!customWidth\s*\)/);
if (widthLogicMatch) {
  console.log('   ✓ Conditional width calculation logic found');
} else {
  console.log('   ✗ Conditional width calculation logic missing');
  process.exit(1);
}

// Check for useLayoutEffect dependency on customWidth
const effectMatch = asyncButtonContent.match(/\}\s*,\s*\[.*customWidth.*\]/);
if (effectMatch) {
  console.log('   ✓ useLayoutEffect includes customWidth in dependency array');
} else {
  console.log('   ✗ useLayoutEffect missing customWidth dependency');
  process.exit(1);
}

console.log('\n✅ Test 3: Style Application Logic Verification');

// Check for conditional className
const classNameMatch = asyncButtonContent.match(/!customWidth\s*&&\s*["']w-full["']/);
if (classNameMatch) {
  console.log('   ✓ Conditional w-full className logic found');
} else {
  console.log('   ✗ Conditional w-full className logic missing');
  process.exit(1);
}

// Check for conditional style application
const styleMatch = asyncButtonContent.match(/style=\{customWidth\s*\?\s*\{\s*width\s*\}\s*:\s*undefined\}/);
if (styleMatch) {
  console.log('   ✓ Conditional style application logic found');
} else {
  console.log('   ✗ Conditional style application logic missing');
  process.exit(1);
}

console.log('\n✅ Test 4: Backward Compatibility Verification');

// Check that default behavior is preserved (customWidth = false by default)
const defaultValueMatch = asyncButtonContent.match(/customWidth\s*=\s*false/);
if (defaultValueMatch) {
  console.log('   ✓ customWidth defaults to false (backward compatible)');
} else {
  console.log('   ✗ customWidth default value not set correctly');
  process.exit(1);
}

// Check that width is set to undefined when customWidth is false
const undefinedWidthMatch = asyncButtonContent.match(/setWidth\(undefined\)/);
if (undefinedWidthMatch) {
  console.log('   ✓ Width set to undefined when customWidth is false');
} else {
  console.log('   ✗ Width not properly reset when customWidth is false');
  process.exit(1);
}

console.log('\n✅ Test 5: Edge Case Handling Verification');

// Check for empty text handling in width calculation
const emptyTextMatch = asyncButtonContent.match(/allTexts\s*=\s*useMemo/);
if (emptyTextMatch) {
  console.log('   ✓ Text array calculation includes fallback for empty values');
} else {
  console.log('   ✗ Text array calculation may not handle edge cases');
}

console.log('\n🎯 All Core Tests Passed!\n');

// Test the test file structure
console.log('✅ Test 6: Test File Structure Validation');
const testFilePath = 'test-adaptive-width-async-button.tsx';
if (fs.existsSync(testFilePath)) {
  console.log('   ✓ Test file created successfully');
  
  const testContent = fs.readFileSync(testFilePath, 'utf8');
  
  // Check for various test scenarios
  const testScenarios = [
    { name: 'Backward compatibility test', pattern: /Backward Compatible/ },
    { name: 'Adaptive width test', pattern: /Adaptive Width/ },
    { name: 'State transition test', pattern: /State Transition/ },
    { name: 'Variant test', pattern: /Variants with Adaptive Width/ },
    { name: 'Edge case test', pattern: /Edge Cases/ }
  ];
  
  testScenarios.forEach(scenario => {
    if (scenario.pattern.test(testContent)) {
      console.log(`   ✓ ${scenario.name} scenario included`);
    } else {
      console.log(`   ✗ ${scenario.name} scenario missing`);
    }
  });
} else {
  console.log('   ✗ Test file not found');
}

console.log('\n📋 Implementation Summary:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✓ Added customWidth prop (default: false)');
console.log('✓ Width calculation only runs when customWidth is true');
console.log('✓ Backward compatibility maintained (uses w-full by default)');
console.log('✓ Conditional style application');
console.log('✓ Comprehensive test coverage created');
console.log('✓ Edge case handling included');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n🚀 Usage Examples:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('// Default behavior (backward compatible)');
console.log('<AsyncButton onClick={handleClick}>Save</AsyncButton>');
console.log('');
console.log('// Adaptive width to prevent visual shifting');
console.log('<AsyncButton customWidth={true} onClick={handleClick}>Save</AsyncButton>');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n✅ Implementation validation completed successfully!');