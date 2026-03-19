import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc/provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import dynamic from 'next/dynamic'

// Lazy-load non-critical components (they render null but load JS modules)
// Code-split to keep them off the initial bundle critical path
const WebVitalsReporter = dynamic(
  () => import('@/components/monitoring/web-vitals-reporter')
)
const PWARegister = dynamic(
  () => import('@/components/pwa/pwa-register')
)

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Optimize font loading
  preload: true,
  variable: '--font-inter',
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

export const metadata: Metadata = {
  title: {
    default: 'PayFix Attendance',
    template: '%s | PayFix'
  },
  description: 'Employee attendance tracking with location verification',
  keywords: ['Next.js', 'Supabase', 'tRPC', 'React', 'Tailwind CSS', 'Attendance', 'PWA'],
  authors: [{ name: 'PayFix' }],
  creator: 'PayFix',
  manifest: '/manifest.json',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCProvider>
            {children}
            <SonnerToaster richColors position="top-center" />
            <WebVitalsReporter debug={process.env.NODE_ENV === 'development'} />
            <PWARegister />
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
