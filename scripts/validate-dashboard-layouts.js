#!/usr/bin/env node

/**
 * Dashboard Layout Validation Script
 * 
 * This script scans for potential duplicate DashboardLayout usage
 * in dashboard pages to ensure the fix is complete.
 */

import { promises as fs } from 'fs';
import { join, relative } from 'path';

const DASHBOARD_PATH = 'app/(dashboard)';
const VALID_LAYOUT_FILE = 'app/(dashboard)/admin/layout.tsx';

async function findDashboardFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative('.', fullPath);
    
    if (entry.isDirectory()) {
      files.push(...await findDashboardFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(relativePath);
    }
  }
  
  return files;
}

async function checkFileForDashboardLayout(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];
  
  // Check for DashboardLayout import
  const hasDashboardLayoutImport = content.includes('import') && 
    content.includes('DashboardLayout') && 
    content.match(/import.*DashboardLayout.*from/);
  
  if (!hasDashboardLayoutImport) {
    return null; // No DashboardLayout usage, skip
  }
  
  // Check if file contains DashboardLayout JSX usage
  const dashboardLayoutMatches = lines
    .map((line, index) => ({ line: index + 1, content: line.trim() }))
    .filter(({ content }) => content.includes('<DashboardLayout'));
  
  if (dashboardLayoutMatches.length > 0) {
    return {
      file: filePath,
      hasDashboardLayout: true,
      dashboardLayoutUsage: dashboardLayoutMatches,
      issues: []
    };
  }
  
  return {
    file: filePath,
    hasDashboardLayout: true,
    dashboardLayoutUsage: [],
    issues: []
  };
}

async function validateDashboardLayouts() {
  console.log('🔍 Scanning for DashboardLayout usage...\n');
  
  try {
    const dashboardFiles = await findDashboardFiles(DASHBOARD_PATH);
    const results = [];
    
    for (const file of dashboardFiles) {
      const result = await checkFileForDashboardLayout(file);
      if (result) {
        results.push(result);
      }
    }
    
    console.log(`📁 Found ${results.length} files with DashboardLayout\n`);
    
    // Analyze results
    const validLayoutFiles = results.filter(r => r.file.endsWith('/layout.tsx'));
    const pageFiles = results.filter(r => r.file.endsWith('/page.tsx'));
    const componentFiles = results.filter(r => 
      !r.file.endsWith('/layout.tsx') && !r.file.endsWith('/page.tsx')
    );
    
    console.log('📊 Analysis Results:');
    console.log(`   Layout files: ${validLayoutFiles.length}`);
    console.log(`   Page files: ${pageFiles.length}`);
    console.log(`   Component files: ${componentFiles.length}\n`);
    
    // Check for issues
    const issues = [];
    
    // Check 1: Layout files should have DashboardLayout
    for (const layout of validLayoutFiles) {
      if (layout.dashboardLayoutUsage.length === 0) {
        issues.push({
          type: 'missing-layout',
          file: layout.file,
          message: 'Layout file should use DashboardLayout',
          severity: 'error'
        });
      }
    }
    
    // Check 2: Page files should NOT have DashboardLayout
    for (const page of pageFiles) {
      if (page.dashboardLayoutUsage.length > 0) {
        issues.push({
          type: 'duplicate-layout',
          file: page.file,
          message: 'Page file should NOT use DashboardLayout (duplicate)',
          severity: 'error',
          lines: page.dashboardLayoutUsage
        });
      }
    }
    
    // Check 3: Component files should NOT have DashboardLayout
    for (const component of componentFiles) {
      if (component.dashboardLayoutUsage.length > 0) {
        issues.push({
          type: 'duplicate-layout',
          file: component.file,
          message: 'Component file should NOT use DashboardLayout (duplicate)',
          severity: 'error',
          lines: component.dashboardLayoutUsage
        });
      }
    }
    
    // Report results
    console.log('✅ Validation Results:\n');
    
    if (issues.length === 0) {
      console.log('🎉 SUCCESS: No duplicate DashboardLayout issues found!');
      console.log('✅ DashboardLayout is properly used only in layout files');
      console.log('✅ All page components are clean');
      console.log('✅ Fix appears to be complete\n');
      
      // List valid layout files
      if (validLayoutFiles.length > 0) {
        console.log('📍 Valid Layout Files:');
        for (const layout of validLayoutFiles) {
          console.log(`   ✅ ${layout.file}`);
        }
        console.log();
      }
      
    } else {
      console.log(`❌ Found ${issues.length} issue(s):\n`);
      
      for (const issue of issues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`${icon} ${issue.message}`);
        console.log(`   📁 ${issue.file}`);
        
        if (issue.lines) {
          console.log(`   📍 Lines: ${issue.lines.map(l => l.line).join(', ')}`);
        }
        
        console.log();
      }
      
      console.log('🔧 Required Actions:');
      for (const issue of issues) {
        if (issue.type === 'duplicate-layout') {
          console.log(`   1. Remove DashboardLayout wrapper from: ${issue.file}`);
          console.log(`   2. Keep only the page content inside a div with className="p-6"`);
        }
      }
    }
    
    // Detailed file listing
    console.log('\n📋 Complete File Listing:');
    for (const result of results) {
      const hasUsage = result.dashboardLayoutUsage.length > 0;
      const status = hasUsage ? '❌' : '✅';
      const type = result.file.endsWith('/layout.tsx') ? 'Layout' : 
                   result.file.endsWith('/page.tsx') ? 'Page' : 'Component';
      
      console.log(`   ${status} ${type.padEnd(8)} ${result.file}`);
      
      if (hasUsage && result.dashboardLayoutUsage.length > 0) {
        console.log(`      📍 DashboardLayout usage on lines: ${result.dashboardLayoutUsage.map(l => l.line).join(', ')}`);
      }
    }
    
    return {
      success: issues.length === 0,
      totalFiles: results.length,
      issues,
      results
    };
    
  } catch (error) {
    console.error('❌ Error during validation:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDashboardLayouts().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

export { validateDashboardLayouts };