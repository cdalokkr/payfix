import { createServerSupabaseClient, createSupabaseClientSync } from '@/lib/supabase/server'
import type { Profile } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createHash } from 'crypto'
import { db, centralDb } from '@/lib/db'
import { profiles, designations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decodeJwt } from 'jose'
import {
  hasValidTenantHealthProbeToken,
  isTenantHealthOperator,
} from '@/lib/auth/tenant-health-policy'

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

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string }> {
  if (!cookieHeader) return []
  return cookieHeader.split(';').map(pair => {
    const idx = pair.indexOf('=')
    if (idx === -1) return { name: pair.trim(), value: '' }
    return {
      name: pair.substring(0, idx).trim(),
      value: pair.substring(idx + 1).trim()
    }
  })
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

      // Check centralDb first to see if this is a platform-wide super_admin
      const centralResult = await centralDb.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        with: { designation: true }
      })

      let result: any = null

      if (centralResult) {
        result = centralResult
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AUTH-PERF] Resolved profile via centralDb: ${profileId} (role: ${centralResult.role})`)
        }
      } else {
        // Query mapped tenant DB
        const tenantResult = await db.query.profiles.findFirst({
          where: eq(profiles.id, profileId),
          with: { designation: true }
        })
        result = tenantResult
      }

      // Universal schema scan fallback if profile still not found
      if (!result) {
        try {
          const { sql: sqlTag } = await import('drizzle-orm')
          const scanResult = await centralDb.execute(sqlTag`
            SELECT public.find_profile_across_schemas(${profileId}::uuid) as profile;
          `)

          const profileJson = scanResult[0]?.profile;
          if (profileJson) {
            const fbProfile = profileJson as any
            if (typeof fbProfile.designation === 'string') {
              try { fbProfile.designation = JSON.parse(fbProfile.designation); } catch {}
            }
            result = fbProfile
            if (process.env.NODE_ENV === 'development') {
              console.log(`[AUTH-PERF] Profile found via Universal Schema Scan in: ${fbProfile.tenant_schema}`)
            }
          }
        } catch (scanErr) {
          console.error('[AUTH] Universal schema scan failed:', scanErr)
        }
      }

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
export async function createOptimizedContext(req?: Request) {
  const metrics = startAuthTiming()
  createContextCallCount++

  // Lazy client variable captured in closure
  let _lazySupabase: any = null;
  let cookieStore: any = null;

  try {
    const t0 = performance.now();

    // Check if middleware passed pre-authenticated session details via headers
    let headerUserId: string | null = null
    let headerUserEmail: string | null = null
    let headerUserProfileStr: string | null = null
    let headerUserMetadataStr: string | null = null

    if (req) {
      headerUserId = req.headers.get('x-user-id')
      headerUserEmail = req.headers.get('x-user-email')
      headerUserProfileStr = req.headers.get('x-user-profile')
      headerUserMetadataStr = req.headers.get('x-user-metadata')
    } else {
      try {
        const headerStore = await headers()
        headerUserId = headerStore.get('x-user-id')
        headerUserEmail = headerStore.get('x-user-email')
        headerUserProfileStr = headerStore.get('x-user-profile')
        headerUserMetadataStr = headerStore.get('x-user-metadata')
      } catch (err) {
        // cookies/headers functions throw in static build or context where headers are unavailable
      }
    }

    if (headerUserId) {
      try {
        const profile = headerUserProfileStr ? JSON.parse(headerUserProfileStr) as Profile : null
        const userMetadata = headerUserMetadataStr ? JSON.parse(headerUserMetadataStr) : {}
        const user = { 
          id: headerUserId, 
          email: headerUserEmail || '', 
          user_metadata: userMetadata 
        } as User
        
        const finalMetrics = endAuthTiming(metrics, {
          userFound: true,
          profileFound: !!profile,
          cacheHit: true,
          contextSize: headerUserProfileStr ? headerUserProfileStr.length : 0
        })

        // Setup mock/lazy cookieStore so that tRPC context doesn't crash if it tries to read cookies later
        if (req && req.method === 'GET') {
          const cookieHeader = req.headers.get('cookie') || ''
          const parsed = parseCookieHeader(cookieHeader)
          cookieStore = {
            getAll: () => parsed,
            get: (name: string) => {
              const match = parsed.find(c => c.name === name)
              return match ? { name, value: match.value } : undefined
            },
            set: () => {}
          } as any
        } else {
          try {
            cookieStore = await cookies()
          } catch (e) {
            // Read-only/static shell
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`[AUTH-HEADERS] Fast-path session resolved via headers for user: ${headerUserId} (profile role: ${profile?.role || 'none'})`)
        }

        return {
          get supabase() {
            if (!_lazySupabase) _lazySupabase = createSupabaseClientSync(cookieStore as any);
            return _lazySupabase;
          },
          user,
          profile,
          metrics: finalMetrics
        }
      } catch (parseErr) {
        console.warn('[AUTH-HEADERS] Error parsing user profile from headers:', parseErr)
      }
    }
    let authHeader: string | null = null;
    let t1 = t0;

    if (req && req.method === 'GET') {
      const cookieHeader = req.headers.get('cookie') || ''
      console.log('[AUTH-DEBUG] cookieHeader from req:', cookieHeader ? `${cookieHeader.substring(0, 100)}... [len:${cookieHeader.length}]` : 'EMPTY')
      const parsed = parseCookieHeader(cookieHeader)
      authHeader = req.headers.get('authorization')
      cookieStore = {
        getAll: () => parsed,
        get: (name: string) => {
          const match = parsed.find(c => c.name === name)
          return match ? { name, value: match.value } : undefined
        },
        set: (name: string, value: string, options?: any) => {
          // Read-only path, mutations handled separately or silently ignored
        }
      } as any;
      t1 = performance.now();
    } else {
      cookieStore = await cookies()
      t1 = performance.now();
    }

    // 1. FAST CHECK: If no auth cookies exist, skip everything
    const allCookies = cookieStore.getAll()
    const hasAuthCookie = allCookies.some((c: any) => c.name.includes('-auth-token'))

    let cookieHash = ''
    if (hasAuthCookie) {
      cookieHash = await getCookieHash(cookieStore)
    }

    // NEW OPTIMIZATION & CONCURRENCY FIX: Check cookie-hash based cache first to prevent device session conflicts
    if (cookieHash) {
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
    }

    if (!req || req.method !== 'GET') {
      const headerStore = await headers()
      authHeader = headerStore.get('authorization')
    }
    const hasBearerToken = authHeader ? authHeader.startsWith('Bearer ') : false
    const t2 = performance.now();


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

/**
 * Defense-in-depth authorization for the tenant health diagnostics. The
 * proxy performs the same policy check, but route handlers must not rely on
 * middleware ordering to keep diagnostic data private.
 */
export async function canAccessTenantHealthDiagnostics(req?: Request): Promise<boolean> {
  if (hasValidTenantHealthProbeToken(req)) {
    return true;
  }

  try {
    const context = await createOptimizedContext(req);
    return isTenantHealthOperator(context.profile);
  } catch {
    return false;
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
  // Clear the userId-based session cache
  userIdSessionCache.delete(userId)

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
      console.log('[AUTH-LOGOUT] Logout procedure executed for unauthenticated request (no userId), skipping server-side cache invalidation')
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
