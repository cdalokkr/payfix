// ============================================
// app/(auth)/login/page.tsx
// ============================================
import { LoginForm } from '@/components/auth/login-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { ShieldUser } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'


export const metadata = {
  title: 'Login - Full-Stack App',
  description: 'Sign in to your account',
}

export default async function LoginPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 relative overflow-hidden flex flex-col font-sans">
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
              <Image src="/icons/icon-192x192.png" alt="PayFix" width={40} height={40} className="w-full h-full object-cover" />
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
            <div className="relative bg-[#FFFFFF] dark:bg-zinc-900 border-x border-b border-t-[5px] border-primary dark:border-primary backdrop-blur-2xl rounded-xl sm:rounded-2xl overflow-hidden shadow-none hover:shadow-[0_40px_80px_-15px_rgba(37,99,235,0.2)] dark:hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.55)] transition-all duration-300 flex flex-col">
              <div className="pt-4 pb-3 justify-center border-b border-primary/10 dark:border-primary/20 px-4 sm:px-5 flex flex-col items-center text-center gap-2.5 bg-primary/[0.04] dark:bg-primary/[0.08]">
                <div className="flex-shrink-0 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 shadow-sm">
                  <ShieldUser className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                </div>
                <div className="flex flex-col items-center">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                    Welcome Back
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1">
                    Enter credentials to access
                  </p>
                </div>
              </div>

              <div className="px-5 sm:px-8 pb-4 pt-4">
                <LoginForm />
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <p className="mt-4 sm:mt-5 text-center text-gray-500 dark:text-zinc-400 text-xs sm:text-sm px-4">
            &copy; {new Date().getFullYear()} PayFix Mobile. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  )
}
