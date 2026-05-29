import { createServerSupabaseClient, createSupabaseClientSync } from '@/lib/supabase/server'
import type { Profile } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { profiles, designations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decodeJwt } from 'jose'

// Helper to decode Supabase JWT locally to avoid network calls
function decodeSupabaseToken(token: string): string | null {
  if (!token) return null
  try {
    let actualToken = token

    // Strategy 1: It's a raw JWT (3 dot-separated parts)
    if (token.includes('.') && token.split('.').length === 3 && !token.startsWith('{')) {
      // Already a JWT, use as is
    }
    // Strategy 2: It's a JSON string (Supabase SSR format)
    else if (token.startsWith('{')) {
      try {
        const session = JSON.parse(token)
        actualToken = session.access_token || token
      } catch (e) {
        // Not valid JSON, continue
      }
    }
    // Strategy 3: Base64-encoded JSON (common in Supabase SSR)
    else if (token.startsWith('base64-')) {
      try {
        const base64Part = token.substring(7)
        const decoded = Buffer.from(base64Part, 'base64').toString('utf8')

        if (process.env.NODE_ENV === 'development') {
          console.log(`[AUTH-DEBUG] Decoded base64: ${decoded.substring(0, 50)}...`);
        }

        try {
          const session = JSON.parse(decoded)
          // Look for access_token in various common keys
          const innerToken = session.access_token || session.accessToken || session.token
          if (innerToken && typeof innerToken === 'string') {
            actualToken = innerToken
          } else if (decoded.includes('.') && decoded.split('.').length === 3) {
            // If not valid JSON with access_token, but the decoded string IS a JWT
            actualToken = decoded
          }
        } catch (jsonErr) {
          // If not valid JSON, check if the decoded string IS a JWT pattern
          const jwtMatch = decoded.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
          if (jwtMatch) {
            actualToken = jwtMatch[0]
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AUTH-DEBUG] Base64 decode failed for token starting with: ${token.substring(0, 20)}`);
        }
      }
    }
    // Strategy 4: Direct Search for JWT pattern in anything else
    else {
      const jwtMatch = token.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
      if (jwtMatch) {
        actualToken = jwtMatch[0]
      }
    }

    // SANITIZATION: Remove any leading/trailing quotes or whitespace
    actualToken = actualToken.trim().replace(/^["'](.+)["']$/, '$1')

    // If we STILL have a base64- prefix or JSON, the extraction failed
    if (actualToken.startsWith('base64-') || actualToken.startsWith('{')) {
      // Last ditch effort: regex on the whatever we have now
      const lastDitchMatch = actualToken.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
      if (lastDitchMatch) {
        actualToken = lastDitchMatch[0]
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH-DEBUG] Final token for decode: ${actualToken.substring(0, 25)}... [len:${actualToken.length}]`)
    }

    const payload = decodeJwt(actualToken)
    return (payload.sub as string) || null
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[AUTH-PERF] JWT decode failed:', error instanceof Error ? error.message : error)
    }
    return null
  }
}

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
// Linked to globalThis to share caches across Next.js cross-bundle contexts (Server Components and Route Handlers)
const globalForAuth = globalThis as unknown as {
  sessionCache?: Map<string, SessionCache>
  userToHashCache?: Map<string, string>
  userIdSessionCache?: Map<string, SessionCache>
}

const sessionCache = globalForAuth.sessionCache ?? new Map<string, SessionCache>()
const userToHashCache = globalForAuth.userToHashCache ?? new Map<string, string>()
const userIdSessionCache = globalForAuth.userIdSessionCache ?? new Map<string, SessionCache>()

globalForAuth.sessionCache = sessionCache
globalForAuth.userToHashCache = userToHashCache
globalForAuth.userIdSessionCache = userIdSessionCache
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CONTEXT_CACHE_PREFIX = 'ctx:'

let createContextCallCount = 0
let cacheHitCount = 0
let totalContextTime = 0

