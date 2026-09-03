import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const PROOF_TTL_MS = 2 * 60 * 1000

type AttendanceProofPayload = {
  subject: string
  tenantId: string
  action: 'clock_in' | 'clock_out'
  localDate: string
  verificationRequestId: string
  embeddingPipelineVersion: string
  jti: string
  exp: number
}

const consumedProofs = new Map<string, number>()

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET is required for biometric attendance')
  return value
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function cleanupConsumedProofs(now: number) {
  for (const [jti, expiresAt] of consumedProofs) {
    if (expiresAt <= now) consumedProofs.delete(jti)
  }
}

export function issueAttendanceProof(
  input: Omit<AttendanceProofPayload, 'jti' | 'exp'>
) {
  const payload = Buffer.from(JSON.stringify({
    ...input,
    jti: randomUUID(),
    exp: Date.now() + PROOF_TTL_MS,
  })).toString('base64url')

  return `${payload}.${sign(payload)}`
}

export function consumeAttendanceProof(
  token: unknown,
  expected: Pick<AttendanceProofPayload, 'subject' | 'tenantId' | 'action' | 'localDate'>
): Omit<AttendanceProofPayload, 'exp'> | null {
  if (typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expectedSignature = sign(payload)
  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AttendanceProofPayload
    const now = Date.now()
    cleanupConsumedProofs(now)

    if (
      !parsed.jti ||
      consumedProofs.has(parsed.jti) ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= now ||
      parsed.subject !== expected.subject ||
      parsed.tenantId !== expected.tenantId ||
      parsed.action !== expected.action ||
      parsed.localDate !== expected.localDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsed.localDate) ||
      typeof parsed.verificationRequestId !== 'string' ||
      typeof parsed.embeddingPipelineVersion !== 'string' ||
      !/^[a-z0-9-]{8,80}$/i.test(parsed.embeddingPipelineVersion)
    ) return null

    consumedProofs.set(parsed.jti, parsed.exp)
    return {
      subject: parsed.subject,
      tenantId: parsed.tenantId,
      action: parsed.action,
      localDate: parsed.localDate,
      verificationRequestId: parsed.verificationRequestId,
      embeddingPipelineVersion: parsed.embeddingPipelineVersion,
      jti: parsed.jti,
    }
  } catch {
    return null
  }
}