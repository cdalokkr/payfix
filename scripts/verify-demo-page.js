#!/usr/bin/env node

/**
 * Demo Page Verification Script
 * Verifies that the new login form demo page is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying New Login Form Demo Page Setup...\n');

// Check if demo page exists
const demoPagePath = path.join(__dirname, '../app/demo-new-login/page.tsx');
if (fs.existsSync(demoPagePath)) {
  console.log('✅ Demo page created at app/demo-new-login/page.tsx');
} else {
  console.log('❌ Demo page not found');
  process.exit(1);
}

// Check if setup instructions exist
const setupInstructionsPath = path.join(__dirname, '../docs/demo-new-login-setup.md');
if (fs.existsSync(setupInstructionsPath)) {
  console.log('✅ Setup instructions created at docs/demo-new-login-setup.md');
} else {
  console.log('❌ Setup instructions not found');
  process.exit(1);
}

// Check key components exist
const components = [
  '../components/auth/new-login-form.tsx',
  '../components/ui/card.tsx',
  '../components/ui/button.tsx',
  '../components/ui/badge.tsx',
  '../components/ui/tabs.tsx',
  '../components/ui/alert.tsx',
  '../components/ui/separator.tsx'
];

let allComponentsExist = true;
components.forEach(component => {
  const componentPath = path.join(__dirname, component);
  if (fs.existsSync(componentPath)) {
    console.log(`✅ Component available: ${component}`);
  } else {
    console.log(`❌ Component missing: ${component}`);
    allComponentsExist = false;
  }
});

// Check package.json for required dependencies
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = [
    'react-hook-form',
    '@hookform/resolvers', 
    'zod',
    '@radix-ui/react-dialog',
    '@radix-ui/react-label',
    'lucide-react',
    'react-hot-toast'
  ];

  console.log('\n📦 Required Dependencies:');
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep}: Not found`);
    }
  });
}

if (allComponentsExist) {
  console.log('\n🎉 Demo Page Setup Complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Navigate to: http://localhost:3000/demo-new-login');
  console.log('3. Test the login form functionality');
  console.log('4. Review setup instructions in docs/demo-new-login-setup.md');
} else {
  console.log('\n⚠️  Some components are missing. Please check the setup.');
  process.exit(1);
}