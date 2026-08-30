import { db } from '@/lib/db'
import { biometricVerificationAttempts } from '@/lib/db/schema'
import { lt } from 'drizzle-orm'

export interface BiometricVerificationAttemptInput {
    source: 'pwa' | 'kiosk'
    profileId?: string | null
    outcome: string
    similarity?: number | null
    threshold?: number | null
    reasonCode?: string | null
    faceCount?: number | null
    frameCount?: number | null
    livenessPassed?: boolean | null
    qualityScore?: number | null
    qualityDiagnostics?: Record<string, unknown> | null
    capturePipelineVersion?: string | null
    embeddingPipelineVersion?: string | null
    backendEngine?: string | null
    processingMs?: number | null
    requestId?: string | null
}

/**
 * Writes diagnostic metadata without ever persisting images, embeddings,
 * liveness challenges, or raw request payloads. Audit failures must never
 * block a biometric decision or attendance action.
 */
export async function recordBiometricVerificationAttempt(input: BiometricVerificationAttemptInput): Promise<void> {
    try {
        await db.insert(biometricVerificationAttempts).values({
            profile_id: input.profileId ?? null,
            source: input.source,
            outcome: input.outcome,
            similarity: input.similarity == null ? null : String(input.similarity),
            threshold: input.threshold == null ? null : String(input.threshold),
            reason_code: input.reasonCode ?? null,
            face_count: input.faceCount ?? null,
            frame_count: input.frameCount ?? null,
            liveness_passed: input.livenessPassed ?? null,
            quality_score: input.qualityScore ?? null,
            quality_diagnostics: input.qualityDiagnostics ?? null,
            capture_pipeline_version: input.capturePipelineVersion ?? null,
            embedding_pipeline_version: input.embeddingPipelineVersion ?? null,
            backend_engine: input.backendEngine ?? null,
            processing_ms: input.processingMs ?? null,
            request_id: input.requestId ?? null,
        })
        await db.delete(biometricVerificationAttempts).where(
            lt(biometricVerificationAttempts.created_at, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
        )
    } catch (error) {
        console.error('[BiometricAudit] Could not record verification attempt:', error)
    }
}