// Security-safe hash for cookies
async function getCookieHash(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<string> {
  try {
    const allCookies = cookieStore.getAll()

    // Fast-path: check for existence of common auth cookies first
    const hasAuth = allCookies.some(c => c.name.includes('-auth-token'))
    if (!hasAuth) return ''

    // Identify auth cookies (sb-XXXX-auth-token or sb-XXXX-auth-token.0 etc)
    const authCookies = allCookies
      .filter((c: any) => c.name.includes('-auth-token'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c: any) => `${c.name}=${c.value}`)
      .join(';')

    if (!authCookies) return ''

    return createHash('sha256').update(authCookies).digest('hex')
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

  // Log slow contexts for monitoring (threshold increased to 1000ms for heavy loads)
  if (metrics.duration > 1000) {
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

  // Also store by userId for post-login optimization (when cookie hash changes)
  userIdSessionCache.set(userId, session)

  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUTH-CACHE] Set for ${userId} (hash: ${hash.substring(0, 8)}...)`)
  }

  // Clean up old cache entries to prevent memory leaks
  if (sessionCache.size > 200) { // Bumped to 200
    const now = Date.now()
    for (const [key, value] of sessionCache.entries()) {
      if (value.expiresAt < now) {
        sessionCache.delete(key)
        if (value.user?.id) {
          userToHashCache.delete(value.user.id)
          userIdSessionCache.delete(value.user.id)
        }
      }
    }
  }
}

// Get cached session by userId (fallback when cookie hash changes after login)
function getCachedSessionByUserId(userId: string): SessionCache | null {
  if (!userId) return null
  const cached = userIdSessionCache.get(userId)

  if (cached && Date.now() < cached.expiresAt) {
    cacheHitCount++
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH-CACHE] UserId hit for ${userId}`)
    }
    return cached
  }

  // Clean up expired
  if (cached) {
    userIdSessionCache.delete(userId)
  }

  return null
}

