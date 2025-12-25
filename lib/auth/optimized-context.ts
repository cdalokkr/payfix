import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'

// Performance monitoring interface
interface AuthPerformanceMetrics {
  startTime: number
  endTime?: number
  duration?: number
  contextSize: number
  cacheHit: boolean
  userFound: boolean
  profileFound: boolean
  error?: string
}

// Additional data for performance metrics
interface AuthMetricsData {
  userFound?: boolean
  profileFound?: boolean
  cacheHit?: boolean
  contextSize?: number
  error?: string
}

// Context result interface for type safety
export interface OptimizedContextResult {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null
  user: User | null
  profile: Profile | null
  metrics: AuthPerformanceMetrics
}

// Session cache for optimizing repeated requests
interface SessionCache {
  user: User
  profile: Profile | null
  expiresAt: number
  metrics: AuthPerformanceMetrics
}

// Global session cache (memory-based for performance)
// Map<cookieHash, SessionCache>
const sessionCache = new Map<string, SessionCache>()
// Map<userId, cookieHash> for invalidation support
const userToHashCache = new Map<string, string>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CONTEXT_CACHE_PREFIX = 'ctx:'

let createContextCallCount = 0
let cacheHitCount = 0
let totalContextTime = 0

// Security-safe hash for cookies
async function getCookieHash(): Promise<string> {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    // Identify auth cookies (sb-XXXX-auth-token or sb-XXXX-auth-token.0 etc)
    // We sort them to ensure consistent hashing even if order changes
    const authCookies = allCookies
      .filter((c: any) => c.name.includes('-auth-token'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c: any) => `${c.name}=${c.value}`)
      .join(';')

    if (!authCookies) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AUTH-HASH] No auth cookies found in store')
      }
      return ''
    }

    const hash = createHash('sha256').update(authCookies).digest('hex')
    return hash
  } catch (error) {
    return ''
  }
}

// Performance monitoring utility
function startAuthTiming(): AuthPerformanceMetrics {
  return {
    startTime: performance.now(),
    duration: 0,
    contextSize: 0,
    cacheHit: false,
    userFound: false,
    profileFound: false
  }
}

function endAuthTiming(metrics: AuthPerformanceMetrics, additionalData?: AuthMetricsData): AuthPerformanceMetrics {
  metrics.endTime = performance.now()
  metrics.duration = metrics.endTime - metrics.startTime

  if (additionalData) {
    Object.assign(metrics, additionalData)
  }

  // Log slow contexts for monitoring
  if (metrics.duration > 500) {
    console.warn(`[AUTH-PERF] Slow authentication context: ${metrics.duration.toFixed(2)}ms`, metrics)
  }

  return metrics
}

// Optimized session cache with TTL
function getCachedSession(hash: string): SessionCache | null {
  if (!hash) return null
  const cacheKey = CONTEXT_CACHE_PREFIX + hash
  const cached = sessionCache.get(cacheKey)

  if (cached && Date.now() < cached.expiresAt) {
    cacheHitCount++
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH-CACHE] Hit for hash ${hash.substring(0, 8)}...`)
    }
    return cached
  }

  // Clean up expired cache
  if (cached) {
    sessionCache.delete(cacheKey)
    if (cached.user?.id) {
      userToHashCache.delete(cached.user.id)
    }
  }

  return null
}

function setCachedSession(hash: string, userId: string, session: SessionCache): void {
  if (!hash) return
  const cacheKey = CONTEXT_CACHE_PREFIX + hash
  session.expiresAt = Date.now() + CACHE_TTL
  sessionCache.set(cacheKey, session)
  userToHashCache.set(userId, hash)

  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUTH-CACHE] Set for ${userId} (hash: ${hash.substring(0, 8)}...)`)
  }

  // Clean up old cache entries to prevent memory leaks
  if (sessionCache.size > 100) {
    const now = Date.now()
    for (const [key, value] of sessionCache.entries()) {
      if (value.expiresAt < now) {
        sessionCache.delete(key)
        if (value.user?.id) {
          userToHashCache.delete(value.user.id)
        }
      }
    }
  }
}

// Preload profile data to avoid N+1 queries
async function preloadProfile(supabaseClient: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id, user_id, email, full_name, avatar_url, role, status, first_name, middle_name, last_name, mobile_no, date_of_birth, sex, created_at, updated_at, designation_id, designation:designations(*)')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error preloading profile:', error)
      return null
    }

    if (data && (data as any).designation && Array.isArray((data as any).designation)) {
      (data as any).designation = (data as any).designation[0] || null
    }

    return data as Profile | null
  } catch (error) {
    console.error('Exception preloading profile:', error)
    return null
  }
}

