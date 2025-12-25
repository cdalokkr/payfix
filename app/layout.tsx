import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc/provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { WebVitalsReporter } from '@/components/monitoring/web-vitals-reporter'

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
    default: 'Full-Stack App - Next.js 16',
    template: '%s | Full-Stack App'
  },
  description: 'Complete authentication system with Supabase and tRPC',
  keywords: ['Next.js', 'Supabase', 'tRPC', 'React', 'Tailwind CSS'],
  authors: [{ name: 'Antigravity' }],
  creator: 'Antigravity',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://myfullstackapp.com',
    title: 'Full-Stack App - Next.js 16',
    description: 'Complete authentication system with Supabase and tRPC',
    siteName: 'Full-Stack App',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Full-Stack App - Next.js 16',
    description: 'Complete authentication system with Supabase and tRPC',
  },
  icons: {
    icon: '/favicon.ico',
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
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}