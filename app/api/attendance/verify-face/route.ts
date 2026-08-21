import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { FaceServiceClient } from '@/lib/face-service-client'

const SELFIE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,/

export async function POST(request: NextRequest) {
    try {
        const { selfieBase64 } = await request.json()
        if (typeof selfieBase64 !== 'string' || !SELFIE_DATA_URL.test(selfieBase64)) {
            return NextResponse.json({ error: 'A JPEG, PNG, or WebP camera selfie is required.' }, { status: 400 })
        }

        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            columns: { face_embedding_512: true },
        })
        const stored = profile?.face_embedding_512 as number[] | null
        if (!stored || stored.length !== 512 || !stored.every(Number.isFinite)) {
            return NextResponse.json({ error: 'Your approved profile has no valid biometric template. Please submit a new profile photo.' }, { status: 400 })
        }

        const extraction = await FaceServiceClient.extract(selfieBase64)
        const selfie = extraction.embedding_512 || (extraction.embedding?.length === 512 ? extraction.embedding : null)
        if (!extraction.success || !extraction.face_detected || extraction.face_count !== 1 || !selfie || selfie.length !== 512) {
            return NextResponse.json({
                matched: false, similarity: 0, is_live: false, face_detected: false,
                error: extraction.error_message || 'Exactly one clear face is required.',
                code: extraction.error_code || 'FACE_EXTRACTION_FAILED',
                diagnostics: extraction.diagnostics,
            })
        }
        if (extraction.is_live !== true) {
            return NextResponse.json({ matched: false, similarity: 0, is_live: false, face_detected: true, error: 'Liveness verification failed. Please retake your selfie.', diagnostics: extraction.diagnostics })
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
            method: 'arcface-512-server', diagnostics: extraction.diagnostics,
            verification: {
                faceCount: extraction.face_count,
                embeddingDimensions: selfie.length,
                livenessPassed: extraction.is_live === true,
                backend: extraction.diagnostics?.backend_engine || 'Not reported',
            },
            error: matched ? undefined : 'Face does not match the approved profile photo.',
        })
    } catch (error) {
        console.error('[VerifyFaceAPI] Error:', error)
        return NextResponse.json({ error: 'Face verification could not be completed.' }, { status: 500 })
    }
}
