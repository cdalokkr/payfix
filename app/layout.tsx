import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc/provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import dynamicImport from 'next/dynamic'

// Lazy-load non-critical components (they render null but load JS modules)
// Code-split to keep them off the initial bundle critical path
const WebVitalsReporter = dynamicImport(
  () => import('@/components/monitoring/web-vitals-reporter')
)
const PWARegister = dynamicImport(
  () => import('@/components/pwa/pwa-register')
)

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Optimize font loading
  preload: true,
  variable: '--font-inter',
})

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-outfit',
})

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// The root layout reads tenant branding from request headers. Mark it dynamic
// explicitly so Next never attempts static rendering or cross-tenant shell
// reuse for a request-scoped theme.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: {
    default: 'PayFix Attendance',
    template: '%s | PayFix'
  },
  description: 'Employee attendance tracking with location verification',
  keywords: ['Next.js', 'Supabase', 'tRPC', 'React', 'Tailwind CSS', 'Attendance', 'PWA'],
  authors: [{ name: 'PayFix' }],
  creator: 'PayFix',
  manifest: '/api/manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PayFix',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://payfix.com',
    title: 'PayFix Attendance',
    description: 'Employee attendance tracking with location verification',
    siteName: 'PayFix',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PayFix Attendance',
    description: 'Employee attendance tracking with location verification',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
}

import Script from 'next/script'

import { ToastProvider } from "@/components/auth/ui/Toast"
import { headers } from 'next/headers'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const themeHeader = headersList.get('x-tenant-theme')
  
  let theme = { primary: '#4f46e5', secondary: '#0f172a', logo: '/logo.png' }
  if (themeHeader) {
    try {
      theme = JSON.parse(themeHeader)
    } catch {}
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="pwa-standalone-check"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
                document.cookie = "pwa_standalone=" + isStandalone + "; path=/; max-age=31536000; SameSite=Lax";
              })();
            `,
          }}
        />
        {/* Dynamic theme style overrides */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --primary: ${theme.primary};
                --sidebar-primary: ${theme.primary};
                --ring: ${theme.primary}50;
              }
              .dark {
                --primary: ${theme.primary};
                --sidebar-primary: ${theme.primary};
                --ring: ${theme.primary}50;
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased`} suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
            <SonnerToaster richColors position="top-center" />
            <WebVitalsReporter debug={process.env.NODE_ENV === 'development'} />
            <PWARegister />
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
