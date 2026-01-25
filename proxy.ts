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
        /on\w+\s*=/i,                // Event handlers
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
    if (pathname.startsWith('/admin') || pathname.startsWith('/moderator') || pathname.startsWith('/employee') || pathname.startsWith('/dashboard')) {
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
        return NextResponse.redirect(new URL('/login', request.url))
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
            return NextResponse.redirect(new URL('/admin', request.url))
        } else if (profile?.role === 'moderator') {
            return NextResponse.redirect(new URL('/moderator', request.url))
        } else if (profile?.role === 'employee') {
            return NextResponse.redirect(new URL('/employee', request.url))
        } else {
            // Fallback to moderator dashboard for unknown roles
            return NextResponse.redirect(new URL('/moderator', request.url))
        }
    }

    // ============================================
    // Mobile Device Detection for Employee Route
    // ============================================
    if (user && isEmployeeRoute) {
        // Check if user wants to stay on desktop version
        const wantsDesktop = request.nextUrl.searchParams.get('desktop') === 'true'

        if (!wantsDesktop) {
            // Detect mobile devices via User-Agent
            const userAgent = request.headers.get('user-agent') || ''
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(userAgent)

            // Redirect mobile users to /mobile
            if (isMobile && !pathname.startsWith('/mobile')) {
                const mobileUrl = new URL('/mobile', request.url)
                return NextResponse.redirect(mobileUrl)
            }
        }
    }

    // Also handle /mobile route auth (uses employee check)
    const isMobileRoute = pathname.startsWith('/mobile')
    if (!user && isMobileRoute) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Status and Role-based access control for authenticated users
    if (user && (isProtectedRoute || isDeactiveAccountRoute)) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('id', user.id)
            .single()

        if (!profile) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // Redirect deactive users to /deactive-account
        if (profile.status === 'deactive' && !isDeactiveAccountRoute) {
            return NextResponse.redirect(new URL('/deactive-account', request.url))
        }

        // Redirect active users away from /deactive-account
        if (profile.status === 'active' && isDeactiveAccountRoute) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        if (isAdminRoute && profile.role !== 'admin') {
            return NextResponse.redirect(new URL('/' + profile.role, request.url))
        }

        if (isModeratorRoute && profile.role !== 'moderator' && profile.role !== 'admin') {
            return NextResponse.redirect(new URL('/' + profile.role, request.url))
        }

        if (isEmployeeRoute && profile.role !== 'employee') {
            return NextResponse.redirect(new URL('/' + profile.role, request.url))
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
