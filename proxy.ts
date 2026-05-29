// ============================================
// proxy.ts (Root level) - Next.js 16 Proxy
// Enhanced with security features for Phase 7
// ============================================
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
    if (pathname.startsWith('/admin') || pathname.startsWith('/moderator') || pathname.startsWith('/employee') || pathname.startsWith('/mobile') || pathname.startsWith('/dashboard')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
    }

    return response
}

// ============================================
// Main Proxy Function
// ============================================
export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

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
    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: { headers: request.headers },
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

    const { data: { user } } = await supabase.auth.getUser()

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

    // Protected routes
    // Protected routes based on role prefixes
    const isAdminRoute = pathname.startsWith('/admin')
    const isModeratorRoute = pathname.startsWith('/moderator')
    const isEmployeeRoute = pathname.startsWith('/employee')
    // Any dashboard-related route is considered a protected route
    const isProtectedRoute = isAdminRoute || isModeratorRoute || isEmployeeRoute

    const isLoginRoute = pathname === '/login'
    const isDeactiveAccountRoute = pathname === '/deactive-account'

    // Redirect to login if not authenticated on a protected route
    if (!user && isProtectedRoute) {
        return redirectWithCookies('/login')
    }

    // Redirect authenticated users from login page to their dashboard
    if (user && isLoginRoute) {
        // Fetch user profile to determine role for proper dashboard redirect
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role === 'admin') {
            return redirectWithCookies('/admin')
        } else if (profile?.role === 'moderator') {
            return redirectWithCookies('/moderator')
        } else if (profile?.role === 'employee') {
            return redirectWithCookies('/employee')
        } else {
            // Fallback to moderator dashboard for unknown roles
            return redirectWithCookies('/moderator')
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

    // Also handle /mobile route auth (uses employee check)
    const isMobileRoute = pathname.startsWith('/mobile')
    if (!user && isMobileRoute) {
        console.warn(`[PROXY-AUTH] Redirecting unauthenticated request on mobile route ${pathname} to /login`)
        return redirectWithCookies('/login')
    }

    // Status and Role-based access control for authenticated users
    if (user && (isProtectedRoute || isDeactiveAccountRoute)) {
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('id', user.id)
            .single()

        if (profileErr) {
            console.error(`[PROXY-DB] Profile fetch failed for authenticated user ${user.id}:`, profileErr.message)
        }

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

        if (isAdminRoute && profile.role !== 'admin') {
            console.warn(`[PROXY-AUTH] Admin route access denied for role ${profile.role}. Redirecting to /${profile.role}`)
            return redirectWithCookies('/' + profile.role)
        }

        if (isModeratorRoute && profile.role !== 'moderator' && profile.role !== 'admin') {
            console.warn(`[PROXY-AUTH] Moderator route access denied for role ${profile.role}. Redirecting to /${profile.role}`)
            return redirectWithCookies('/' + profile.role)
        }

        if (isEmployeeRoute && profile.role !== 'employee') {
            console.warn(`[PROXY-AUTH] Employee route access denied for role ${profile.role}. Redirecting to /${profile.role}`)
            return redirectWithCookies('/' + profile.role)
        }
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
