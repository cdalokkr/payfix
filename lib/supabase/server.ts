// ============================================
// lib/supabase/server.ts
// Enhanced with security best practices
// ============================================
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Secure cookie configuration
const SECURE_COOKIE_OPTIONS: Partial<CookieOptions> = {
  // Only send cookies over HTTPS in production
  secure: process.env.NODE_ENV === 'production',
  // Prevent JavaScript access to cookies (XSS protection)
  httpOnly: true,
  // Strict same-site policy for CSRF protection
  sameSite: 'lax',
  // Set path to root
  path: '/',
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  // Use SERVICE ROLE key for server-side operations to bypass RLS
  // This is critical for tRPC context creation where we need to query profiles
  // SECURITY NOTE: Service role key should NEVER be exposed to client
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Merge secure options with provided options
            const secureOptions = {
              ...SECURE_COOKIE_OPTIONS,
              ...options,
              // Ensure httpOnly is always true for auth cookies
              httpOnly: name.includes('auth') ? true : options.httpOnly,
            }
            cookieStore.set({ name, value, ...secureOptions })
          } catch (error) {
            // This can happen in middleware or during static generation
            // Log only in development to avoid noise in production
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Supabase] Cookie set warning:', error)
            }
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const secureOptions = {
              ...SECURE_COOKIE_OPTIONS,
              ...options,
              maxAge: 0, // Expire immediately
            }
            cookieStore.set({ name, value: '', ...secureOptions })
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Supabase] Cookie remove warning:', error)
            }
          }
        },
      },
    }
  )
}

// Create a client with anon key only (for public operations)
export async function createPublicSupabaseClient() {
  const cookieStore = await cookies()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables are not configured')
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            const secureOptions = {
              ...SECURE_COOKIE_OPTIONS,
              ...options,
            }
            cookieStore.set({ name, value, ...secureOptions })
          } catch {
            // Silent fail for read-only contexts
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...SECURE_COOKIE_OPTIONS, ...options, maxAge: 0 })
          } catch {
            // Silent fail for read-only contexts
          }
        },
      },
    }
  )
}