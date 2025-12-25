#!/usr/bin/env node

// ============================================
// Next.js 16 Upgrade Validation Script
// ============================================
// This script validates that the upgrade was successful

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🧪 Starting Next.js 16 upgrade validation...\n');

const tests = [
  {
    name: 'Next.js Version Check',
    test: () => {
      const output = execSync('npm ls next --depth=0', { encoding: 'utf-8' });
      const version = output.match(/next@([0-9.]+)/)?.[1];
      if (version?.startsWith('16.')) {
        console.log(`✅ Next.js version: ${version}`);
        return true;
      }
      throw new Error(`Expected Next.js 16.x.x, got: ${version}`);
    }
  },
  {
    name: 'Build Process Test',
    test: () => {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ Build completed successfully');
      return true;
    }
  },
  {
    name: 'TypeScript Validation',
    test: () => {
      execSync('npx tsc --noEmit', { stdio: 'inherit' });
      console.log('✅ TypeScript validation passed');
      return true;
    }
  },
  {
    name: 'Linting Check',
    test: () => {
      execSync('npm run lint', { stdio: 'inherit' });
      console.log('✅ Linting passed');
      return true;
    }
  },
  {
    name: 'Package Dependencies',
    test: () => {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      if (packageJson.dependencies.next === '16.0.1') {
        console.log('✅ Package.json updated correctly');
        return true;
      }
      throw new Error('package.json not updated to Next.js 16.0.1');
    }
  },
  {
    name: 'Security Headers Validation',
    test: () => {
      const nextConfig = fs.readFileSync('next.config.ts', 'utf-8');
      const requiredHeaders = [
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'X-XSS-Protection',
        'Permissions-Policy',
        'Content-Security-Policy',
        'Strict-Transport-Security'
      ];

      for (const header of requiredHeaders) {
        if (!nextConfig.includes(header)) {
          throw new Error(`Missing security header: ${header}`);
        }
      }
      console.log('✅ Security headers configured correctly');
      return true;
    }
  },
  {
    name: 'Experimental Features Validation',
    test: () => {
      const nextConfig = fs.readFileSync('next.config.ts', 'utf-8');
      const requiredFeatures = [
        'optimizePackageImports',
        'serverActions',
        'optimizeCss',
        'scrollRestoration'
      ];

      for (const feature of requiredFeatures) {
        if (!nextConfig.includes(feature)) {
          throw new Error(`Missing experimental feature: ${feature}`);
        }
      }
      console.log('✅ Experimental features configured correctly');
      return true;
    }
  },
  {
    name: 'Bundle Optimization Validation',
    test: () => {
      const nextConfig = fs.readFileSync('next.config.ts', 'utf-8');
      const optimizations = [
        'radix-ui',
        'backend-services',
        'utilities',
        'forms'
      ];

      for (const opt of optimizations) {
        if (!nextConfig.includes(opt)) {
          throw new Error(`Missing bundle optimization: ${opt}`);
        }
      }
      console.log('✅ Bundle optimizations configured correctly');
      return true;
    }
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    console.log(`\n🔍 Running: ${test.name}`);
    test.test();
    passed++;
  } catch (error) {
    console.log(`❌ ${test.name} failed: ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All validation tests passed! Next.js 16 upgrade is successful.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some validation tests failed. Please review the errors above.');
  process.exit(1);
}