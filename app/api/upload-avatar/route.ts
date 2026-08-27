import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FaceServiceClient } from '@/lib/face-service-client'
import { averageNormalizedEmbeddings, findFrameFailure, hasDistinctNaturalFrames, selectBestValidatedFrame } from '@/lib/biometric-frame-validation'
import { issueEnrollmentProof, sha256Hex } from '@/lib/biometric-enrollment-proof'
import { consumeLivenessChallenge, LIVENESS_FRAME_COUNT } from '@/lib/liveness-challenge'

const NATURAL_PORTRAIT_PIPELINES = new Set(['natural-portrait-v1', 'natural-portrait-3x4-v2'])
const SELFIE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,/

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const formData = await request.formData()
        const profileId = formData.get('profileId')
        const submittedPipelineVersion = formData.get('biometricPipelineVersion')
        const challenge = formData.get('challenge')
        const submittedFrames = JSON.parse(String(formData.get('livenessFrames') || '[]'))
        const capturePipeline = NATURAL_PORTRAIT_PIPELINES.has(String(submittedPipelineVersion))
            ? String(submittedPipelineVersion)
            : 'legacy-client-crop-v1'
        if (typeof profileId !== 'string') return NextResponse.json({ error: 'A profile identity is required.' }, { status: 400 })
        if (profileId !== user.id) return NextResponse.json({ error: 'Cannot upload for another user.' }, { status: 403 })
        if (!Array.isArray(submittedFrames) || submittedFrames.length !== LIVENESS_FRAME_COUNT || submittedFrames.some(frame => typeof frame !== 'string' || !SELFIE_DATA_URL.test(frame))) {
            return NextResponse.json({ error: 'Three natural camera frames are required.', code: 'LIVENESS_FRAMES_REQUIRED' }, { status: 400 })
        }
        if (!hasDistinctNaturalFrames(submittedFrames)) {
            return NextResponse.json({ error: 'Capture three distinct natural camera frames. Please retake the selfie.', code: 'LIVENESS_FRAMES_NOT_DISTINCT' }, { status: 400 })
        }
        const challengeResult = consumeLivenessChallenge(challenge, user.id, 'enrollment')
        if (!challengeResult.ok) return NextResponse.json({ error: 'Liveness challenge failed or expired.', code: challengeResult.code }, { status: 403 })
        const extractions = await Promise.all(submittedFrames.map(frame => FaceServiceClient.extract(
            frame.replace(/^data:image\/(?:jpeg|png|webp);base64,/, ''),
            { includeCroppedFace: false }
        )))
        const frameFailure = findFrameFailure(extractions)
        if (frameFailure) {
            return NextResponse.json({
                error: 'Frame ' + (frameFailure.index + 1) + ': ' + frameFailure.message,
                code: frameFailure.code,
                diagnostics: frameFailure.result.diagnostics,
            }, { status: 400 })
        }
        const extraction = selectBestValidatedFrame(extractions)
        if (!extraction) return NextResponse.json({ error: 'No valid server-processed frame was available.', code: 'FACE_EXTRACTION_FAILED' }, { status: 400 })
        const embedding = averageNormalizedEmbeddings(extractions.map(item =>
            item.embedding_512 || (item.embedding?.length === 512 ? item.embedding : [])
        ))
        if (!extraction.success || !extraction.face_detected || extraction.face_count !== 1 || !embedding || embedding.length !== 512) {
            return NextResponse.json({
                error: extraction.error_message || 'Exactly one clear face is required.',
                code: extraction.error_code || 'FACE_EXTRACTION_FAILED',
                diagnostics: extraction.diagnostics,
            }, { status: 400 })
        }
        if (extraction.is_live !== true) {
            return NextResponse.json({ error: 'Liveness verification failed. Please capture a new selfie.', code: 'LIVENESS_FAILED', diagnostics: extraction.diagnostics }, { status: 400 })
        }
        if (!extraction.canonical_portrait_base64 || extraction.canonical_portrait_aspect_ratio !== '3:4') {
            return NextResponse.json({ error: 'The server did not return a canonical profile portrait. Please retake the selfie.', code: 'CANONICAL_PORTRAIT_MISSING' }, { status: 502 })
        }

        // Store only the server-generated 3:4 portrait for review and profile display.
        // The original natural capture stays in request memory and is discarded after this response.
        const fileToUpload = Buffer.from(extraction.canonical_portrait_base64.split(',')[1], 'base64')
        const contentType = 'image/jpeg'
        const extension = 'jpg'
        console.info('[UPLOAD-API] Profile selfie accepted', {
            bytes: fileToUpload.byteLength,
            contentType,
            storedCanonicalPortrait: true,
            capturePipeline,
            faceCount: extraction.face_count,
            embeddingDimensions: embedding.length,
            livenessPassed: extraction.is_live,
            backend: extraction.diagnostics?.backend_engine,
        })
        const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
        const fileName = 'pending/' + profileId + '/' + crypto.randomUUID() + '.' + extension
        const { error: uploadError } = await adminClient.storage.from('avatars').upload(fileName, fileToUpload, { contentType, upsert: false })
        if (uploadError) return NextResponse.json({ error: 'Could not store the profile image.' }, { status: 500 })
        const { data: { publicUrl } } = adminClient.storage.from('avatars').getPublicUrl(fileName)
        const enrollmentProof = issueEnrollmentProof({
            subject: user.id,
            portraitUrl: publicUrl,
            portraitSha256: sha256Hex(fileToUpload),
            embedding512: embedding,
            qualityScore: extraction.quality_score || 0,
        })
        // Only the admin approval service can activate this image and its biometric template.
        return NextResponse.json({
            success: true,
            path: publicUrl,
            status: 'pending_review',
            message: 'Photo uploaded for admin review.',
            enrollmentProof,
            diagnostics: extraction.diagnostics,
            verification: {
                imageBytes: fileToUpload.byteLength,
                mimeType: contentType,
                storedCanonicalPortrait: true,
                canonicalPortraitAspectRatio: extraction.canonical_portrait_aspect_ratio,
                capturePipeline,
                faceCount: extraction.face_count,
                embeddingDimensions: embedding.length,
                livenessPassed: extraction.is_live === true,
                backend: extraction.diagnostics?.backend_engine || 'Not reported',
            }
        })
    } catch (error) {
        console.error('[UPLOAD-API] Error:', error)
        return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
    }
}
