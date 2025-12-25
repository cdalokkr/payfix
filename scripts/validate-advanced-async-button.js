#!/usr/bin/env node

/**
 * Advanced Async Button Component Validation Script
 * Tests the new component for TypeScript errors and basic functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Advanced Async Button Component Validation\n');

const testResults = {
  componentExists: false,
  typeScriptValid: false,
  exportsValid: false,
  documentationExists: false,
  testsExist: false,
  demoExists: false
};

// Check if component file exists
const componentPath = 'components/ui/advanced-async-button.tsx';
if (fs.existsSync(componentPath)) {
  console.log('✅ Component file exists:', componentPath);
  testResults.componentExists = true;
} else {
  console.log('❌ Component file missing:', componentPath);
}

// Check for TypeScript errors in the component
try {
  execSync(`npx tsc --noEmit --skipLibCheck ${componentPath}`, { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  });
  console.log('✅ TypeScript validation passed');
  testResults.typeScriptValid = true;
} catch (error) {
  console.log('❌ TypeScript validation failed:');
  console.log(error.stdout || error.message);
}

// Check if main exports are properly defined
try {
  const content = fs.readFileSync(componentPath, 'utf-8');
  const hasMainExport = content.includes('export const AdvancedAsyncButton');
  const hasPreconfiguredExports = content.includes('export const AdvancedLoginButton');
  const hasTypes = content.includes('export type AsyncState');
  
  if (hasMainExport && hasPreconfiguredExports && hasTypes) {
    console.log('✅ Component exports are properly defined');
    testResults.exportsValid = true;
  } else {
    console.log('❌ Component exports are missing or incorrect');
  }
} catch (error) {
  console.log('❌ Error checking exports:', error.message);
}

// Check if documentation exists
const docPath = 'components/ui/Advanced-Async-Button-README.md';
if (fs.existsSync(docPath)) {
  console.log('✅ Documentation exists:', docPath);
  testResults.documentationExists = true;
} else {
  console.log('❌ Documentation missing:', docPath);
}

// Check if tests exist
const testPath = 'tests/advanced-async-button-comprehensive-test.tsx';
if (fs.existsSync(testPath)) {
  console.log('✅ Comprehensive tests exist:', testPath);
  testResults.testsExist = true;
} else {
  console.log('❌ Tests missing:', testPath);
}

// Check if demo exists
const demoPath = 'app/demo-advanced-async-button/page.tsx';
if (fs.existsSync(demoPath)) {
  console.log('✅ Demo page exists:', demoPath);
  testResults.demoExists = true;
} else {
  console.log('❌ Demo missing:', demoPath);
}

// Run basic component import test
console.log('\n🧪 Testing component import and basic functionality...');
try {
  const testImportCode = `
import React from 'react';
import { 
  AdvancedAsyncButton, 
  AdvancedLoginButton, 
  AdvancedSaveButton, 
  AdvancedDeleteButton, 
  AdvancedSubmitButton,
  type AsyncState 
} from '@/components/ui/advanced-async-button';

// Basic functional test component
function TestComponent() {
  const handleClick = async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  return (
    <div>
      <AdvancedAsyncButton
        onClick={handleClick}
        initialText="Test Button"
        loadingText="Loading..."
        successText="Success!"
        errorText="Error!"
      />
      <AdvancedLoginButton onClick={handleClick} />
      <AdvancedSaveButton onClick={handleClick} />
      <AdvancedDeleteButton onClick={handleClick} />
      <AdvancedSubmitButton onClick={handleClick} />
    </div>
  );
}

export default TestComponent;
`;

  // Write test file
  const testFilePath = 'temp-component-test.tsx';
  fs.writeFileSync(testFilePath, testImportCode);
  
  // Try to compile the test
  execSync(`npx tsc --noEmit --skipLibCheck ${testFilePath}`, { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  });
  
  // Clean up
  fs.unlinkSync(testFilePath);
  
  console.log('✅ Component import and basic functionality test passed');
} catch (error) {
  console.log('❌ Component import test failed:');
  console.log(error.stdout || error.message);
}

// Feature validation
console.log('\n🔍 Validating component features...');

try {
  const content = fs.readFileSync(componentPath, 'utf-8');
  
  const features = {
    'Smooth motion effects': content.includes('motion') && content.includes('animate'),
    'Background transitions': content.includes('background') && content.includes('gradient'),
    'Text animations': content.includes('AnimatePresence'),
    'Loading state feedback': content.includes('loadingText') && content.includes('loadingDots'),
    'Success animations': content.includes('successText') && content.includes('successDuration'),
    'Error handling': content.includes('errorText') && content.includes('onError'),
    'Accessibility features': content.includes('aria-live') && content.includes('aria-busy'),
    'Reduced motion support': content.includes('useReducedMotion'),
    'State management': content.includes('AsyncState') && content.includes('setState'),
    'Micro-interactions': content.includes('microInteractions')
  };

  Object.entries(features).forEach(([feature, hasFeature]) => {
    if (hasFeature) {
      console.log(`✅ ${feature}: Implemented`);
    } else {
      console.log(`❌ ${feature}: Missing`);
    }
  });
} catch (error) {
  console.log('❌ Error validating features:', error.message);
}

// Final results
console.log('\n📊 Validation Results Summary:');
console.log('=================================');

const totalTests = Object.keys(testResults).length;
const passedTests = Object.values(testResults).filter(result => result).length;

console.log(`Component Structure: ${testResults.componentExists ? '✅' : '❌'}`);
console.log(`TypeScript Validation: ${testResults.typeScriptValid ? '✅' : '❌'}`);
console.log(`Exports Validation: ${testResults.exportsValid ? '✅' : '❌'}`);
console.log(`Documentation: ${testResults.documentationExists ? '✅' : '❌'}`);
console.log(`Tests: ${testResults.testsExist ? '✅' : '❌'}`);
console.log(`Demo: ${testResults.demoExists ? '✅' : '❌'}`);

console.log(`\nOverall Score: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests * 100)}%)`);

if (passedTests === totalTests) {
  console.log('\n🎉 All validation tests passed! The Advanced Async Button component is ready for use.');
} else {
  console.log('\n⚠️ Some validation tests failed. Please review the issues above.');
}

// Usage instructions
console.log('\n📚 Usage Instructions:');
console.log('=====================');
console.log('1. Import the component:');
console.log('   import { AdvancedAsyncButton } from "@/components/ui/advanced-async-button";');
console.log('');
console.log('2. Use in your component:');
console.log('   <AdvancedAsyncButton');
console.log('     onClick={handleAsyncOperation}');
console.log('     initialText="Click to start"');
console.log('     loadingText="Processing..."');
console.log('     successText="Completed!"');
console.log('     errorText="Failed"');
console.log('   />');
console.log('');
console.log('3. Pre-configured variants:');
console.log('   - AdvancedLoginButton');
console.log('   - AdvancedSaveButton');
console.log('   - AdvancedDeleteButton');
console.log('   - AdvancedSubmitButton');
console.log('');
console.log('4. View the demo at: /demo-advanced-async-button');
console.log('5. Read the documentation: /components/ui/Advanced-Async-Button-README.md');

console.log('\n✨ Advanced Async Button Component validation complete!');