// Preload profile data using Primary Key (id) for maximum performance
// Includes retry logic for transient connection errors
async function preloadProfile(profileId: string): Promise<Profile | null> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [500, 1000, 2000]; // ms - exponential backoff

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = performance.now()

      // Primary Key lookups are the fastest possible queries in Postgres
      const result = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        with: { designation: true }
      })

      const duration = performance.now() - startTime
      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.log(`[AUTH-PERF] Drizzle profile fetch: ${duration.toFixed(2)}ms`)
      }

      if (!result) return null

      // Map Drizzle result to Profile type
      return {
        ...result,
        id: result.id,
        email: result.email,
        full_name: result.full_name || undefined,
        avatar_url: result.avatar_url || undefined,
        role: result.role as any,
        designation_id: result.designation_id || undefined,
        designation: result.designation ? {
          ...result.designation,
          created_at: result.designation.created_at?.toISOString() || null,
          updated_at: result.designation.updated_at?.toISOString() || null,
          role: result.designation.role as any,
        } : undefined,
        first_name: result.first_name || undefined,
        middle_name: result.middle_name || undefined,
        last_name: result.last_name || undefined,
        mobile_no: result.mobile_no || undefined,
        date_of_birth: result.date_of_birth || undefined,
        sex: result.sex || undefined,
        status: result.status as any,
        allowed_modules: result.allowed_modules || undefined,
        created_at: result.created_at?.toISOString() || null,
        updated_at: result.updated_at?.toISOString() || null,
      } as Profile
    } catch (error: any) {
      // Check if this is a connection error that's worth retrying
      const isConnectionError =
        error?.cause?.code === 'CONNECT_TIMEOUT' ||
        error?.cause?.code === 'ECONNREFUSED' ||
        error?.cause?.code === 'ECONNRESET' ||
        error?.message?.includes('CONNECT_TIMEOUT') ||
        error?.message?.includes('connection');

      if (isConnectionError && attempt < MAX_RETRIES) {
        console.warn(`[AUTH-RETRY] Profile fetch attempt ${attempt + 1}/${MAX_RETRIES} failed (${error?.cause?.code || 'connection error'}), retrying in ${RETRY_DELAYS[attempt]}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        continue;
      }

      console.error('Exception preloading profile with Drizzle:', error)
      return null
    }
  }

  return null
}

// Optimized context creation with async session management
export async function createOptimizedContext() {
  const metrics = startAuthTiming()
  createContextCallCount++

  // Lazy client variable captured in closure
  let _lazySupabase: any = null;
  let cookieStore: any = null;

  try {
    const t0 = performance.now();
    cookieStore = await cookies()
    const t1 = performance.now();

    // 1. FAST CHECK: If no auth cookies exist, skip everything
    const cookieHash = await getCookieHash(cookieStore)
    const headerStore = await headers()
    const authHeader = headerStore.get('authorization')
    const hasBearerToken = authHeader?.startsWith('Bearer ')
    const t2 = performance.now();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH-PERF] createContext setup: cookies: ${(t1 - t0).toFixed(2)}ms, hash/headers: ${(t2 - t1).toFixed(2)}ms. Total: ${(t2 - t0).toFixed(2)}ms`)
    }

    // 1b. BEARER TOKEN FAST PATH (Mobile Native Apps)
    if (hasBearerToken) {
      const token = authHeader!.substring(7)
      const decodedUserId = decodeSupabaseToken(token)

      if (decodedUserId) {
        const userIdCached = getCachedSessionByUserId(decodedUserId)
        if (userIdCached) {
          const finalMetrics = endAuthTiming(metrics, {
            userFound: true,
            profileFound: !!userIdCached.profile,
            cacheHit: true,
            contextSize: userIdCached.metrics.contextSize
          })

          return {
            get supabase() {
              if (!_lazySupabase) _lazySupabase = createSupabaseClientSync(cookieStore as any);
              return _lazySupabase;
            },
            user: userIdCached.user,
            profile: userIdCached.profile,
            metrics: finalMetrics
          }
        }
      }
    }

    if (!cookieHash && !hasBearerToken) {
      const finalMetrics = endAuthTiming(metrics, {
        userFound: false,
        profileFound: false,
        cacheHit: false,
        error: 'No auth cookies detected'
      })

      return {
        get supabase() {
          if (!_lazySupabase) _lazySupabase = createSupabaseClientSync(cookieStore as any);
          return _lazySupabase;
        },
        user: null,
        profile: null,
        metrics: finalMetrics
      }
    }

    // 2. PHASE 2 FAST PATH: Local JWT Decoding from Supabase SSR cookies
    // Supabase SSR uses cookies named like 'sb-xxxx-auth-token' or 'sb-xxxx-auth-token.0'
    const allAuthCookies = cookieStore.getAll().filter((c: any) => c.name.includes('-auth-token'))

    if (allAuthCookies.length > 0) {
      const decodedT0 = performance.now();
      try {
        // Find the "sharded" cookies (ending in .0, .1, etc.)
        const shards = allAuthCookies.filter((c: any) => /\.\d+$/.test(c.name));

        let authCookies: typeof allAuthCookies = [];
        if (shards.length > 0) {
          // If shards exist, prefer them exclusively
          authCookies = shards;
        } else {
          // Otherwise use the root cookies (if multiple, e.g. different names, take all)
          authCookies = allAuthCookies;
        }

        // Robustly reconstruct the session string from multiple cookies if fragmented
        const sortedCookies = authCookies.sort((a: any, b: any) => {
          // Sort by index suffix (e.g., .0, .1, .2)
          const aMatch = a.name.match(/\.(\d+)$/);
          const bMatch = b.name.match(/\.(\d+)$/);
          const aIndex = aMatch ? parseInt(aMatch[1]) : -1;
          const bIndex = bMatch ? parseInt(bMatch[1]) : -1;
          return aIndex - bIndex;
        });

        const reconstructedValue = sortedCookies.map((c: any) => c.value).join('');

        // Handle URL encoding if present
        let sessionContent = reconstructedValue;
        if (reconstructedValue.includes('%')) {
          try {
            sessionContent = decodeURIComponent(reconstructedValue);
          } catch (e) {
            // Already decoded or invalid encoding
          }
        }

        // Debug: Log first 100 chars of decoded content
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AUTH-DEBUG] Cookie content (decoded): ${sessionContent.substring(0, 100)}...`);
        }

        const decodedUserId = decodeSupabaseToken(sessionContent)

        if (decodedUserId) {
          const userIdCached = getCachedSessionByUserId(decodedUserId)
          if (userIdCached) {
            const finalMetrics = endAuthTiming(metrics, {
              userFound: true,
              profileFound: !!userIdCached.profile,
              cacheHit: true,
              contextSize: userIdCached.metrics.contextSize
            })

            const tFastPath = performance.now();
            const dt = tFastPath - t0;
            if (process.env.NODE_ENV === 'development') {
              console.log(`[AUTH-PERF] Fast-path complete: ${dt.toFixed(2)}ms. Return path start. Total diff: ${(performance.now() - t0).toFixed(2)}ms`);
            }

            return {
              get supabase() {
                if (!_lazySupabase) _lazySupabase = createSupabaseClientSync(cookieStore as any);
                return _lazySupabase;
              },
              user: userIdCached.user,
              profile: userIdCached.profile,
              metrics: finalMetrics
            }
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[AUTH-PERF] Cookie fast-path extraction failed:', err);
        }
      }
    }

    // 3. CACHE MISS or fallback to hash-based cache
    const cachedSession = getCachedSession(cookieHash)

    if (cachedSession) {
      const finalMetrics = endAuthTiming(metrics, {
        userFound: true,
        profileFound: !!cachedSession.profile,
        cacheHit: true,
        contextSize: cachedSession.metrics.contextSize
      })

      return {
        get supabase() {
          if (!_lazySupabase) _lazySupabase = createSupabaseClientSync(cookieStore as any);
          return _lazySupabase;
        },
        user: cachedSession.user,
        profile: cachedSession.profile,
        metrics: finalMetrics
      }
    }

    // 4. CACHE MISS: Perform full security validation
    // Use the lazy loader to create the client
    const tClientStart = performance.now();
    if (!_lazySupabase) _lazySupabase = createSupabaseClientSync(cookieStore as any);
    const supabase = _lazySupabase;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH-PERF] Lazy client creation: ${(performance.now() - tClientStart).toFixed(2)}ms`);
    }

    const { data: authData, error: userError } = await supabase.auth.getUser()
    const user = authData?.user || null

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

    // OPTIMIZATION: Check if we have cached session by userId (post-login scenario)
    const userIdCached = getCachedSessionByUserId(userId)
    if (userIdCached) {
      // Update the hash-based cache with the new cookie hash
      setCachedSession(cookieHash, userId, userIdCached)

      const finalMetrics = endAuthTiming(metrics, {
        userFound: true,
        profileFound: !!userIdCached.profile,
        cacheHit: true,
        contextSize: userIdCached.metrics.contextSize
      })

      return {
        supabase,
        user: userIdCached.user,
        profile: userIdCached.profile,
        metrics: finalMetrics
      }
    }

    // 5. Fetch the profile using Drizzle
    const profile = await preloadProfile(userId)

    // Estimate size without expensive stringify
    const contextSize = (user ? 1000 : 0) + (profile ? 2000 : 0);

    const finalMetrics = endAuthTiming(metrics, {
      userFound: !!user,
      profileFound: !!profile,
      cacheHit: false,
      contextSize
    })

    const contextResult = {
      get supabase() {
        if (!_lazySupabase) _lazySupabase = createSupabaseClientSync(cookieStore as any);
        return _lazySupabase;
      },
      user,
      profile,
      metrics: finalMetrics
    }

    // Cache successful session and profile
    setCachedSession(cookieHash, userId, {
      user,
      profile,
      expiresAt: Date.now() + CACHE_TTL,
      metrics: finalMetrics
    })

    totalContextTime += finalMetrics.duration || 0

    return contextResult

  } catch (error) {
    // Rethrow Next.js dynamic routing errors so it handles them gracefully and switches to dynamic rendering
    const err = error as any;
    if (
      err &&
      (err.digest === 'DYNAMIC_SERVER_USAGE' ||
       err.message?.includes('Dynamic server usage') ||
       err.digest?.startsWith('NEXT_') ||
       err.message?.includes('dynamic server usage') ||
       err.message?.includes('cookies') ||
       err.message?.includes('headers'))
    ) {
      throw error;
    }

    const finalMetrics = endAuthTiming(metrics, {
      error: error instanceof Error ? error.message : 'Unknown error',
      userFound: false,
      profileFound: false,
      cacheHit: false
    })

    console.error('[AUTH-PERF] Context creation failed:', error)

    return {
      get supabase() {
        if (!_lazySupabase) {
          const store = cookieStore || {
            getAll: () => [],
            get: () => undefined,
            set: () => {},
            delete: () => {},
          };
          _lazySupabase = createSupabaseClientSync(store as any);
        }
        return _lazySupabase;
      },
      user: null,
      profile: null,
      metrics: finalMetrics
    }
  }
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

