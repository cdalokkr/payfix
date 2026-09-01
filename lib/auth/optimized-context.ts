import { createServerSupabaseClient, createSupabaseClientSync } from '@/lib/supabase/server'
import type { Profile } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { db, centralDb } from '@/lib/db'
import { profiles, designations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  hasValidTenantHealthProbeToken,
  isTenantHealthOperator,
} from '@/lib/auth/tenant-health-policy'

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
let createContextCallCount = 0
let cacheHitCount = 0
let totalContextTime = 0

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


// Preload profile data using Primary Key (id) for maximum performance
// Includes retry logic for transient connection errors
async function preloadProfile(profileId: string, authClient?: any): Promise<Profile | null> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [500, 1000, 2000]; // ms - exponential backoff

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const startTime = performance.now()

      // Check centralDb first to see if this is a platform-wide super_admin
      const centralResult = await (centralDb as any).query?.profiles?.findFirst?.({
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
        const tenantResult = await (db as any).query?.profiles?.findFirst?.({
          where: eq(profiles.id, profileId),
          with: { designation: true }
        })
        result = tenantResult
      }

      // Some request-only contexts do not expose the Drizzle query API (for
      // example, lightweight health handlers). Use the already authenticated
      // Supabase client as a server-side profile source, never request headers.
      if (!result && authClient?.rpc) {
        const { data: rpcProfile, error: rpcError } = await authClient.rpc(
          'find_profile_across_schemas',
          { p_user_id: profileId },
        )
        if (!rpcError && rpcProfile) {
          result = Array.isArray(rpcProfile) ? rpcProfile[0] : rpcProfile
        }
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
    let authHeader: string | null = null;

    if (req) {
      const cookieHeader = req.headers.get('cookie') || ''
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
    } else {
      cookieStore = await cookies()
      try {
        authHeader = (await headers()).get('authorization')
      } catch {
        // Cookies are the only session source outside a request context.
      }
    }

    // Avoid an unnecessary Supabase call when the request has no session.
    const allCookies = cookieStore.getAll()
    const hasAuthCookie = allCookies.some((c: any) => c.name.includes('-auth-token'))
    const hasBearerToken = authHeader ? authHeader.startsWith('Bearer ') : false

    if (!hasAuthCookie && !hasBearerToken) {
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

    // Always verify the session with Supabase before reading user/profile data.
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

    // Fetch the profile only after the token has been verified.
    const profile = await preloadProfile(user.id, supabase)

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
    cacheSize: 0
  }
}

// Kept as a compatibility hook for logout/session-refresh callers. Auth
// context data is intentionally not cached because revocations and role
// changes must take effect on the next verified request.
export function invalidateUserSession(userId: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUTH-CACHE] No session cache to invalidate for ${userId}`)
  }
}

// Invalidate all sessions (call on global events).
export function invalidateAllSessions(): void {
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
  // The function remains async for callers that already await it, but does
  // not retain user/profile data in a process-global cache.
  void user
  void profile
}
