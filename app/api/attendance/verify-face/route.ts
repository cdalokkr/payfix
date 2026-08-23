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
    try {
        const { frames, selfieBase64, challenge, biometricPipelineVersion } = await request.json()
        const capturePipeline = biometricPipelineVersion
        if (!NATURAL_PORTRAIT_PIPELINES.has(String(capturePipeline))) {
            return NextResponse.json({ error: 'Update the camera flow and submit a natural portrait frame.', code: 'UNSUPPORTED_BIOMETRIC_PIPELINE' }, { status: 400 })
        }
        const submittedFrames = Array.isArray(frames) ? frames : (typeof selfieBase64 === 'string' ? [selfieBase64] : [])
        if (submittedFrames.length !== LIVENESS_FRAME_COUNT || submittedFrames.some(frame => typeof frame !== 'string' || !SELFIE_DATA_URL.test(frame))) {
            return NextResponse.json({ error: 'Three natural camera frames are required.', code: 'LIVENESS_FRAMES_REQUIRED' }, { status: 400 })
        }
        if (submittedFrames.some(frame => frame.length > 7_000_000)) {
            return NextResponse.json({ error: 'Camera image is too large. Please retake the selfie.' }, { status: 413 })
        }

        if (!hasDistinctNaturalFrames(submittedFrames)) {
            return NextResponse.json({ matched: false, is_live: false, error: 'Capture three distinct natural camera frames. Please retake the selfie.', code: 'LIVENESS_FRAMES_NOT_DISTINCT' }, { status: 400 })
        }

        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const challengeResult = consumeLivenessChallenge(challenge, user.id, 'attendance')
        if (!challengeResult.ok) return NextResponse.json({ matched: false, is_live: false, error: 'Liveness challenge failed or expired.', code: challengeResult.code }, { status: 403 })

        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            columns: { face_embedding_512: true },
        })
        const stored = profile?.face_embedding_512 as number[] | null
        if (!stored || stored.length !== 512 || !stored.every(Number.isFinite)) {
            return NextResponse.json({ error: 'Your approved profile has no valid biometric template. Please submit a new profile photo.' }, { status: 400 })
        }

        const extractions = await Promise.all(submittedFrames.map(frame => FaceServiceClient.extract(frame)))
        const frameFailure = findFrameFailure(extractions)
        if (frameFailure) {
            const failedFrame = frameFailure.result
            return NextResponse.json({
                matched: false, similarity: 0, is_live: false, face_detected: failedFrame.face_detected,
                canonical_portrait_base64: failedFrame.canonical_portrait_base64 || null,
                canonical_portrait_aspect_ratio: failedFrame.canonical_portrait_aspect_ratio || null,
                diagnostics: failedFrame.diagnostics,
                error: 'Frame ' + (frameFailure.index + 1) + ': ' + frameFailure.message,
                code: frameFailure.code
            }, { status: 400 })
        }
        const extraction = selectBestValidatedFrame(extractions)
        if (!extraction) return NextResponse.json({ matched: false, is_live: false, error: 'No valid server-processed frame was available.', code: 'FACE_EXTRACTION_FAILED' }, { status: 400 })
        const selfie = averageNormalizedEmbeddings(extractions.map(item =>
            item.embedding_512 || (item.embedding?.length === 512 ? item.embedding : [])
        ))
        if (!extraction.success || !extraction.face_detected || extraction.face_count !== 1 || !selfie || selfie.length !== 512) {
            return NextResponse.json({
                matched: false, similarity: 0, is_live: false, face_detected: false,
                error: extraction.error_message || 'Exactly one clear face is required.',
                code: extraction.error_code || 'FACE_EXTRACTION_FAILED',
                diagnostics: extraction.diagnostics,
            })
        }
        if (extraction.is_live !== true) {
            return NextResponse.json({
                matched: false, similarity: 0, is_live: false, face_detected: true,
                canonical_portrait_base64: extraction.canonical_portrait_base64 || null,
                canonical_portrait_aspect_ratio: extraction.canonical_portrait_aspect_ratio || null,
                error: 'Liveness verification failed. Please retake your selfie.',
                diagnostics: extraction.diagnostics
            })
        }
        if (!extraction.canonical_portrait_base64 || extraction.canonical_portrait_aspect_ratio !== '3:4') {
            return NextResponse.json({
                matched: false, similarity: 0, is_live: false, face_detected: true,
                error: 'The server did not return a canonical verification portrait. Please try again.',
                code: 'CANONICAL_PORTRAIT_MISSING'
            }, { status: 502 })
        }

        const threshold = Number(process.env.FACE_MATCH_COSINE_THRESHOLD ?? '0.88')
        if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) throw new Error('Invalid face-match threshold')
        const dot = selfie.reduce((sum, value, index) => sum + value * stored[index], 0)
        const selfieNorm = Math.sqrt(selfie.reduce((sum, value) => sum + value * value, 0))
        const storedNorm = Math.sqrt(stored.reduce((sum, value) => sum + value * value, 0))
        if (!selfieNorm || !storedNorm) throw new Error('Invalid biometric template')
        const similarity = Math.max(0, Math.min(1, dot / (selfieNorm * storedNorm)))
        const matched = similarity >= threshold

        return NextResponse.json({
            matched, similarity: Math.round(similarity * 1000) / 1000, threshold, is_live: true, face_detected: true,
            canonical_portrait_base64: extraction.canonical_portrait_base64,
            canonical_portrait_aspect_ratio: extraction.canonical_portrait_aspect_ratio,
            method: 'arcface-512-server', diagnostics: extraction.diagnostics,
            verification: {
                faceCount: extraction.face_count,
                embeddingDimensions: selfie.length,
                livenessPassed: extraction.is_live === true,
                backend: extraction.diagnostics?.backend_engine || 'Not reported',
                capturePipeline,
            },
            error: matched ? undefined : 'Face does not match the approved profile photo.',
        })
    } catch (error) {
        console.error('[VerifyFaceAPI] Error:', error)
        return NextResponse.json({ error: 'Face verification could not be completed.' }, { status: 500 })
    }
    })
}
