import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { AttendanceService } from '@/lib/services/attendance.service'
import { db, runWithTenantSchema } from '@/lib/db'
import { attendanceSessions, profiles } from '@/lib/db/schema'
import { FaceServiceClient } from '@/lib/face-service-client'
import { KioskDeviceService } from '@/lib/services/kiosk-device.service'
import { getDistanceFromLatLonInMeters } from '@/lib/utils/geo-utils'
import { getLocalDateIST } from '@/lib/utils/date-utils'
import { consumeLivenessChallenge, LIVENESS_FRAME_COUNT } from '@/lib/liveness-challenge'
import { ProfileService } from '@/lib/services/profile.service'
import { recordBiometricVerificationAttempt } from '@/lib/services/biometric-verification-attempt.service'

// v1 remains accepted for already-installed kiosk terminals. New kiosk builds
// send the shared v2 contract used by enrollment and PWA attendance.
const NATURAL_PORTRAIT_PIPELINES = new Set(['natural-portrait-v1', 'natural-portrait-3x4-v2'])
const SELFIE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,/

function cosineSimilarity(left: number[], right: number[]) {
    const dot = left.reduce((sum, value, index) => sum + value * right[index], 0)
    const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0))
    const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0))
    return leftNorm && rightNorm ? Math.max(0, Math.min(1, dot / (leftNorm * rightNorm))) : 0
}

/**
 * Server-only 1:N kiosk verification.
 *
 * This endpoint never returns biometric templates. A successful face match is
 * immediately used to create the kiosk attendance event inside the paired
 * tenant context, preventing a kiosk browser from choosing an employee ID.
 */