// Optimized context creation with async session management
export async function createOptimizedContext() {
  const metrics = startAuthTiming()
  createContextCallCount++

  try {
    const supabase = await createServerSupabaseClient()

    // SECURE FAST CHECK: Check cache using cookie hash
    // This avoids calling getSession() which- triggers security warnings
    const cookieHash = await getCookieHash()

    // SHORT-CIRCUIT: No auth cookies found. Skip expensive getUser() remote call.
    // This is a major optimization for public procedures (like login) and guest users.
    if (!cookieHash) {
      const finalMetrics = endAuthTiming(metrics, {
        userFound: false,
        profileFound: false,
        cacheHit: false,
        error: 'No auth cookies detected'
      })

      return {
        supabase,
        user: null,
        profile: null,
        metrics: finalMetrics
      }
    }

    const cachedSession = getCachedSession(cookieHash)

    if (cachedSession) {
      const finalMetrics = endAuthTiming(metrics, {
        userFound: true,
        profileFound: !!cachedSession.profile,
        cacheHit: true,
        contextSize: JSON.stringify(cachedSession).length
      })

      return {
        supabase,
        user: cachedSession.user,
        profile: cachedSession.profile,
        metrics: finalMetrics
      }
    }

    // CACHE MISS: Perform full security validation
    // getUser() validates the session token with Supabase Auth server
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (!user || userError) {
      const finalMetrics = endAuthTiming(metrics, {
        userFound: false,
        profileFound: false,
        cacheHit: false,
        error: userError?.message || 'User not authenticated'
      })

      totalContextTime += finalMetrics.duration || 0

      return {
        supabase,
        user: null,
        profile: null,
        metrics: finalMetrics
      }
    }

    const userId = user.id

    // Fetch the profile
    const profile = await preloadProfile(supabase, userId)

    const finalMetrics = endAuthTiming(metrics, {
      userFound: !!user,
      profileFound: !!profile,
      cacheHit: false,
      contextSize: JSON.stringify({ user, profile }).length
    })

    const contextResult = {
      supabase,
      user,
      profile,
      metrics: finalMetrics
    }

    // Cache successful session and profile using BOTH hash and ID
    if (cookieHash) {
      setCachedSession(cookieHash, userId, {
        user,
        profile,
        expiresAt: Date.now() + CACHE_TTL,
        metrics: finalMetrics
      })
    }

    totalContextTime += finalMetrics.duration || 0

    return contextResult

  } catch (error) {
    const finalMetrics = endAuthTiming(metrics, {
      error: error instanceof Error ? error.message : 'Unknown error',
      userFound: false,
      profileFound: false,
      cacheHit: false
    })

    console.error('[AUTH-PERF] Context creation failed:', error)

    return {
      supabase: null,
      user: null,
      profile: null,
      metrics: finalMetrics
    }
  }
}

// Batch context creation for multiple requests
export async function createOptimizedContextBatch(userIds: string[]): Promise<Map<string, OptimizedContextResult>> {
  const results = new Map<string, OptimizedContextResult>()
  const promises: Promise<void>[] = []

  for (const userId of userIds) {
    if (!userId) continue

    const promise = createOptimizedContext().then(context => {
      if (context.user?.id === userId) {
        results.set(userId, context)
      }
    }).catch(error => {
      console.error(`[AUTH-PERF] Batch context creation failed for user ${userId}:`, error)
    })

    promises.push(promise)
  }

  await Promise.allSettled(promises)
  return results
}

// Performance monitoring utilities
export function getAuthPerformanceStats() {
  const avgContextTime = createContextCallCount > 0 ? totalContextTime / createContextCallCount : 0
  const cacheHitRate = createContextCallCount > 0 ? (cacheHitCount / createContextCallCount) * 100 : 0

  return {
    totalContextCreations: createContextCallCount,
    averageContextTime: avgContextTime,
    cacheHitRate: cacheHitRate,
    cacheHits: cacheHitCount,
    cacheSize: sessionCache.size
  }
}

// Invalidate session cache (call on logout or session refresh)
export function invalidateUserSession(userId: string): void {
  const hash = userToHashCache.get(userId)
  if (hash) {
    const cacheKey = CONTEXT_CACHE_PREFIX + hash
    sessionCache.delete(cacheKey)
    userToHashCache.delete(userId)
    console.log(`[AUTH-CACHE] Invalidated for ${userId} (hash: ${hash.substring(0, 8)}...)`)
  }
}

// Invalidate all sessions (call on global events)
export function invalidateAllSessions(): void {
  sessionCache.clear()
  userToHashCache.clear()
  cacheHitCount = 0
  createContextCallCount = 0
  totalContextTime = 0
}

// Enhanced logout function to clear all session data and cache
// NOTE: Client-side storage (localStorage/sessionStorage) is cleared by the client-side
// logout modal in components/ui/logout-modal.tsx. This server-side function only handles
// server-side cache invalidation.
export async function performLogout(userId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (userId) {
      // Clear server-side session cache for a specific user
      invalidateUserSession(userId)
      console.log(`[AUTH-LOGOUT] Server-side session cache invalidated for user: ${userId}`)
    } else {
      // Clear server-side session cache for all users
      invalidateAllSessions()
      console.log('[AUTH-LOGOUT] Server-side session cache cleared for all users')
    }

    return { success: true }
  } catch (error) {
    console.error('[AUTH-LOGOUT] Error during logout:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown logout error'
    }
  }
}
