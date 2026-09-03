import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { FaceServiceClient } from '@/lib/face-service-client'
import { findFrameFailure, hasDistinctNaturalFrames, selectBestValidatedFrame } from '@/lib/biometric-frame-validation'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'
import { tenantStorage } from '@/lib/tenant/store'
import { consumeLivenessChallenge, LIVENESS_FRAME_COUNT } from '@/lib/liveness-challenge'
import { ProfileService } from '@/lib/services/profile.service'
import { recordBiometricVerificationAttempt } from '@/lib/services/biometric-verification-attempt.service'
import { issueAttendanceProof } from '@/lib/biometric-attendance-proof'
import { getLocalDateIST } from '@/lib/utils/date-utils'

// Keep attendance aligned with the current shared capture contract. The
// enrollment route accepts the migration alias as well, so an installed PWA
// must not be rejected merely because it reports the current v2 pipeline.
const NATURAL_PORTRAIT_PIPELINES = new Set(['natural-portrait-v1', 'natural-portrait-3x4-v2'])

const SELFIE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,/

function averageNormalizedEmbeddings(embeddings: number[][]): number[] | null {
    if (!embeddings.length || embeddings.some(vector => vector.length !== 512 || vector.some(value => !Number.isFinite(value)))) return null
    const average = Array.from({ length: 512 }, (_, index) =>
        embeddings.reduce((sum, vector) => sum + vector[index], 0) / embeddings.length
    )
    const norm = Math.sqrt(average.reduce((sum, value) => sum + value * value, 0))
    return norm > 0 ? average.map(value => value / norm) : null
}

