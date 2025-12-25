// ============================================
// app/page.tsx (Home Page)
// ============================================
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogIn, User } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

export const metadata = {
  title: 'Home - Full-Stack App',
  description: 'Welcome to our application',
}

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Top Bar */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">FS</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              FullStack App
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button className="gap-2">
                <LogIn /> Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Welcome to FullStack App
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            A complete authentication system built with Next.js 15,
            Supabase, tRPC, and modern web technologies.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/login">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                <LogIn /> Get Started
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <User className="text-2xl text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                Role-Based Access
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Secure authentication with admin and user roles
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                Real-Time Updates
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Live notifications and data synchronization
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                Data Management
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Secure data handling and user management
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}