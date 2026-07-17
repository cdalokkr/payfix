// ============================================
// proxy.ts (Root level) - Next.js 16 Proxy
// Enhanced with security features for Phase 7
// ============================================
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveTenant } from '@/lib/tenant/resolver'

// ============================================
// Request Validation
// ============================================
function validateRequest(request: NextRequest): { valid: boolean; reason?: string } {
    const url = request.nextUrl.pathname + request.nextUrl.search

    // Check for null byte injection
    if (url.includes('%00')) {
        return { valid: false, reason: 'Null byte injection detected' }
    }

    // Block common attack patterns
    const suspiciousPatterns = [
        /\.\.\//,                    // Path traversal
        /<script/i,                  // XSS attempt in URL
        /javascript:/i,              // JavaScript protocol
        /vbscript:/i,                // VBScript protocol
        /\bon\w+\s*=/i,              // Event handlers (word-boundary to avoid false positives like "month=")
        /union\s+select/i,           // SQL injection
        /;\s*drop\s+/i,              // SQL injection
        /;\s*delete\s+/i,            // SQL injection
    ]

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(url)) {
            return { valid: false, reason: 'Suspicious request pattern detected' }
        }
    }

    return { valid: true }
}

// ============================================
// Security Headers
// ============================================
function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
    // Add request ID for tracing
    const requestId = crypto.randomUUID()
    response.headers.set('X-Request-ID', requestId)

    // Prevent caching of authenticated pages
    const pathname = request.nextUrl.pathname
    if (pathname.startsWith('/admin') || pathname.startsWith('/moderator') || pathname.startsWith('/employee') || pathname.startsWith('/mobile') || pathname.startsWith('/dashboard') || pathname.startsWith('/superadmin')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
    }

    return response
}

// ============================================
// Proxy Session Cache for Performance Optimization
// ============================================
interface ProxySession {
    user: any
    profile: any
    expiresAt: number
}

const proxySessionCache = new Map<string, ProxySession>()
const PROXY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Generate a fast pure-JS hash of the auth cookies to avoid Node crypto dependency in Edge runtime
function getProxyCookieHash(request: NextRequest): string {
    try {
        const allCookies = request.cookies.getAll()
        const authCookies = allCookies
            .filter(c => c.name.includes('-auth-token'))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => `${c.name}=${c.value}`)
            .join(';')

        if (!authCookies) return ''

        // DJB2 hash of the auth cookies string
        let hash = 5381
        for (let i = 0; i < authCookies.length; i++) {
            hash = (hash * 33) ^ authCookies.charCodeAt(i)
        }
        return (hash >>> 0).toString(16)
    } catch {
        return ''
    }
}

// ============================================
// Role to Dashboard Path Mapping
// Maps DB role values to their correct URL paths.
// NOTE: 'super_admin' maps to /superadmin (no underscore in URL).
// ============================================
function roleToDashboardPath(role: string): string {
    switch (role) {
        case 'super_admin': return '/superadmin'
        case 'admin':       return '/admin'
        case 'moderator':   return '/moderator'
        case 'employee':    return '/employee'
        default:            return '/admin'
    }
}