export async function POST(request: NextRequest) {
        const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
        const auditStartedAt = Date.now()
        let auditTenantSchema: string | null = null
        let auditProfileId: string | null = null
        let auditFrameCount = 0
        let auditCapturePipelineVersion: string | null = null
        const respond = async (body: any, init?: { status?: number }) => {
            if (auditTenantSchema) {
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
                await runWithTenantSchema(auditTenantSchema, () => recordBiometricVerificationAttempt({
                    source: 'kiosk',
                    profileId: auditProfileId || body?.employee?.id || null,
                    outcome,
                    similarity,
                    threshold: typeof body?.threshold === 'number' ? body.threshold : null,
                    reasonCode: code,
                    faceCount: typeof verification.faceCount === 'number' ? verification.faceCount : null,
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
                }))
            }
            return NextResponse.json(body, init)
        }
    try {
        const kioskSecret = request.headers.get('x-kiosk-secret')
        if (!kioskSecret) {
            return respond({ error: 'UNAUTHORIZED_KIOSK_DEVICE', message: 'This kiosk is not paired.' }, { status: 401 })
        }
        const terminalId = request.headers.get('x-kiosk-installation-id') || undefined
        const pairingInfo = await KioskDeviceService.verifyPairingCode(kioskSecret, terminalId)
        if (pairingInfo) auditTenantSchema = pairingInfo.tenantSchema
        if (!pairingInfo) {
            return respond({ error: 'INVALID_PAIRING_CODE', message: 'This kiosk pairing is invalid or inactive.' }, { status: 401 })
        }

        const { frames, imageBase64, challenge, biometricPipelineVersion, latitude, longitude } = await request.json()
        auditFrameCount = Array.isArray(frames) ? frames.length : (typeof imageBase64 === 'string' ? 1 : 0)
        auditCapturePipelineVersion = typeof biometricPipelineVersion === 'string' ? biometricPipelineVersion : null
        if (!NATURAL_PORTRAIT_PIPELINES.has(String(biometricPipelineVersion))) {
            return respond({ error: 'UNSUPPORTED_BIOMETRIC_PIPELINE', message: 'Submit a natural camera portrait frame.' }, { status: 400 })
        }
        const submittedFrames = Array.isArray(frames) ? frames : (typeof imageBase64 === 'string' ? [imageBase64] : [])
        if (submittedFrames.length !== LIVENESS_FRAME_COUNT || submittedFrames.some(frame => typeof frame !== 'string' || !SELFIE_DATA_URL.test(frame) || frame.length > 7_000_000)) {
            return respond({ error: 'LIVENESS_FRAMES_REQUIRED', message: 'Three natural camera frames are required.' }, { status: 400 })
        }
        const challengeResult = consumeLivenessChallenge(challenge, pairingInfo.device.id, 'attendance')
        if (!challengeResult.ok) return respond({ matched: false, is_live: false, error: 'Liveness challenge failed or expired.', code: challengeResult.code }, { status: 403 })
        const hasCaptureLocation = typeof latitude === 'number'
            && Number.isFinite(latitude)
            && typeof longitude === 'number'
            && Number.isFinite(longitude)
        const kioskLatitude = pairingInfo.device.latitude
        const kioskLongitude = pairingInfo.device.longitude
        if (kioskLatitude !== null && kioskLongitude !== null) {
            if (!hasCaptureLocation) {
                return respond({
                    matched: false,
                    error: 'Location access is required at this kiosk.',
                    code: 'KIOSK_LOCATION_REQUIRED',
                }, { status: 403 })
            }
            const distanceMeters = getDistanceFromLatLonInMeters(
                latitude,
                longitude,
                kioskLatitude,
                kioskLongitude
            )
            if (distanceMeters > pairingInfo.device.radiusMeters) {
                return respond({
                    matched: false,
                    error: `This kiosk is outside its assigned location range.`,
                    code: 'KIOSK_GEOFENCE_FAILED',
                }, { status: 403 })
            }
        }

        const extractionStartedAt = Date.now()
        const extractions = await Promise.all(submittedFrames.map(frame => FaceServiceClient.extract(frame, { includeCroppedFace: false })))
        const extractionDurationMs = Date.now() - extractionStartedAt
        const extraction = extractions[0]
        const earlyCanonicalPortrait = extraction?.canonical_portrait_base64 || null
        const earlyCanonicalAspectRatio = extraction?.canonical_portrait_aspect_ratio || null
        const serviceVerification = {
            faceCount: extraction?.face_count ?? 0,
            embeddingDimensions: extraction?.embedding_512?.length || extraction?.embedding?.length || 0,
            livenessPassed: extraction?.is_live === true,
            backend: extraction?.diagnostics?.backend_engine || 'Not reported',
            canonicalPortrait: earlyCanonicalAspectRatio === '3:4',
            processingMs: extractionDurationMs,
        }
        if (extractions.some(item => !item.success || !item.face_detected || item.face_count !== 1 || item.is_live !== true)) {
            return respond({
                matched: false,
                error: 'Liveness movement could not be verified across all camera frames.',
                code: 'LIVENESS_FAILED',
                canonical_portrait_base64: earlyCanonicalPortrait,
                canonical_portrait_aspect_ratio: earlyCanonicalAspectRatio,
                verification: serviceVerification,
            }, { status: 400 })
        }
        const probe = extraction.embedding_512 || (extraction.embedding?.length === 512 ? extraction.embedding : null)
        if (!extraction.success || !extraction.face_detected || extraction.face_count !== 1 || !probe || probe.length !== 512) {
            return respond({
                matched: false,
                error: extraction.error_message || 'Exactly one clear face is required.',
                code: extraction.error_code || 'FACE_EXTRACTION_FAILED',
                diagnostics: extraction.diagnostics,
                quality_score: extraction.quality_score ?? null,
                canonical_portrait_base64: earlyCanonicalPortrait,
                canonical_portrait_aspect_ratio: earlyCanonicalAspectRatio,
                verification: serviceVerification,
            }, { status: 400 })
        }
        if (extraction.is_live !== true) {
            return respond({
                matched: false,
                error: 'Liveness verification failed. Please retake the selfie.',
                code: 'LIVENESS_FAILED',
                canonical_portrait_base64: earlyCanonicalPortrait,
                canonical_portrait_aspect_ratio: earlyCanonicalAspectRatio,
                verification: serviceVerification,
            }, { status: 400 })
        }
        const canonicalPortrait = extraction.canonical_portrait_base64
        if (!canonicalPortrait || extraction.canonical_portrait_aspect_ratio !== '3:4') {
            return respond({
                matched: false,
                is_live: false,
                error: 'The server did not return a canonical 3:4 verification portrait. Please try again.',
                code: 'CANONICAL_PORTRAIT_MISSING',
                verification: serviceVerification,
            }, { status: 502 })
        }

        const threshold = Number(process.env.FACE_MATCH_COSINE_THRESHOLD ?? '0.50')
        if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
            throw new Error('Invalid face-match threshold')
        }

        return await runWithTenantSchema(pairingInfo.tenantSchema, async () => {
            await ProfileService.ensurePhotoRequestsSchema()
            const candidates = await db.query.profiles.findMany({
                where: eq(profiles.status, 'active'),
                columns: {
                    id: true,
                    full_name: true,
                    email: true,
                    avatar_url: true,
                    face_embedding_512: true,
                    face_embedding_pipeline_version: true,
                },
            })
            const matches = candidates
                .map(profile => {
                    const template = profile.face_embedding_512 as number[] | null
                    return profile.face_embedding_pipeline_version === extraction.embedding_pipeline_version
                        && template && template.length === 512 && template.every(Number.isFinite)
                        ? { profile, similarity: cosineSimilarity(probe, template) }
                        : null
                })
                .filter((match): match is NonNullable<typeof match> => match !== null)
                .sort((left, right) => right.similarity - left.similarity)

            const best = matches[0]
            const runnerUp = matches[1]
            if (!best || best.similarity < threshold || (runnerUp && best.similarity - runnerUp.similarity < 0.03)) {
                return respond({
                    matched: false,
                    similarity: best ? Math.round(best.similarity * 1000) / 1000 : 0,
                    threshold,
                    code: runnerUp && best && best.similarity - runnerUp.similarity < 0.03
                        ? 'FACE_MATCH_AMBIGUOUS'
                        : 'FACE_SIMILARITY_BELOW_THRESHOLD',
                    error: runnerUp && best && best.similarity - runnerUp.similarity < 0.03
                        ? 'Face match is ambiguous. Please try again.'
                        : 'Face is not recognized.',
                    embedding_pipeline_version: extraction.embedding_pipeline_version,
                    diagnostics: extraction.diagnostics,
                    quality_score: extraction.quality_score ?? null,
                    canonical_portrait_base64: canonicalPortrait,
                    canonical_portrait_aspect_ratio: extraction.canonical_portrait_aspect_ratio,
                    verification: { ...serviceVerification, canonicalPortrait: true },
                }, { status: 200 })
            }

            const now = new Date()
            const localDate = getLocalDateIST()
            const activeSession = await db.query.attendanceSessions.findFirst({
                where: and(
                    eq(attendanceSessions.profile_id, best.profile.id),
                    eq(attendanceSessions.date, localDate),
                    eq(attendanceSessions.status, 'active')
                )
            })

            const action = activeSession ? 'check_out' : 'check_in'
            let result
            let duplicateCheckIn = false
            try {
                result = action === 'check_out'
                    ? await AttendanceService.clockOut({
                        profileId: best.profile.id,
                        email: best.profile.email,
                        localDate,
                    })
                    : await AttendanceService.clockIn({
                        profileId: best.profile.id,
                        email: best.profile.email,
                        localDate,
                        source: 'kiosk',
                        deviceId: pairingInfo.device.id,
                        locationId: pairingInfo.device.locationId || undefined,
                        latitude: hasCaptureLocation ? latitude : undefined,
                        longitude: hasCaptureLocation ? longitude : undefined,
                    })
            } catch (error: any) {
                // A second scan can pass the pre-write lookup before the first
                // transaction commits. Return the committed check-in instead
                // of turning that harmless duplicate request into a 500.
                const isConcurrentCheckIn = action === 'check_in' && (
                    error?.message?.includes('ALREADY_CLOCKED_IN')
                    || error?.cause?.code === '23505'
                    || error?.code === '23505'
                )
                if (!isConcurrentCheckIn) throw error
                const settledSession = await db.query.attendanceSessions.findFirst({
                    where: and(
                        eq(attendanceSessions.profile_id, best.profile.id),
                        eq(attendanceSessions.date, localDate),
                        eq(attendanceSessions.status, 'active')
                    )
                })
                if (!settledSession) throw error
                duplicateCheckIn = true
            }

            return respond({
                matched: true,
                similarity: Math.round(best.similarity * 1000) / 1000,
                threshold,
                embedding_pipeline_version: extraction.embedding_pipeline_version,
                diagnostics: extraction.diagnostics,
                quality_score: extraction.quality_score ?? null,
                is_live: true,
                employee: {
                    id: best.profile.id,
                    name: best.profile.full_name || best.profile.email,
                    avatarUrl: best.profile.avatar_url,
                },
                punch: {
                    action: duplicateCheckIn ? 'check_in' : action,
                    sessionNumber: duplicateCheckIn ? 1 : (action === 'check_out' ? activeSession?.session_number || 1 : result?.total_sessions || 1),
                    timestamp: now.toISOString(),
                },
                verification: {
                    faceCount: extraction.face_count,
                    embeddingDimensions: probe.length,
                    livenessPassed: true,
                    backend: extraction.diagnostics?.backend_engine || 'Not reported',
                    capturePipeline: biometricPipelineVersion,
                    canonicalPortrait: true,
                    processingMs: extractionDurationMs,
                },
                canonical_portrait_base64: canonicalPortrait,
                canonical_portrait_aspect_ratio: extraction.canonical_portrait_aspect_ratio,
            })
        })
    } catch (error) {
        console.error('[Kiosk Verify Face API] Error:', error)
        return respond({ error: 'Kiosk biometric verification could not be completed.' }, { status: 500 })
    }
}