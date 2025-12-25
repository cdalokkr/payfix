// ============================================
// lib/security/secure-session.ts
// Enhanced session management with JWT and security features
// ============================================
import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface SessionToken {
  access_token: string
  refresh_token?: string
  expires_at?: number
  token_type: 'bearer'
  user: {
    id: string
    email: string
    role?: string
    [key: string]: any
  }
}

export interface SessionSecurity {
  ipAddress: string
  userAgent: string
  deviceFingerprint?: string
  location?: string
  trustLevel: 'high' | 'medium' | 'low'
  lastActivity: Date
  riskScore: number
}

export interface SecureSessionConfig {
  jwtSecret: string | Uint8Array
  accessTokenExpiry: number // in seconds
  refreshTokenExpiry: number // in seconds
  maxConcurrentSessions: number
  sessionValidationInterval: number // in seconds
  requireDeviceFingerprint: boolean
  enableSessionRotation: boolean
  sessionTimeoutWarningMinutes: number
}

export class SecureSessionManager {
  private config: SecureSessionConfig
  private activeSessions = new Map<string, {
    token: SessionToken
    security: SessionSecurity
    createdAt: Date
    lastValidated: Date
  }>()

  constructor(config?: Partial<SecureSessionConfig>) {
    // Convert secret to Uint8Array for jose
    const secret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
    const jwtSecret = config?.jwtSecret
      ? (typeof config.jwtSecret === 'string'
        ? new TextEncoder().encode(config.jwtSecret)
        : config.jwtSecret)
      : new TextEncoder().encode(secret)

    this.config = {
      ...config,
      accessTokenExpiry: 15 * 60, // 15 minutes
      refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
      maxConcurrentSessions: 5,
      sessionValidationInterval: 60, // 1 minute
      requireDeviceFingerprint: true,
      enableSessionRotation: true,
      sessionTimeoutWarningMinutes: 5,
      jwtSecret: jwtSecret // Always Uint8Array
    }
  }

  // Helper to ensure jwtSecret is always Uint8Array
  private getJwtSecret(): Uint8Array {
    return this.config.jwtSecret as Uint8Array
  }

  // Create a new secure session
  async createSession(
    user: { id: string; email: string; role?: string },
    request: Request,
    additionalData?: Record<string, any>
  ): Promise<SessionToken> {
    const security = await this.createSecurityContext(request)

    // Generate device fingerprint
    const deviceFingerprint = this.config.requireDeviceFingerprint
      ? this.generateDeviceFingerprint(request)
      : undefined

    const sessionId = crypto.randomUUID()

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      deviceFingerprint,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.accessTokenExpiry,
      ...additionalData
    }

    const accessToken = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('my-fullstack-app')
      .setAudience('authenticated-users')
      .setExpirationTime(payload.exp)
      .sign(this.getJwtSecret())

    const refreshToken = await this.generateRefreshToken(user.id, sessionId)

