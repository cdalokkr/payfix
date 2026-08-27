import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const PROOF_TTL_MS = 10 * 60 * 1000

type EnrollmentProofPayload = {
  subject: string
  portraitUrl: string
  portraitSha256: string
  embedding512: number[]
  embeddingPipelineVersion: string
  qualityScore: number
  exp: number
}

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET is required for biometric enrollment')
  return value
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function sha256Hex(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Binds the server-generated 512-d enrollment template to the exact canonical
 * portrait. The browser can carry this proof to tRPC, but cannot alter either.
 */
export function issueEnrollmentProof(input: Omit<EnrollmentProofPayload, 'exp'>) {
  const payload = Buffer.from(JSON.stringify({ ...input, exp: Date.now() + PROOF_TTL_MS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function consumeEnrollmentProof(
  token: unknown,
  expected: { subject: string; portraitUrl: string }
): Omit<EnrollmentProofPayload, 'exp'> | null {
  if (typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expectedSignature = sign(payload)
  if (signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as EnrollmentProofPayload
    if (
      parsed.exp <= Date.now() ||
      parsed.subject !== expected.subject ||
      parsed.portraitUrl !== expected.portraitUrl ||
      !Array.isArray(parsed.embedding512) ||
      parsed.embedding512.length !== 512 ||
      !parsed.embedding512.every(Number.isFinite) ||
      typeof parsed.embeddingPipelineVersion !== 'string' ||
      !/^[a-z0-9-]{8,80}$/i.test(parsed.embeddingPipelineVersion) ||
      typeof parsed.portraitSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(parsed.portraitSha256)
    ) return null
    return {
      subject: parsed.subject,
      portraitUrl: parsed.portraitUrl,
      portraitSha256: parsed.portraitSha256,
      embedding512: parsed.embedding512,
      embeddingPipelineVersion: parsed.embeddingPipelineVersion,
      qualityScore: Number.isFinite(parsed.qualityScore) ? parsed.qualityScore : 0,
    }
  } catch {
    return null
  }
}