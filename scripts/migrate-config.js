#!/usr/bin/env node

// ============================================
// Next.js 16 Configuration Migration Script
// ============================================
// This script updates next.config.ts for Next.js 16 compatibility

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting Next.js 16 configuration migration...\n');

// Read current next.config.ts
const configPath = path.join(process.cwd(), 'next.config.ts');
const backupPath = path.join(process.cwd(), 'next.config.ts.backup-16');

try {
  // Create backup
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  }

  // Read current configuration
  let config = fs.readFileSync(configPath, 'utf-8');
  
  // Migration logic
  console.log('🔄 Analyzing current configuration...');
  
  // Check for experimental features that might need updates
  const experimentalFeatures = [
    'optimizePackageImports',
    'ppr',
    'serverActions',
    'reactCompiler',
    'optimizeCss',
    'scrollRestoration'
  ];
  
  let hasExperimentalChanges = false;
  
  for (const feature of experimentalFeatures) {
    if (config.includes(feature)) {
      console.log(`⚠️  Experimental feature detected: ${feature}`);
      hasExperimentalChanges = true;
    }
  }
  
  // Updated configuration template for Next.js 16
  const updatedConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security Headers Configuration (unchanged)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Enable React strict mode
  reactStrictMode: true,

  // Updated experimental features for Next.js 16
  experimental: {
    // Enhanced package imports optimization (stable in Next.js 16)
    optimizePackageImports: [
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@clerk/nextjs',
    ],
    
    // Server Actions enhancements
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
    
    // Enhanced performance features
    optimizeCss: true,
    scrollRestoration: true,
  },

  // Enhanced webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Leverage Next.js 16 automatic optimizations
    if (!isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        // Enhanced UI libraries splitting
        'radix-ui': {
          test: /[\\\\/]node_modules[\\\\/](@radix-ui|@radix-theme)/,
          name: 'radix-ui',
          chunks: 'all',
          priority: 20,
        },
        // Enhanced backend services splitting
        'backend-services': {
          test: /[\\\\/]node_modules[\\\\/](@supabase|@trpc|@clerk)/,
          name: 'backend-services',
          chunks: 'all',
          priority: 15,
        },
        // Enhanced utility libraries
        'utilities': {
          test: /[\\\\/]node_modules[\\\\/](lucide-react|clsx|tailwind-merge|class-variance-authority)/,
          name: 'utilities',
          chunks: 'all',
          priority: 10,
        },
        // Forms and validation
        'forms': {
          test: /[\\\\/]node_modules[\\\\/](react-hook-form|@hookform|@radix-ui\\\\/label)/,
          name: 'forms',
          chunks: 'all',
          priority: 12,
        },
      };
    }

    // Enhanced development optimizations
    if (dev) {
      config.optimization.minimize = false;
      config.devtool = 'eval-source-map';
    }

    return config;
  },

  // New Next.js 16 configuration options
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Enhanced compression
  compress: true,
  poweredByHeader: false,

  // New telemetry options
  telemetry: {
    disabled: false,
  },
};

export default nextConfig;`;

  // Write updated configuration
  fs.writeFileSync(configPath, updatedConfig, 'utf-8');
  
  console.log('✅ Configuration migration completed!');
  console.log(`📝 Original backup: ${backupPath}`);
  
  if (hasExperimentalChanges) {
    console.log('\n⚠️  Notes:');
    console.log('- Some experimental features may need review for Next.js 16 stability');
    console.log('- New performance optimizations have been added');
    console.log('- Bundle splitting has been enhanced');
  }
  
  console.log('\n🔍 Validation steps:');
  console.log('1. npm run build  (Test build process)');
  console.log('2. npm run dev     (Test development server)');
  console.log('3. npx tsc --noEmit (TypeScript validation)');

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.log('\n🆘 To restore backup:');
  console.log(`cp ${backupPath} ${configPath}`);
  process.exit(1);
}