import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The disposable browser proof runs against the local dev origin directly.
  // Allow its loopback host so Next.js serves client chunks instead of
  // rendering the login form as a non-interactive HTML fallback.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // Security Headers Configuration
  async headers() {
    // Determine if we're in production for stricter CSP
    const isDev = process.env.NODE_ENV === 'development';

    // Build CSP directives - stricter in production
    const cspDirectives = [
      "default-src 'self'",
      // 'unsafe-eval' is required by TensorFlow.js and WebGL/WASM kernel shader compilation for face biometrics
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://*.huggingface.co https://huggingface.co blob:",
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "frame-ancestors 'none'", // Enhanced: Prevents clickjacking
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      !isDev ? "upgrade-insecure-requests" : "", // Force HTTPS only in production
      !isDev ? "block-all-mixed-content" : "", // Block mixed content only in production
    ].filter(Boolean).join('; ');

    return [
      {
        // Cache images for 1 day with stale-while-revalidate fallback
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // tRPC API — short cache with stale-while-revalidate for GET queries
        source: '/api/trpc/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // All other routes — security headers + no-cache for HTML pages
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // XSS Protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Permissions Policy - restrict browser features
          {
            key: 'Permissions-Policy',
            value: [
              'camera=self',
              'microphone=self',
              'geolocation=self',
              'interest-cohort=()', // Disable FLoC
              'accelerometer=()',
              'gyroscope=()',
              'magnetometer=()',
              'payment=()',
              'usb=()',
              'serial=()',
              'midi=()',
              'picture-in-picture=(self)',
              'fullscreen=(self)',
            ].join(', '),
          },
          // DNS Prefetch Control
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
          // HTTP Strict Transport Security (HSTS) - Only in production
          ...(isDev ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }]),
          // Cross-Origin policies for enhanced isolation
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          // Prevent browsers from caching sensitive HTML pages
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },

  // Enable React strict mode for better security
  reactStrictMode: true,

  // Enhanced compression and security
  compress: true,
  poweredByHeader: false,

  // Image optimization configuration for Next.js 16
  images: {
    // Prefer WebP. Keep AVIF disabled until the patched image pipeline is
    // proven in this release line; this avoids the libheif attack surface.
    formats: ['image/webp'],
    // Remote patterns for external images (Supabase Storage, HF Spaces, etc.)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.hf.space',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      }
    ],
    // Optimize image loading
    minimumCacheTTL: 2592000,
  },

  // Server external packages - packages that should not be bundled
  // These are packages that have native dependencies or should run on server only
  serverExternalPackages: [
    'jose', // JWT library with native crypto
    'jspdf', // PDF generation (fflate uses dynamic Worker that Turbopack can't resolve)
    'jspdf-autotable', // jsPDF table plugin
    'fflate', // Compression library used by jspdf (uses Node Worker)
  ],

  // Keep only supported, tenant-safe performance settings here. Cache
  // Components and Partial Prefetching remain opt-in: authenticated layouts
  // read request cookies/headers and the tenant key must be part of every
  // cache identity before those features can be enabled safely.
  experimental: {
    // Optimize imports for tree-shaking heavy UI libraries
    optimizePackageImports: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@tanstack/react-table',
      'lucide-react',
      'recharts',
      'framer-motion',
      'date-fns',
    ],
    // Cache configuration for client-side router cache
    staleTimes: {
      dynamic: 0, // 0s for dynamic authenticated routes to eliminate cross-session layout caching
      static: 180, // 3 minutes for static routes
    },
  },

  // Turbopack config — acknowledge webpack config coexistence (Next.js 16)
  turbopack: {},

  // Bundle optimization configuration (used when building with --webpack)
  webpack: (config, { isServer }) => {
    // Optimize bundle splitting for better caching (client-side only)
    if (!isServer && config.optimization.splitChunks && typeof config.optimization.splitChunks === 'object') {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        // Separate heavy UI libraries for better caching
        'radix-ui': {
          test: /[\\/]node_modules[\\/]@radix-ui/,
          name: 'radix-ui',
          chunks: 'all',
          priority: 20,
        },
        // Separate Supabase and tRPC for better caching
        'supabase': {
          test: /[\\/]node_modules[\\/](@supabase|@trpc)/,
          name: 'supabase-trpc',
          chunks: 'all',
          priority: 15,
        },
        // Separate UI utility libraries
        'ui-libs': {
          test: /[\\/]node_modules[\\/](lucide-react|clsx|tailwind-merge|class-variance-authority)/,
          name: 'ui-libs',
          chunks: 'all',
          priority: 10,
        },
        // Separate charting library (heavy)
        'charts': {
          test: /[\\/]node_modules[\\/]recharts/,
          name: 'charts',
          chunks: 'all',
          priority: 12,
        },
        // Separate animation library
        'animations': {
          test: /[\\/]node_modules[\\/]framer-motion/,
          name: 'animations',
          chunks: 'all',
          priority: 11,
        },
      };
    }

    return config;
  },

  // Strict TypeScript type-checking during build
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
