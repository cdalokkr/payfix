import { createServerSupabaseClient, createSupabaseClientSync } from '@/lib/supabase/server'
import type { Profile } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createHash } from 'crypto'
import { db, centralDb } from '@/lib/db'
import { profiles, designations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  hasValidTenantHealthProbeToken,
  isTenantHealthOperator,
} from '@/lib/auth/tenant-health-policy'
import {
  getTrustedTenantStore,
  resolveTrustedTenantBySlug,
  resolveTrustedTenantFromRequest,
  type TrustedTenantContext,
} from '@/lib/tenant/trusted-context'
import { tenantStorage } from '@/lib/tenant/store'

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
  tenant: TrustedTenantContext | null
  metrics: AuthPerformanceMetrics
}

// Session cache for optimizing repeated requests
interface SessionCache {
  user: User
  profile: Profile | null
  tenantId?: string
  tenantSlug?: string
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

interface ProfileResolution {
  profile: Profile | null
  tenant: TrustedTenantContext | null
}

function mapProfile(result: any): Profile {
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
      created_at: result.designation.created_at?.toISOString?.() || result.designation.created_at || null,
      updated_at: result.designation.updated_at?.toISOString?.() || result.designation.updated_at || null,
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
    created_at: result.created_at?.toISOString?.() || result.created_at || null,
    updated_at: result.updated_at?.toISOString?.() || result.updated_at || null,
  } as Profile
}

/**
 * Resolve a profile in the selected tenant schema. The registry-backed
 * context is used for the direct query; the cross-schema RPC is only a
 * user-bound recovery path when a stale host/cookie selected another tenant.
 */
async function preloadProfile(
  profileId: string,
  tenantContext: TrustedTenantContext | null,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<ProfileResolution> {
  let result: any = null
  let resolvedTenant = tenantContext

  if (tenantContext?.tenantSchema) {
    try {
      result = await tenantStorage.run(tenantContext, async () => {
        // The tenant DB proxy reads AsyncLocalStorage when its properties are
        // accessed, so resolve the query only after entering the tenant scope.
        const tenantProfileQuery = (db as any).query?.profiles?.findFirst
        return typeof tenantProfileQuery === 'function'
          ? tenantProfileQuery({
              where: eq(profiles.id, profileId),
              with: { designation: true },
            })
          : null
      })
    } catch (error) {
      console.error('[AUTH] Tenant profile lookup failed:', error)
    }
  }

  if (!result) {
    try {
      const { data: profileJson, error } = await supabase.rpc('find_profile_across_schemas', {
        target_user_id: profileId,
      })
      if (error) throw error
      if (profileJson) {
        const discoveredTenant = await resolveTrustedTenantBySlug((profileJson as any).tenant_slug)
        if (discoveredTenant) {
          resolvedTenant = discoveredTenant
          result = profileJson
        }
      }
    } catch (error) {
      console.error('[AUTH] User-bound tenant profile lookup failed:', error)
    }
  }

  // Public profiles are a control-plane source only for platform super-admins.
  if (!result) {
    const centralProfileQuery = (centralDb as any).query?.profiles?.findFirst
    const centralResult = typeof centralProfileQuery === 'function'
      ? await centralProfileQuery({
          where: eq(profiles.id, profileId),
          with: { designation: true },
        })
      : null
    if (centralResult?.role === 'super_admin') {
      result = centralResult
      resolvedTenant = null
    }
  }

  return {
    profile: result ? mapProfile(result) : null,
    tenant: resolvedTenant,
  }
}

// Optimized context creation with async session management
export async function createOptimizedContext(
  req?: Request,
  requestedTenant?: TrustedTenantContext | null,
) {
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
      const responseCookieStore = await cookies()
      cookieStore = {
        getAll: () => parsed,
        get: (name: string) => {
          const match = parsed.find(c => c.name === name)
          return match ? { name, value: match.value } : undefined
        },
        set: (name: string, value: string, options?: any) => {
          // Request-bound contexts still need to persist Supabase session
          // cookies for login and token-refresh mutations handled by tRPC.
          // The incoming Request remains the source for reads, while the
          // Next.js cookie store owns response Set-Cookie headers.
          try {
            responseCookieStore.set(name, value, options)
          } catch {
            // Server component callers may expose a read-only cookie store.
          }
        }
      } as any;
    } else {
      cookieStore = await cookies()
      try {
        authHeader = (await headers()).get('authorization')
      } catch {
        // No request headers are available in non-request callers.
      }
    }

    // Do not consult any request-bound cache until Supabase has verified the
    // cookie or bearer token below.
    const allCookies = cookieStore.getAll()
    const hasAuthCookie = allCookies.some((c: any) => c.name.includes('-auth-token'))
    let cookieHash = ''
    if (hasAuthCookie) {
      cookieHash = await getCookieHash(cookieStore)
    }
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
        tenant: requestedTenant || getTrustedTenantStore(),
        metrics: finalMetrics
      }
    }

    // Authenticate first. In particular, a bearer token is never decoded
    // locally and is never allowed to select a user-ID cache entry.
    const tClientStart = performance.now();
    if (!_lazySupabase) {
      _lazySupabase = createSupabaseClientSync(
        cookieStore as any,
        hasBearerToken ? authHeader!.substring(7) : undefined,
      );
    }
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
        tenant: requestedTenant || getTrustedTenantStore(),
        metrics: finalMetrics
      }
    }

    const userId = user.id

    const tenantContext = requestedTenant || getTrustedTenantStore() || await resolveTrustedTenantFromRequest(req)
    const cachedSession = cookieHash ? getCachedSession(cookieHash) : null
    const cacheMatchesVerifiedRequest = Boolean(
      cachedSession &&
      cachedSession.user.id === user.id &&
      tenantContext &&
      cachedSession.tenantId === tenantContext.tenantId,
    )
    if (cacheMatchesVerifiedRequest) {
      const finalMetrics = endAuthTiming(metrics, {
        userFound: true,
        profileFound: !!cachedSession!.profile,
        cacheHit: true,
        contextSize: cachedSession!.metrics.contextSize
      })

      return {
        supabase,
        user,
        profile: cachedSession!.profile,
        tenant: tenantContext,
        metrics: finalMetrics
      }
    }

    // Fetch the profile from the registry-selected tenant, not from public.
    const resolution = await preloadProfile(userId, tenantContext, supabase)
    const profile = resolution.profile
    const resolvedTenant = resolution.tenant

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
      tenant: resolvedTenant,
      metrics: finalMetrics
    }

    // Cache successful session and profile
    setCachedSession(cookieHash, userId, {
      user,
      profile,
      tenantId: resolvedTenant?.tenantId,
      tenantSlug: resolvedTenant?.slug,
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
      tenant: requestedTenant || getTrustedTenantStore(),
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
  // Clear every cookie-hash entry for the user. A user may have multiple
  // devices, so clearing only the most recently observed hash is insufficient
  // after a role or status change.
  userIdSessionCache.delete(userId)
  let removed = 0
  for (const [cacheKey, session] of sessionCache.entries()) {
    if (session.user?.id === userId) {
      sessionCache.delete(cacheKey)
      removed++
    }
  }
  userToHashCache.delete(userId)
  console.log(`[AUTH-CACHE] Invalidated ${removed} session entr${removed === 1 ? 'y' : 'ies'} for ${userId}`)
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
    const tenantContext = getTrustedTenantStore()

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
      tenantId: tenantContext?.tenantId,
      tenantSlug: tenantContext?.slug,
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