// Pre-seed session cache after successful login for instant first request
export async function preSeedSessionCache(user: User, profile: Profile): Promise<void> {
  try {
    const startTime = performance.now()
    const cookieStore = await cookies()
    const cookieHash = await getCookieHash(cookieStore)

    const metrics: AuthPerformanceMetrics = {
      startTime,
      endTime: performance.now(),
      duration: performance.now() - startTime,
      contextSize: JSON.stringify({ user, profile }).length,
      cacheHit: false,
      userFound: true,
      profileFound: true
    }

    const sessionData: SessionCache = {
      user,
      profile,
      expiresAt: Date.now() + CACHE_TTL,
      metrics
    }

    // CRITICAL: Always store by userId for post-login optimization
    userIdSessionCache.set(user.id, sessionData)

    // Also store by hash if available
    if (cookieHash) {
      setCachedSession(cookieHash, user.id, sessionData)
      console.log(`[AUTH-CACHE] Pre-seeded for ${user.id} after login (hash: ${cookieHash.substring(0, 8)}...)`)
    } else {
      console.log(`[AUTH-CACHE] Pre-seeded for ${user.id} by userId (no hash yet)`)
    }
  } catch (error) {
    console.warn('[AUTH-CACHE] Pre-seed failed (non-critical):', error)
  }
}