// ============================================
// Main Proxy Function
// ============================================
export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const hostname = request.headers.get('host') || ''
    const url = request.nextUrl.clone()

    // 1. Resolve Tenant from Hostname or Fallbacks (Query Param / Cookie) for testing environments
    let tenant = await resolveTenant(hostname);
    let resolvedViaFallback = false;
    const queryTenant = request.nextUrl.searchParams.get('tenant');
    const cookieTenant = request.cookies.get('tenant_fallback')?.value;

    // Handle explicit tenant clearing
    if (queryTenant === 'none') {
        const cleanUrl = new URL(request.url);
        cleanUrl.searchParams.delete('tenant');
        const response = NextResponse.redirect(cleanUrl);
        response.cookies.delete('tenant_fallback');
        return response;
    }

    if (!tenant) {
        const fallbackSlug = queryTenant || cookieTenant;
        if (fallbackSlug) {
            tenant = await resolveTenant(fallbackSlug);
            if (tenant) {
                resolvedViaFallback = true;
            }
        }
    }

    // Override primary catch-all with tenant_fallback cookie.
    // When accessing via localhost or *.vercel.app, the hostname resolves to 'primary' (the
    // platform tenant). But if a user previously logged in and their profile was discovered
    // in a different tenant schema, a tenant_fallback cookie was set. We must respect it
    // so admins/moderators/employees access their own business workspace, not primary.
    if (tenant && tenant.slug === 'primary' && cookieTenant && cookieTenant !== 'primary') {
        const overrideTenant = await resolveTenant(cookieTenant);
        if (overrideTenant) {
            tenant = overrideTenant;
            resolvedViaFallback = true;
            if (process.env.NODE_ENV === 'development') {
                console.log(`[PROXY-TENANT] Overriding primary catch-all with tenant_fallback cookie: ${cookieTenant} → ${overrideTenant.tenant_schema}`);
            }
        }
    }

    // Redirect to clean URL if tenant was passed via query parameter to prevent URL cluttering
    if (queryTenant && tenant && queryTenant === tenant.slug) {
        const cleanUrl = new URL(request.url);
        cleanUrl.searchParams.delete('tenant');
        const response = NextResponse.redirect(cleanUrl);
        response.cookies.set('tenant_fallback', tenant.slug, {
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });
        return response;
    }
    
    // Redirect if tenant not found but trying to access subdomains
    const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'payfix.com';
    const hostWithoutPort = hostname.split(':')[0].toLowerCase();
    const isMainDomain = 
        hostWithoutPort === mainDomain || 
        hostWithoutPort === `www.${mainDomain}` || 
        hostWithoutPort.endsWith('.vercel.app') ||
        hostWithoutPort === 'localhost' ||
        hostWithoutPort === '127.0.0.1';
    
    if (!tenant && !isMainDomain) {
        return new NextResponse('Workspace Not Found', { status: 404 });
    }

    // 2. Gatekeeper: Expiry and Suspension Check
    if (tenant) {
        const isExpiredPage = pathname === '/license-expired';
        
        const isSuspended = tenant.status === 'suspended' || tenant.status === 'cancelled';
        let isLicenseExpired = false;
        
        if (tenant.license_expires_at) {
            const expiryTime = new Date(tenant.license_expires_at).getTime();
            if (Date.now() > expiryTime) {
                isLicenseExpired = true;
            }
        } else if (tenant.status === 'trial') {
            const trialExpiry = new Date(tenant.trial_start);
            trialExpiry.setDate(trialExpiry.getDate() + tenant.trial_duration_days);
            if (Date.now() > trialExpiry.getTime()) {
                isLicenseExpired = true;
            }
        }

        if (isSuspended || isLicenseExpired) {
            if (!isExpiredPage && !pathname.startsWith('/api/')) {
                const expiredUrl = new URL('/license-expired', request.url);
                return NextResponse.redirect(expiredUrl);
            }
        } else {
            // Redirect away from /license-expired if active
            if (isExpiredPage) {
                const homeUrl = new URL('/', request.url);
                return NextResponse.redirect(homeUrl);
            }
        }
    }

    // 3. Dynamic Manifest Rewrite
    if (pathname === '/manifest.json' && tenant) {
        url.pathname = '/api/manifest';
        url.searchParams.set('tenant', tenant.slug);
        return NextResponse.rewrite(url);
    }

    // ============================================
    // 1. Request Validation
    // ============================================
    const validation = validateRequest(request)
    if (!validation.valid) {
        console.warn(`[SECURITY] Blocked request: ${validation.reason}`)
        return new NextResponse(
            JSON.stringify({ error: 'Bad Request', message: validation.reason }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // ============================================
    // 2. CSRF Protection for mutations
    // ============================================
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        const origin = request.headers.get('origin')
        const host = request.headers.get('host')

        if (origin && host) {
            try {
                const originHost = new URL(origin).host
                if (originHost !== host && process.env.NODE_ENV === 'production') {
                    console.warn(`[SECURITY] Origin mismatch: ${origin} vs ${host}`)
                    return new NextResponse(
                        JSON.stringify({ error: 'Forbidden', message: 'Invalid origin' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }
                    )
                }
            } catch {
                // Invalid origin URL, block in production
                if (process.env.NODE_ENV === 'production') {
                    return new NextResponse(
                        JSON.stringify({ error: 'Forbidden', message: 'Invalid origin' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }
                    )
                }
            }
        }
    }

    // ============================================
    // 4. Authentication & Authorization
    // ============================================
    // Anti-spoofing: Strip incoming request headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-user-id')
    requestHeaders.delete('x-user-email')
    requestHeaders.delete('x-user-profile')

    // Strip incoming client-side tenant headers to prevent header injection
    requestHeaders.delete('x-tenant-id')
    requestHeaders.delete('x-tenant-slug')
    requestHeaders.delete('x-tenant-db-url')
    requestHeaders.delete('x-tenant-schema')
    requestHeaders.delete('x-tenant-brand')
    requestHeaders.delete('x-tenant-theme')
    requestHeaders.delete('x-tenant-license-expires-at')

    if (tenant) {
        requestHeaders.set('x-tenant-id', tenant.id);
        requestHeaders.set('x-tenant-slug', tenant.slug);
        requestHeaders.set('x-tenant-db-url', tenant.database_url || '');
        requestHeaders.set('x-tenant-schema', tenant.tenant_schema || '');
        requestHeaders.set('x-tenant-brand', tenant.branding?.app_name || tenant.company_name);
        requestHeaders.set('x-tenant-license-expires-at', tenant.license_expires_at ? new Date(tenant.license_expires_at).toISOString() : '');
        requestHeaders.set('x-tenant-theme', JSON.stringify({
            primary: tenant.branding?.primary_color || '#4f46e5',
            secondary: tenant.branding?.secondary_color || '#0f172a',
            logo: tenant.branding?.logo_url || '/logo.png'
        }));
    }

    let response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: false,
                detectSessionInUrl: false,
            },
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: { headers: requestHeaders },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, {
                            ...options,
                            // Enhanced cookie security
                            secure: process.env.NODE_ENV === 'production',
                            httpOnly: true,
                            sameSite: 'lax',
                        })
                    )
                },
            },
        }
    )

    // Helper to perform redirects while preserving session cookies
    const redirectWithCookies = (url: string | URL) => {
        const redirectResponse = NextResponse.redirect(new URL(url, request.url))
        response.cookies.getAll().forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value, {
                path: cookie.path,
                domain: cookie.domain,
                maxAge: cookie.maxAge,
                expires: cookie.expires,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
            })
        })
        return redirectResponse
    }

    // Protected routes based on role prefixes
    const isSuperAdminRoute = pathname.startsWith('/superadmin')
    const isAdminRoute = pathname.startsWith('/admin')
    const isModeratorRoute = pathname.startsWith('/moderator')
    const isEmployeeRoute = pathname.startsWith('/employee')
    const isProtectedRoute = isSuperAdminRoute || isAdminRoute || isModeratorRoute || isEmployeeRoute

    const isLoginRoute = pathname === '/login'
    const isDeactiveAccountRoute = pathname === '/deactive-account'

    // Optimized resolution with memory caching to bypass slow Supabase network calls
    const cookieHash = getProxyCookieHash(request)

    // Invalidate proxy session cache immediately if this is a logout request
    if (cookieHash && pathname.includes('auth.logout')) {
        proxySessionCache.delete(cookieHash)
        if (process.env.NODE_ENV === 'development') {
            console.log(`[PROXY-CACHE] Invalidated session on logout for hash ${cookieHash.substring(0, 8)}...`)
        }
    }

    // Invalidate proxy session cache on login requests to prevent stale profile=null from being served
    // After a successful login, the next page navigation must re-resolve the profile from the DB
    if (cookieHash && pathname.includes('auth.login') && request.method === 'POST') {
        proxySessionCache.delete(cookieHash)
        if (process.env.NODE_ENV === 'development') {
            console.log(`[PROXY-CACHE] Invalidated stale session on login for hash ${cookieHash.substring(0, 8)}...`)
        }
    }

    let cached = cookieHash ? proxySessionCache.get(cookieHash) : null

    if (cached && Date.now() > cached.expiresAt) {
        proxySessionCache.delete(cookieHash)
        cached = null
    }

    let user: any = null
    let profile: any = null

    if (cached) {
        user = cached.user
        profile = cached.profile
        if (process.env.NODE_ENV === 'development') {
            console.log(`[PROXY-CACHE] Hit for hash ${cookieHash.substring(0, 8)}... (role: ${profile?.role})`)
        }
    } else {
        const tStart = performance.now()
        let authData: { user: any } | null = null
        try {
            const { data } = await supabase.auth.getUser()
            authData = data
        } catch (err) {
            console.error('[PROXY-AUTH] Error fetching user session:', err)
        }
        user = authData?.user || null

        if (user) {
            // Fetch full profile (including designation) dynamically from tenant schema or public fallback
            let dbProfile: any = null;

            // Check public.profiles first to see if this is a platform-wide super_admin
            const { data: publicProfile } = await supabase
                .from('profiles')
                .select('*, designation:designations(*)')
                .eq('id', user.id)
                .maybeSingle();

            if (publicProfile && publicProfile.role === 'super_admin') {
                dbProfile = publicProfile;
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[PROXY-AUTH] Super Admin resolved via public.profiles for user: ${user.id}`);
                }
            }

            // If not a super_admin, look up in tenant-specific schema if tenant context exists
            if (!dbProfile && tenant && tenant.tenant_schema) {
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_from_schema', {
                    schema_name: tenant.tenant_schema,
                    user_id: user.id
                });
                if (!rpcError && rpcData) {
                    dbProfile = rpcData;
                } else if (rpcError) {
                    console.error('[PROXY-RPC] Error calling get_profile_from_schema:', rpcError);
                }
            }

            // Cross-schema scan fallback: If profile not found in current tenant schema,
            // scan ALL active tenant schemas in a single DB round-trip via RPC.
            // This handles new signups where the user registered on a different tenant
            // but is logging in from localhost/Vercel (which resolves to primary).
            // Uses SECURITY DEFINER function to bypass RLS and avoid PostgREST restrictions.
            if (!dbProfile) {
                const { data: scanResult, error: scanError } = await supabase.rpc('find_profile_across_schemas', {
                    target_user_id: user.id
                });

                if (!scanError && scanResult) {
                    dbProfile = scanResult;
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[PROXY-AUTH] Cross-schema scan found profile in: ${scanResult.tenant_schema} (slug: ${scanResult.tenant_slug})`);
                    }

                    // CRITICAL: Override tenant context to the user's actual workspace.
                    // Without this, all tRPC/API calls would route to tenant_primary,
                    // showing wrong data or empty dashboards.
                    if (scanResult.tenant_slug && scanResult.tenant_slug !== tenant?.slug) {
                        const discoveredTenant = await resolveTenant(scanResult.tenant_slug);
                        if (discoveredTenant) {
                            tenant = discoveredTenant;
                            // Update request headers so downstream tRPC handlers use correct tenant
                            requestHeaders.set('x-tenant-id', discoveredTenant.id);
                            requestHeaders.set('x-tenant-slug', discoveredTenant.slug);
                            requestHeaders.set('x-tenant-db-url', discoveredTenant.database_url || '');
                            requestHeaders.set('x-tenant-schema', discoveredTenant.tenant_schema || '');
                            requestHeaders.set('x-tenant-brand', discoveredTenant.branding?.app_name || discoveredTenant.company_name);
                            requestHeaders.set('x-tenant-license-expires-at', discoveredTenant.license_expires_at ? new Date(discoveredTenant.license_expires_at).toISOString() : '');
                            requestHeaders.set('x-tenant-theme', JSON.stringify({
                                primary: discoveredTenant.branding?.primary_color || '#4f46e5',
                                secondary: discoveredTenant.branding?.secondary_color || '#0f172a',
                                logo: discoveredTenant.branding?.logo_url || '/logo.png'
                            }));
                            if (process.env.NODE_ENV === 'development') {
                                console.log(`[PROXY-TENANT] Switched tenant context: primary → ${discoveredTenant.slug} (${discoveredTenant.tenant_schema}) for user ${user.id}`);
                            }
                        }
                    }
                } else if (scanError) {
                    console.error('[PROXY-AUTH] Cross-schema scan RPC error:', scanError);
                }
            }

            // Fallback to public schema profile if not found in any tenant schema
            if (!dbProfile && publicProfile) {
                dbProfile = publicProfile;
            }

            profile = dbProfile ? {
                ...dbProfile,
                designation: Array.isArray(dbProfile.designation)
                    ? dbProfile.designation[0] || null
                    : dbProfile.designation
            } : null

            if (cookieHash) {
                proxySessionCache.set(cookieHash, {
                    user,
                    profile,
                    expiresAt: Date.now() + PROXY_CACHE_TTL
                })
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[PROXY-CACHE] Set for user ${user.id} (hash: ${cookieHash.substring(0, 8)}... took ${(performance.now() - tStart).toFixed(2)}ms)`)
                }
            }
        }
    }

    if (user) {
        requestHeaders.set('x-user-id', user.id)
        requestHeaders.set('x-user-email', user.email || '')
        if (profile) {
            requestHeaders.set('x-user-profile', JSON.stringify(profile))
        }

        const oldResponse = response
        response = NextResponse.next({
            request: { headers: requestHeaders },
        })
        oldResponse.cookies.getAll().forEach(cookie => {
            response.cookies.set(cookie.name, cookie.value, {
                path: cookie.path,
                domain: cookie.domain,
                maxAge: cookie.maxAge,
                expires: cookie.expires,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
            })
        })

        // Manage tenant_fallback cookie based on user's actual workspace:
        // - On logout: delete it for clean re-login
        // - On non-primary profile: set it so future requests route to correct workspace
        // - On primary profile with stale cookie: delete it to stop unnecessary cross-schema scans
        if (pathname.includes('auth.logout')) {
            response.cookies.delete('tenant_fallback');
        } else if (profile?.tenant_slug && profile.tenant_slug !== 'primary') {
            response.cookies.set('tenant_fallback', profile.tenant_slug, {
                path: '/',
                maxAge: 60 * 60 * 24 * 7, // 1 week
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });
        } else if (cookieTenant && cookieTenant !== 'primary') {
            // User belongs to primary but stale tenant_fallback exists from a previous session.
            // Clear it so future requests don't override to the wrong tenant.
            response.cookies.delete('tenant_fallback');
        }
    }

    // Redirect to login if not authenticated on a protected route
    if (!user && isProtectedRoute) {
        return redirectWithCookies('/login')
    }

    // Redirect authenticated users from login page to their dashboard
    if (user && isLoginRoute) {
        // Guard: If user has no profile, let them stay on login page to prevent redirect loop
        // This happens when auth user exists but profile entry is missing in tenant schema
        if (!profile) {
            console.warn(`[PROXY-AUTH] Authenticated user ${user.id} has no profile — staying on login page to prevent redirect loop`)
            return addSecurityHeaders(response, request)
        }

        if (profile?.role === 'super_admin') {
            return redirectWithCookies('/superadmin')
        } else if (profile?.role === 'admin') {
            return redirectWithCookies('/admin')
        } else if (profile?.role === 'moderator') {
            const isStandalonePwa = request.cookies.get('pwa_standalone')?.value === 'true'
            if (isStandalonePwa) {
                return redirectWithCookies('/mobile')
            }
            return redirectWithCookies('/moderator')
        } else if (profile?.role === 'employee') {
            const userAgent = request.headers.get('user-agent') || ''
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(userAgent)
            const isStandalonePwa = request.cookies.get('pwa_standalone')?.value === 'true'
            const paramDesktop = request.nextUrl.searchParams.get('desktop')
            const cookieDesktop = request.cookies.get('desktop_mode')?.value
            const wantsDesktop = !isStandalonePwa && (paramDesktop === 'true' || (paramDesktop !== 'false' && cookieDesktop === 'true'))

            if (isMobile && !wantsDesktop) {
                return redirectWithCookies('/mobile')
            }
            return redirectWithCookies('/employee')
        } else {
            // Fallback to admin dashboard for unknown roles
            return redirectWithCookies('/admin')
        }
    }

    // ============================================
    // Mobile Device Detection for Employee & Moderator Routes
    // ============================================
    if (user && (isEmployeeRoute || isModeratorRoute)) {
        const paramDesktop = request.nextUrl.searchParams.get('desktop')
        const cookieDesktop = request.cookies.get('desktop_mode')?.value
        const isStandalonePwa = request.cookies.get('pwa_standalone')?.value === 'true'

        // Wants desktop if param is explicitly 'true' or (param is not 'false' and cookie is 'true'), BUT only if NOT in PWA standalone mode
        const wantsDesktop = !isStandalonePwa && (paramDesktop === 'true' || (paramDesktop !== 'false' && cookieDesktop === 'true'))

        if (!wantsDesktop) {
            // Detect mobile devices via User-Agent
            const userAgent = request.headers.get('user-agent') || ''
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(userAgent)

            // Redirect mobile users to /mobile, preserving search parameters
            if (isMobile && !pathname.startsWith('/mobile')) {
                // Employee is always redirected to mobile layout on mobile screens
                // Moderator is ONLY redirected to mobile layout if launching the standalone PWA
                const shouldRedirect = isEmployeeRoute || (isModeratorRoute && isStandalonePwa)

                if (shouldRedirect) {
                    const searchParams = request.nextUrl.search ? request.nextUrl.search : ''
                    const mobileUrl = new URL('/mobile' + searchParams, request.url)
                    console.log(`[PROXY-MOBILE] Redirecting mobile user (${user.id}) from ${pathname} to ${mobileUrl.pathname}${searchParams} (PWA standalone: ${isStandalonePwa})`)
                    return redirectWithCookies(mobileUrl)
                } else if (isModeratorRoute) {
                    console.log(`[PROXY-MOBILE] Moderator (${user.id}) on mobile browser, allowing full desktop backoffice access at ${pathname} (wantsDesktop: ${wantsDesktop})`)
                }
            }
        }
    }

    // Also handle /mobile route auth and role-based redirects
    const isMobileRoute = pathname.startsWith('/mobile')
    if (!user && isMobileRoute) {
        console.warn(`[PROXY-AUTH] Redirecting unauthenticated request on mobile route ${pathname} to /login`)
        return redirectWithCookies('/login')
    }

    if (user && isMobileRoute) {
        if (!profile) {
            console.warn(`[PROXY-AUTH] Redirecting to /login because no profile was found for authenticated user: ${user.id}`)
            return redirectWithCookies('/login')
        }

        // Moderator is redirected to /moderator if they are accessing /mobile from a browser (not standalone PWA)
        if (profile.role === 'moderator') {
            const isStandalonePwa = request.cookies.get('pwa_standalone')?.value === 'true'
            if (!isStandalonePwa) {
                console.log(`[PROXY-MOBILE] Moderator (${user.id}) on mobile browser accessing mobile route ${pathname}, redirecting to /moderator for backoffice access`)
                return redirectWithCookies('/moderator')
            }
        } else if (profile.role !== 'employee') {
            // Other roles (like admin/super_admin) are not allowed on /mobile, redirect to their home
            console.log(`[PROXY-MOBILE] Non-mobile role ${profile.role} accessing mobile route ${pathname}, redirecting to ${roleToDashboardPath(profile.role)}`)
            return redirectWithCookies(roleToDashboardPath(profile.role))
        }
    }

    // Status and Role-based access control for authenticated users
    if (user && (isProtectedRoute || isDeactiveAccountRoute)) {
        if (!profile) {
            console.warn(`[PROXY-AUTH] Redirecting to /login because no profile was found for authenticated user: ${user.id}`)
            return redirectWithCookies('/login')
        }

        // Redirect deactive users to /deactive-account
        if (profile.status === 'deactive' && !isDeactiveAccountRoute) {
            console.warn(`[PROXY-AUTH] Redirecting deactive user (${user.id}) to /deactive-account`)
            return redirectWithCookies('/deactive-account')
        }

        // Redirect active users away from /deactive-account
        if (profile.status === 'active' && isDeactiveAccountRoute) {
            console.log(`[PROXY-AUTH] Redirecting active user (${user.id}) away from /deactive-account`)
            return redirectWithCookies('/')
        }

        if (isSuperAdminRoute && profile.role !== 'super_admin') {
            console.warn(`[PROXY-AUTH] Super Admin route access denied for role ${profile.role}. Redirecting to ${roleToDashboardPath(profile.role)}`)
            return redirectWithCookies(roleToDashboardPath(profile.role))
        }

        if (isAdminRoute && profile.role !== 'admin' && profile.role !== 'super_admin') {
            console.warn(`[PROXY-AUTH] Admin route access denied for role ${profile.role}. Redirecting to ${roleToDashboardPath(profile.role)}`)
            return redirectWithCookies(roleToDashboardPath(profile.role))
        }

        if (isModeratorRoute && profile.role !== 'moderator' && profile.role !== 'admin' && profile.role !== 'super_admin') {
            console.warn(`[PROXY-AUTH] Moderator route access denied for role ${profile.role}. Redirecting to ${roleToDashboardPath(profile.role)}`)
            return redirectWithCookies(roleToDashboardPath(profile.role))
        }

        if (isEmployeeRoute && profile.role !== 'employee' && profile.role !== 'moderator' && profile.role !== 'admin' && profile.role !== 'super_admin') {
            console.warn(`[PROXY-AUTH] Employee route access denied for role ${profile.role}. Redirecting to ${roleToDashboardPath(profile.role)}`)
            return redirectWithCookies(roleToDashboardPath(profile.role))
        }
    }

    if (tenant && response) {
        response.headers.set('x-tenant-id', tenant.id);
        response.headers.set('x-tenant-slug', tenant.slug);
        response.headers.set('x-tenant-brand', tenant.branding?.app_name || tenant.company_name);
    }

    // ============================================
    // 5. Add Security Headers
    // ============================================
    return addSecurityHeaders(response, request)
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
