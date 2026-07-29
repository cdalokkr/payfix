// ============================================
// lib/proxy/security.ts - Proxy Security & Validation
// ============================================
import { NextResponse, type NextRequest } from 'next/server'

export function validateRequest(request: NextRequest): { valid: boolean; reason?: string } {
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
        /\bon\w+\s*=/i,              // Event handlers
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

export function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
    const requestId = crypto.randomUUID()
    response.headers.set('X-Request-ID', requestId)

    const pathname = request.nextUrl.pathname
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/api/trpc')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
    }

    return response
}
