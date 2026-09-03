// ============================================
// lib/supabase/server.ts
// Enhanced with security best practices
// Uses modern getAll/setAll cookie API (@supabase/ssr v0.9+)
// ============================================
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Secure cookie defaults applied to every setAll call
const SECURE_COOKIE_DEFAULTS = {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
}

// Synchronous version for use when cookie store is already available (optimizes createContext)
export function createSupabaseClientSync(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  bearerToken?: string,
) {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: bearerToken
        ? { headers: { Authorization: `Bearer ${bearerToken}` } }
        : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...SECURE_COOKIE_DEFAULTS,
                ...options,
                // Force httpOnly on auth cookies for XSS protection
                httpOnly: name.includes('auth') ? true : (options?.httpOnly ?? SECURE_COOKIE_DEFAULTS.httpOnly),
              })
            })
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Supabase] Cookie set warning:', error)
            }
          }
        },
      },
    }
  )
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createSupabaseClientSync(cookieStore)
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
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...SECURE_COOKIE_DEFAULTS,
                ...options,
              })
            })
          } catch {
            // Silent fail for read-only contexts (e.g. Server Components)
          }
        },
      },
    }
  )
}