export async function POST(request: NextRequest) {
    return runWithRequestHeaders(async () => {
        const tenant = tenantStorage.getStore()
        if (!tenant?.tenantId) {
            return NextResponse.json({ error: 'Tenant context is required for biometric verification.' }, { status: 400 })
        }
        const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
        const auditStartedAt = Date.now()
        let auditProfileId: string | null = null
        let auditFrameCount = 0
        let auditCapturePipelineVersion: string | null = null
        const respond = async (body: any, init?: { status?: number }) => {
            const verification = body?.verification || {}
            const code = typeof body?.code === 'string'
                ? body.code
                : (typeof body?.error === 'string' && /^[A-Z0-9_]+$/.test(body.error) ? body.error : null)
            const similarity = typeof body?.similarity === 'number' && body.similarity > 0 ? body.similarity : null
            const outcome = body?.matched === true
                ? 'matched'
                : code?.includes('PIPELINE') || code?.includes('TEMPLATE')
                    ? 'pipeline_rejected'
                    : code?.includes('LIVENESS')
                        ? 'liveness_failed'
                        : similarity !== null && typeof body?.threshold === 'number'
                            ? 'similarity_rejected'
                            : code?.includes('FACE_') || code?.includes('QUALITY')
                                ? 'face_quality_failed'
                                : body?.error
                                    ? 'request_rejected'
                                    : 'request_failed'
            await recordBiometricVerificationAttempt({
                source: 'pwa',
                profileId: auditProfileId,
                outcome,
                similarity,
                threshold: typeof body?.threshold === 'number' ? body.threshold : null,
                reasonCode: code,
                faceCount: typeof verification.faceCount === 'number' ? verification.faceCount : (typeof body?.face_detected === 'boolean' ? (body.face_detected ? 1 : 0) : null),
                frameCount: auditFrameCount || null,
                livenessPassed: typeof body?.is_live === 'boolean' ? body.is_live : (typeof verification.livenessPassed === 'boolean' ? verification.livenessPassed : null),
                qualityScore: typeof body?.quality_score === 'number' ? body.quality_score : null,
                qualityDiagnostics: body?.diagnostics && typeof body.diagnostics === 'object' ? body.diagnostics : null,
                capturePipelineVersion: auditCapturePipelineVersion,
                embeddingPipelineVersion: typeof body?.embedding_pipeline_version === 'string' ? body.embedding_pipeline_version : null,
                backendEngine: typeof verification.backend === 'string'
                    ? verification.backend
                    : (typeof body?.diagnostics?.backend_engine === 'string' ? body.diagnostics.backend_engine : null),
                processingMs: Date.now() - auditStartedAt,
                requestId,
            })
            return NextResponse.json(body, init)
        }
    try {
        const { frames, selfieBase64, challenge, biometricPipelineVersion, action } = await request.json()
        if (action !== 'clock_in' && action !== 'clock_out') {
            return respond({ error: 'A valid attendance action is required.', code: 'ATTENDANCE_ACTION_REQUIRED' }, { status: 400 })
        }
        auditFrameCount = Array.isArray(frames) ? frames.length : (typeof selfieBase64 === 'string' ? 1 : 0)
        auditCapturePipelineVersion = typeof biometricPipelineVersion === 'string' ? biometricPipelineVersion : null
        const capturePipeline = biometricPipelineVersion
        if (!NATURAL_PORTRAIT_PIPELINES.has(String(capturePipeline))) {
            return respond({ error: 'Update the camera flow and submit a natural portrait frame.', code: 'UNSUPPORTED_BIOMETRIC_PIPELINE' }, { status: 400 })
        }
        const submittedFrames = Array.isArray(frames) ? frames : (typeof selfieBase64 === 'string' ? [selfieBase64] : [])
        if (submittedFrames.length !== LIVENESS_FRAME_COUNT || submittedFrames.some(frame => typeof frame !== 'string' || !SELFIE_DATA_URL.test(frame))) {
            return respond({ error: 'Three natural camera frames are required.', code: 'LIVENESS_FRAMES_REQUIRED' }, { status: 400 })
        }
        if (submittedFrames.some(frame => frame.length > 7_000_000)) {
            return respond({ error: 'Camera image is too large. Please retake the selfie.' }, { status: 413 })
        }

        if (!hasDistinctNaturalFrames(submittedFrames)) {
            return respond({ matched: false, is_live: false, error: 'Capture three distinct natural camera frames. Please retake the selfie.', code: 'LIVENESS_FRAMES_NOT_DISTINCT' }, { status: 400 })
        }

        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) auditProfileId = user.id
        if (!user) return respond({ error: 'Unauthorized' }, { status: 401 })
        const challengeResult = consumeLivenessChallenge(challenge, user.id, 'attendance')
        if (!challengeResult.ok) return respond({ matched: false, is_live: false, error: 'Liveness challenge failed or expired.', code: challengeResult.code }, { status: 403 })

        // Versioning was added after the first develop templates were created.
        // Ensure the additive columns exist before requesting them from Drizzle.
        await ProfileService.ensurePhotoRequestsSchema()
        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            columns: { face_embedding_512: true, face_embedding_pipeline_version: true },
        })
        const stored = profile?.face_embedding_512 as number[] | null
        if (!stored || stored.length !== 512 || !stored.every(Number.isFinite)) {
            return respond({ error: 'Your approved profile has no valid biometric template. Please submit a new profile photo.' }, { status: 400 })
        }

        const extractions = await Promise.all(submittedFrames.map(frame => FaceServiceClient.extract(frame, { includeCroppedFace: false })))
        const frameFailure = findFrameFailure(extractions)
        if (frameFailure) {
            const failedFrame = frameFailure.result
            return respond({
                matched: false, similarity: 0, is_live: false, face_detected: failedFrame.face_detected,
                canonical_portrait_base64: failedFrame.canonical_portrait_base64 || null,
                canonical_portrait_aspect_ratio: failedFrame.canonical_portrait_aspect_ratio || null,
                diagnostics: failedFrame.diagnostics,
                quality_score: failedFrame.quality_score ?? null,
                error: 'Frame ' + (frameFailure.index + 1) + ': ' + frameFailure.message,
                code: frameFailure.code
            }, { status: 400 })
        }
        const extraction = selectBestValidatedFrame(extractions)
        if (!extraction) return respond({ matched: false, is_live: false, error: 'No valid server-processed frame was available.', code: 'FACE_EXTRACTION_FAILED' }, { status: 400 })
        const selfie = averageNormalizedEmbeddings(extractions.map(item =>
            item.embedding_512 || (item.embedding?.length === 512 ? item.embedding : [])
        ))
        if (!extraction.success || !extraction.face_detected || extraction.face_count !== 1 || !selfie || selfie.length !== 512) {
            return respond({
                matched: false, similarity: 0, is_live: false, face_detected: false,
                error: extraction.error_message || 'Exactly one clear face is required.',
                code: extraction.error_code || 'FACE_EXTRACTION_FAILED',
                diagnostics: extraction.diagnostics,
                quality_score: extraction.quality_score ?? null,
            })
        }
        const embeddingPipelineVersion = extraction.embedding_pipeline_version
        if (!embeddingPipelineVersion || profile?.face_embedding_pipeline_version !== embeddingPipelineVersion) {
            return respond({
                matched: false,
                similarity: 0,
                is_live: false,
                face_detected: true,
                error: 'Your approved profile photo uses an older biometric format. Please submit a new profile photo for approval before checking in.',
                code: 'BIOMETRIC_TEMPLATE_REENROLLMENT_REQUIRED',
            }, { status: 409 })
        }
        if (extraction.is_live !== true) {
            return respond({
                matched: false, similarity: 0, is_live: false, face_detected: true,
                canonical_portrait_base64: extraction.canonical_portrait_base64 || null,
                canonical_portrait_aspect_ratio: extraction.canonical_portrait_aspect_ratio || null,
                error: 'Liveness verification failed. Please retake your selfie.',
                diagnostics: extraction.diagnostics,
                quality_score: extraction.quality_score ?? null,
            })
        }
        if (!extraction.canonical_portrait_base64 || extraction.canonical_portrait_aspect_ratio !== '3:4') {
            return respond({
                matched: false, similarity: 0, is_live: false, face_detected: true,
                error: 'The server did not return a canonical verification portrait. Please try again.',
                code: 'CANONICAL_PORTRAIT_MISSING'
            }, { status: 502 })
        }

        // Calibrated for normalized ArcFace embeddings generated from the
        // server-side five-point aligned crop. This is intentionally owned by
        // the server; set FACE_MATCH_COSINE_THRESHOLD to tighten it after
        // collecting approved genuine/impostor validation samples.
        const threshold = Number(process.env.FACE_MATCH_COSINE_THRESHOLD ?? '0.50')
        if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) throw new Error('Invalid face-match threshold')
        const dot = selfie.reduce((sum, value, index) => sum + value * stored[index], 0)
        const selfieNorm = Math.sqrt(selfie.reduce((sum, value) => sum + value * value, 0))
        const storedNorm = Math.sqrt(stored.reduce((sum, value) => sum + value * value, 0))
        if (!selfieNorm || !storedNorm) throw new Error('Invalid biometric template')
        const similarity = Math.max(0, Math.min(1, dot / (selfieNorm * storedNorm)))
        const matched = similarity >= threshold

        const attendanceProof = matched
            ? issueAttendanceProof({
                subject: user.id,
                tenantId: tenant.tenantId,
                action,
                localDate: getLocalDateIST(),
                verificationRequestId: requestId,
                embeddingPipelineVersion,
            })
            : undefined

        return respond({
            matched, similarity: Math.round(similarity * 1000) / 1000, threshold, is_live: true, face_detected: true,
            canonical_portrait_base64: extraction.canonical_portrait_base64,
            canonical_portrait_aspect_ratio: extraction.canonical_portrait_aspect_ratio,
            method: 'arcface-512-server', diagnostics: extraction.diagnostics,
            quality_score: extraction.quality_score ?? null,
            verification: {
                faceCount: extraction.face_count,
                embeddingDimensions: selfie.length,
                livenessPassed: extraction.is_live === true,
                backend: extraction.diagnostics?.backend_engine || 'Not reported',
                capturePipeline,
            },
            code: matched ? undefined : 'FACE_SIMILARITY_BELOW_THRESHOLD',
            embedding_pipeline_version: embeddingPipelineVersion,
            attendance_proof: attendanceProof,
            error: matched ? undefined : 'Face does not match the approved profile photo.',
        })
    } catch (error) {
        console.error('[VerifyFaceAPI] Error:', error)
        return respond({ error: 'Face verification could not be completed.' }, { status: 500 })
    }
    })
}