    const sessionToken: SessionToken = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: payload.exp,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        ...additionalData
      }
    }

    // Store session with security context
    this.activeSessions.set(sessionId, {
      token: sessionToken,
      security: {
        ...security,
        deviceFingerprint,
        lastActivity: new Date()
      },
      createdAt: new Date(),
      lastValidated: new Date()
    })

    // Clean up old sessions if exceeding limit
    await this.cleanupOldSessions(user.id)

    return sessionToken
  }

  // Validate and refresh session
  async validateSession(accessToken: string, request: Request): Promise<{
    valid: boolean
    session?: SessionToken
    error?: string
    riskLevel?: 'high' | 'medium' | 'low'
  }> {
    try {
      // Verify and decode token
      const { payload: decoded } = await jwtVerify(accessToken, this.getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: 'my-fullstack-app',
        audience: 'authenticated-users'
      }) as any

      const sessionId = decoded.sessionId
      const userId = decoded.sub

      // Get stored session
      const session = this.activeSessions.get(sessionId)
      if (!session) {
        return { valid: false, error: 'Session not found' }
      }

      // Validate token matches
      if (session.token.access_token !== accessToken) {
        return { valid: false, error: 'Token mismatch' }
      }

      // Check session expiry
      if (Date.now() / 1000 > (decoded.exp as number)) {
        this.activeSessions.delete(sessionId)
        return { valid: false, error: 'Session expired' }
      }

      // Security validation
      const currentSecurity = await this.createSecurityContext(request)
      const riskLevel = this.assessSessionRisk(session.security, currentSecurity)

      // Update session activity
      session.security.lastActivity = new Date()
      session.lastValidated = new Date()

      // Check for suspicious activity
      if (riskLevel === 'high') {
        await this.logSecurityEvent('high_risk_session', {
          userId,
          sessionId,
          previousSecurity: session.security,
          currentSecurity,
          riskLevel
        })
        return { valid: false, error: 'High risk activity detected', riskLevel }
      }

      return {
        valid: true,
        session: session.token,
        riskLevel
      }

    } catch (error: any) {
      if (error.name === 'JwtMalformed') {
        return { valid: false, error: 'Invalid token format' }
      }
      if (error.name === 'JwtExpired') {
        return { valid: false, error: 'Token expired' }
      }
      if (error.name === 'JwtInvalid') {
        return { valid: false, error: 'Invalid token' }
      }
      return { valid: false, error: 'Session validation failed' }
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean
    newToken?: SessionToken
    error?: string
  }> {
    try {
      // Verify refresh token
      const { payload: decoded } = await jwtVerify(refreshToken, this.getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: 'my-fullstack-app',
        audience: 'refresh-tokens'
      }) as any

      const { userId, sessionId } = decoded

      // Get existing session
      const session = this.activeSessions.get(sessionId)
      if (!session || session.token.refresh_token !== refreshToken) {
        return { success: false, error: 'Invalid refresh token' }
      }

      // Create new access token
      const payload = {
        sub: session.token.user.id,
        email: session.token.user.email,
        role: session.token.user.role,
        sessionId,
        deviceFingerprint: session.security.deviceFingerprint,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.config.accessTokenExpiry
      }

      const newAccessToken = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('my-fullstack-app')
        .setAudience('authenticated-users')
        .setExpirationTime(payload.exp)
        .sign(this.getJwtSecret())

      // Update session
      session.token.access_token = newAccessToken
      session.token.expires_at = payload.exp
      session.security.lastActivity = new Date()

      await this.logSecurityEvent('token_refreshed', {
        userId,
        sessionId
      })

      return {
        success: true,
        newToken: session.token
      }

    } catch (error: any) {
      return { success: false, error: 'Refresh token invalid' }
    }
  }

  // Terminate session
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      await this.logSecurityEvent('session_terminated', {
        userId: session.token.user.id,
        sessionId,
        duration: Date.now() - session.createdAt.getTime()
      })
    }
    this.activeSessions.delete(sessionId)
  }

  // Get active sessions for user
  getUserSessions(userId: string) {
    return Array.from(this.activeSessions.entries())
      .filter(([_, session]) => session.token.user.id === userId)
      .map(([sessionId, session]) => ({
        sessionId,
        ...session,
        duration: Date.now() - session.createdAt.getTime(),
        lastActivity: session.security.lastActivity
      }))
  }

  // Security context creation
  private async createSecurityContext(request: Request): Promise<SessionSecurity> {
    const ipAddress = this.getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    return {
      ipAddress,
      userAgent,
      trustLevel: this.assessDeviceTrust(userAgent),
      lastActivity: new Date(),
      riskScore: 0
    }
  }

  // Device fingerprinting
  private generateDeviceFingerprint(request: Request): string {
    const userAgent = request.headers.get('user-agent') || ''
    const accept = request.headers.get('accept') || ''
    const acceptLanguage = request.headers.get('accept-language') || ''
    const acceptEncoding = request.headers.get('accept-encoding') || ''

    const fingerprint = `${userAgent}|${accept}|${acceptLanguage}|${acceptEncoding}`
    return crypto.createHash('sha256').update(fingerprint).digest('hex')
  }

  // Risk assessment (simplified - no IP-based restrictions)
  private assessSessionRisk(
    previous: SessionSecurity,
    current: SessionSecurity
  ): 'high' | 'medium' | 'low' {
    let riskScore = 0

    // User agent change
    if (previous.userAgent !== current.userAgent) {
      riskScore += 20
    }

    // Device fingerprint change
    if (previous.deviceFingerprint && current.deviceFingerprint &&
      previous.deviceFingerprint !== current.deviceFingerprint) {
      riskScore += 25
    }

    // Time-based risk
    const timeDiff = Date.now() - previous.lastActivity.getTime()
    if (timeDiff > 60 * 60 * 1000) { // 1 hour gap
      riskScore += 15
    }

    if (riskScore >= 60) return 'high'
    if (riskScore >= 30) return 'medium'
    return 'low'
  }

  // Device trust assessment
  private assessDeviceTrust(userAgent: string): 'high' | 'medium' | 'low' {
    if (!userAgent || userAgent === 'unknown') return 'low'

    const trustedBrowsers = ['Chrome', 'Firefox', 'Safari', 'Edge']
    const isTrusted = trustedBrowsers.some(browser =>
      userAgent.includes(browser)
    )

    return isTrusted ? 'high' : 'medium'
  }

  // Helper methods
  private async generateRefreshToken(userId: string, sessionId: string): Promise<string> {
    const payload = {
      sub: userId,
      sessionId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenExpiry
    }

    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('my-fullstack-app')
      .setAudience('refresh-tokens')
      .setExpirationTime(payload.exp)
      .sign(this.getJwtSecret())
  }

  private getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    const realIP = request.headers.get('x-real-ip')
    if (realIP) {
      return realIP
    }

    return 'unknown'
  }

  private async cleanupOldSessions(userId: string): Promise<void> {
    const userSessions = this.getUserSessions(userId)

    if (userSessions.length > this.config.maxConcurrentSessions) {
      // Sort by last activity and remove oldest
      const sortedSessions = userSessions.sort((a, b) =>
        a.lastActivity.getTime() - b.lastActivity.getTime()
      )

      const sessionsToRemove = sortedSessions.slice(0,
        userSessions.length - this.config.maxConcurrentSessions)

      for (const session of sessionsToRemove) {
        this.activeSessions.delete(session.sessionId)
      }
    }
  }

  private async logSecurityEvent(event: string, data: any): Promise<void> {
    console.log(`[SECURITY] ${event}:`, data)
    // In production, send to your logging/monitoring system
  }

  // Get session statistics
  getSessionStats() {
    return {
      totalActive: this.activeSessions.size,
      byTrustLevel: {
        high: Array.from(this.activeSessions.values()).filter(s => s.security.trustLevel === 'high').length,
        medium: Array.from(this.activeSessions.values()).filter(s => s.security.trustLevel === 'medium').length,
        low: Array.from(this.activeSessions.values()).filter(s => s.security.trustLevel === 'low').length
      },
      averageRiskScore: Array.from(this.activeSessions.values())
        .reduce((sum, s) => sum + s.security.riskScore, 0) / this.activeSessions.size || 0
    }
  }
}

// Singleton instance
let secureSessionManager: SecureSessionManager | null = null

export function getSecureSessionManager(): SecureSessionManager {
  if (!secureSessionManager) {
    secureSessionManager = new SecureSessionManager()
  }
  return secureSessionManager
}