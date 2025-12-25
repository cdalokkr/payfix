// ============================================
// lib/security/csrf-protection.ts
// Comprehensive CSRF protection with token validation
// ============================================
import crypto from 'crypto'
import { cookies } from 'next/headers'

export interface CSRFToken {
  token: string
  expiresAt: Date
  sessionId: string
  userId?: string
}

export interface CSRFConfig {
  tokenLength: number
  tokenExpiryMinutes: number
  sessionTimeoutMinutes: number
  secure: boolean
  sameSite: 'strict' | 'lax' | 'none'
  httpOnly: boolean
}

export class CSRFProtection {
  private config: CSRFConfig
  private tokenStore: Map<string, CSRFToken> = new Map()
  private maxTokensPerSession = 5

  constructor(config?: Partial<CSRFConfig>) {
    this.config = {
      tokenLength: 32,
      tokenExpiryMinutes: 60,
      sessionTimeoutMinutes: 30,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      httpOnly: true,
      ...config
    }
  }

  // Generate a new CSRF token
  generateToken(sessionId: string, userId?: string): string {
    const token = crypto.randomBytes(this.config.tokenLength).toString('hex')
    const expiresAt = new Date(Date.now() + this.config.tokenExpiryMinutes * 60 * 1000)

    const csrfToken: CSRFToken = {
      token,
      expiresAt,
      sessionId,
      userId
    }

    // Clean up old tokens for this session
    this.cleanupSessionTokens(sessionId)

    // Store token
    this.tokenStore.set(token, csrfToken)

    return token
  }

  // Validate CSRF token
  validateToken(token: string, sessionId: string, userId?: string): boolean {
    if (!token) return false

    const storedToken = this.tokenStore.get(token)
    if (!storedToken) return false

    // Check expiration
    if (new Date() > storedToken.expiresAt) {
      this.tokenStore.delete(token)
      return false
    }

    // Validate session
    if (storedToken.sessionId !== sessionId) {
      return false
    }

    // Validate user if provided
    if (userId && storedToken.userId && storedToken.userId !== userId) {
      return false
    }

    return true
  }

  // Get CSRF token for response headers
  getTokenHeader(token: string): Record<string, string> {
    return {
      'X-CSRF-Token': token,
      'X-Request-ID': crypto.randomBytes(16).toString('hex')
    }
  }

  // Create CSRF cookie
  createCSRFCookie(token: string): string {
    const cookieOptions = [
      `CSRF-Token=${token}`,
      `Path=/`,
      `Max-Age=${this.config.tokenExpiryMinutes * 60}`,
      `HttpOnly=${this.config.httpOnly ? 'true' : 'false'}`,
      `SameSite=${this.config.sameSite}`,
    ]

    if (this.config.secure) {
      cookieOptions.push('Secure')
    }

    return cookieOptions.join('; ')
  }

  // Extract token from request
  extractToken(request: Request): string | null {
    // Check Authorization header
    const authHeader = request.headers.get('authorization')
    if (authHeader?.toLowerCase().startsWith('csrf-token ')) {
      return authHeader.substring('csrf-token '.length).trim()
    }

    // Check X-CSRF-Token header
    const csrfHeader = request.headers.get('x-csrf-token')
    if (csrfHeader) {
      return csrfHeader.trim()
    }

    // Check form data (for form submissions)
    // Note: This would need to be implemented based on your form handling
    return null
  }

  // Middleware for CSRF protection
  createCSRFMiddleware() {
    return async (request: Request, context: { sessionId: string, userId?: string }) => {
      // Skip CSRF check for safe methods
      const method = request.method.toUpperCase()
      const safeMethods = ['GET', 'HEAD', 'OPTIONS']
      
      if (safeMethods.includes(method)) {
        return { valid: true, token: null }
      }

      const token = this.extractToken(request)
      if (!token) {
        return { 
          valid: false, 
          error: 'CSRF token missing',
          status: 403 
        }
      }

      const isValid = this.validateToken(token, context.sessionId, context.userId)
      if (!isValid) {
        return { 
          valid: false, 
          error: 'Invalid or expired CSRF token',
          status: 403 
        }
      }

      return { valid: true, token }
    }
  }

  // Clean up expired tokens
  private cleanupSessionTokens(sessionId: string): void {
    const now = new Date()
    const tokensToDelete: string[] = []

    for (const [token, tokenData] of this.tokenStore.entries()) {
      if (tokenData.sessionId === sessionId) {
        if (now > tokenData.expiresAt) {
          tokensToDelete.push(token)
        }
      }
    }

    // Remove expired tokens
    tokensToDelete.forEach(token => this.tokenStore.delete(token))

    // If still too many tokens, remove oldest ones
    const sessionTokens = Array.from(this.tokenStore.entries())
      .filter(([_, data]) => data.sessionId === sessionId)
      .sort((a, b) => a[1].expiresAt.getTime() - b[1].expiresAt.getTime())

    if (sessionTokens.length > this.maxTokensPerSession) {
      const tokensToRemove = sessionTokens.slice(0, sessionTokens.length - this.maxTokensPerSession)
      tokensToRemove.forEach(([token]) => this.tokenStore.delete(token))
    }
  }

  // Invalidate all tokens for a session
  invalidateSessionTokens(sessionId: string): void {
    const tokensToDelete: string[] = []

    for (const [token, tokenData] of this.tokenStore.entries()) {
      if (tokenData.sessionId === sessionId) {
        tokensToDelete.push(token)
      }
    }

    tokensToDelete.forEach(token => this.tokenStore.delete(token))
  }

  // Invalidate all tokens for a user
  invalidateUserTokens(userId: string): void {
    const tokensToDelete: string[] = []

    for (const [token, tokenData] of this.tokenStore.entries()) {
      if (tokenData.userId === userId) {
        tokensToDelete.push(token)
      }
    }

    tokensToDelete.forEach(token => this.tokenStore.delete(token))
  }

  // Get statistics
  getStats(): { totalTokens: number, activeTokens: number, expiredTokens: number } {
    const now = new Date()
    let activeTokens = 0
    let expiredTokens = 0

    for (const tokenData of this.tokenStore.values()) {
      if (now > tokenData.expiresAt) {
        expiredTokens++
      } else {
        activeTokens++
      }
    }

    return {
      totalTokens: this.tokenStore.size,
      activeTokens,
      expiredTokens
    }
  }
}

// Singleton instance
let csrfProtection: CSRFProtection | null = null

export function getCSRFProtection(): CSRFProtection {
  if (!csrfProtection) {
    csrfProtection = new CSRFProtection()
  }
  return csrfProtection
}

// Utility functions for common CSRF operations
export async function validateCSRFRequest(
  request: Request, 
  sessionId: string, 
  userId?: string
): Promise<{ valid: boolean, error?: string, status?: number }> {
  const csrf = getCSRFProtection()
  const middleware = csrf.createCSRFMiddleware()
  return await middleware(request, { sessionId, userId })
}

export function generateCSRFToken(sessionId: string, userId?: string): string {
  const csrf = getCSRFProtection()
  return csrf.generateToken(sessionId, userId)
}

export function createCSRFResponseHeaders(token: string): Record<string, string> {
  const csrf = getCSRFProtection()
  return csrf.getTokenHeader(token)
}