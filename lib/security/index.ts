// ============================================
// lib/security/index.ts
// Security utilities for the application
// ============================================

/**
 * Sanitize user input to prevent XSS attacks
 * Use this for any user-provided content that will be displayed
 */
export function sanitizeInput(input: string): string {
    if (!input) return ''

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
    if (!email) return ''

    // Remove any HTML tags and trim
    const cleaned = email.replace(/<[^>]*>/g, '').trim().toLowerCase()

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleaned)) {
        throw new Error('Invalid email format')
    }

    return cleaned
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
}

/**
 * Sanitize SQL-like input (additional layer of protection)
 * Note: Always use parameterized queries - this is just an extra safety layer
 */
export function sanitizeSQLInput(input: string): string {
    if (!input) return ''

    // Remove common SQL injection patterns
    return input
        .replace(/'/g, "''")
        .replace(/;/g, '')
        .replace(/--/g, '')
        .replace(/\/\*/g, '')
        .replace(/\*\//g, '')
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash sensitive data for logging (don't log actual values)
 */
export function hashForLogging(value: string): string {
    if (!value) return '[empty]'
    if (value.length <= 4) return '[short]'

    return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
}

/**
 * Validate password strength
 */
export interface PasswordValidationResult {
    isValid: boolean
    score: number
    feedback: string[]
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
    const feedback: string[] = []
    let score = 0

    if (!password) {
        return { isValid: false, score: 0, feedback: ['Password is required'] }
    }

    // Length check
    if (password.length >= 8) score++
    else feedback.push('Password must be at least 8 characters')

    if (password.length >= 12) score++
    if (password.length >= 16) score++

    // Character variety
    if (/[a-z]/.test(password)) score++
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(password)) score++
    else feedback.push('Add uppercase letters')

    if (/[0-9]/.test(password)) score++
    else feedback.push('Add numbers')

    if (/[^a-zA-Z0-9]/.test(password)) score++
    else feedback.push('Add special characters')

    // Common patterns to avoid
    const commonPatterns = [
        /^123/,
        /password/i,
        /qwerty/i,
        /abc123/i,
        /admin/i,
        /letmein/i,
    ]

    for (const pattern of commonPatterns) {
        if (pattern.test(password)) {
            score = Math.max(0, score - 2)
            feedback.push('Avoid common password patterns')
            break
        }
    }

    return {
        isValid: score >= 4 && password.length >= 8,
        score: Math.min(score, 7),
        feedback,
    }
}

/**
 * Check if a URL is safe for redirect
 */
export function isSafeRedirectUrl(url: string, allowedHosts: string[] = []): boolean {
    if (!url) return false

    // Allow relative URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
        return true
    }

    try {
        const parsed = new URL(url)

        // Check against allowed hosts
        if (allowedHosts.length > 0) {
            return allowedHosts.includes(parsed.host)
        }

        // By default, only allow same-origin
        return false
    } catch {
        // Invalid URL
        return false
    }
}

/**
 * Mask sensitive data in objects for logging
 */
export function maskSensitiveData<T extends Record<string, unknown>>(
    obj: T,
    sensitiveKeys: string[] = ['password', 'token', 'secret', 'key', 'authorization', 'cookie']
): T {
    const masked = { ...obj }

    for (const key of Object.keys(masked)) {
        const lowerKey = key.toLowerCase()

        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
            masked[key as keyof T] = '[REDACTED]' as T[keyof T]
        } else if (typeof masked[key] === 'object' && masked[key] !== null) {
            masked[key as keyof T] = maskSensitiveData(
                masked[key] as Record<string, unknown>,
                sensitiveKeys
            ) as T[keyof T]
        }
    }

    return masked
}

/**
 * Validate content type
 */
export function isValidContentType(contentType: string | null, allowedTypes: string[]): boolean {
    if (!contentType) return false

    const normalizedType = contentType.toLowerCase().split(';')[0].trim()
    return allowedTypes.some(type => normalizedType === type || normalizedType.startsWith(type))
}

/**
 * Security headers for API responses
 */
export const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
} as const

/**
 * Apply security headers to a Response
 */
export function applySecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers)

    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        headers.set(key, value)
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    })
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
    return generateSecureToken(32)
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, storedToken: string): boolean {
    if (!token || !storedToken) return false
    return timingSafeEqual(token, storedToken)
}