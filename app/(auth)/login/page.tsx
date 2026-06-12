// ============================================
// app/(auth)/login/page.tsx
// ============================================
import { LoginForm } from '@/components/auth/login-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { ShieldUser } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MobileSplash } from '@/components/mobile/mobile-splash'

export const metadata = {
  title: 'Login - Full-Stack App',
  description: 'Sign in to your account',
}

export default async function LoginPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 relative overflow-hidden flex flex-col font-sans">
      {/* Modern startup animated splash screen overlay */}
      <MobileSplash sessionKey="login_splash_shown" />

      {/* Dynamic Background Elements - Light Edition */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-100/40 dark:bg-blue-900/10 blur-[130px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-100/40 dark:bg-indigo-900/10 blur-[130px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[20%] right-[10%] w-[35%] h-[35%] bg-purple-100/30 dark:bg-purple-900/5 blur-[110px] rounded-full" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Top Bar */}
      <header className="relative z-10 border-b border-gray-100 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-zinc-900 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 overflow-hidden border border-gray-100 dark:border-zinc-800">
              <img src="/icons/icon-192x192.png" alt="PayFix" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight leading-none">
                PayFix
              </h1>
              <span className="text-[9px] sm:text-[10px] text-blue-600 font-bold uppercase tracking-[0.2em] mt-0.5 sm:mt-1">Mobile Attendance</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Login Form Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[440px] animate-in fade-in zoom-in duration-700">
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-blue-100 dark:border-blue-900/50 shadow-lg hover:shadow-xl transform-gpu group-hover:scale-[1.02]  blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>

            <Card className="relative bg-white/80 dark:bg-zinc-900/80 border-primary/20 dark:border-zinc-800 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.05)] border">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />

              <CardHeader className="pt-4 pb-2 justify-center border-b border-gray-200 dark:border-zinc-800 px-4 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-shrink-0 p-2 rounded-xl sm:rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                    <ShieldUser className="h-6 w-6 sm:h-8 sm:h-8 text-blue-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 truncate">
                      Welcome Back
                    </CardTitle>
                    <CardDescription className="text-gray-500 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed truncate">
                      Enter credentials to access
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5 sm:px-8 pb-6">
                <LoginForm />
              </CardContent>
            </Card>
          </div>

          {/* Footer Info */}
          <p className="mt-6 sm:mt-8 text-center text-gray-500 dark:text-zinc-400 text-xs sm:text-sm px-4">
            &copy; {new Date().getFullYear()} PayFix Mobile. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  )
}
