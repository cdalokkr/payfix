import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TTL_MS = 45_000
const FRAME_COUNT = 3
const usedChallenges = new Map<string, number>()

function secret() {
    const value = process.env.SESSION_SECRET
    if (!value) throw new Error('SESSION_SECRET is required for biometric challenges')
    return value
}

function sign(payload: string) {
    return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function issueLivenessChallenge(subject: string, purpose: 'attendance' | 'enrollment') {
    const exp = Date.now() + TTL_MS
    const nonce = randomBytes(24).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ nonce, subject, purpose, exp })).toString('base64url')
    return { challenge: `${payload}.${sign(payload)}`, frameCount: FRAME_COUNT, expiresAt: exp }
}

export function consumeLivenessChallenge(token: unknown, subject: string, purpose: 'attendance' | 'enrollment') {
    if (typeof token !== 'string') return { ok: false as const, code: 'LIVENESS_CHALLENGE_REQUIRED' }
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return { ok: false as const, code: 'INVALID_LIVENESS_CHALLENGE' }
    const expected = sign(payload)
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return { ok: false as const, code: 'INVALID_LIVENESS_CHALLENGE' }
    }
    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
            nonce: string; subject: string; purpose: string; exp: number
        }
        const now = Date.now()
        if (parsed.subject !== subject || parsed.purpose !== purpose || parsed.exp <= now) {
            return { ok: false as const, code: 'EXPIRED_LIVENESS_CHALLENGE' }
        }
        const priorUse = usedChallenges.get(parsed.nonce)
        if (priorUse && priorUse > now) return { ok: false as const, code: 'LIVENESS_CHALLENGE_REPLAYED' }
        usedChallenges.set(parsed.nonce, parsed.exp)
        for (const [nonce, expiry] of usedChallenges) if (expiry <= now) usedChallenges.delete(nonce)
        return { ok: true as const }
    } catch {
        return { ok: false as const, code: 'INVALID_LIVENESS_CHALLENGE' }
    }
}

export const LIVENESS_FRAME_COUNT = FRAME_COUNT