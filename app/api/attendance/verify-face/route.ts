import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { FaceServiceClient } from '@/lib/face-service-client'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()

        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { selfieBase64 } = body

        if (!selfieBase64) {
            return NextResponse.json({ error: 'No selfie image provided' }, { status: 400 })
        }

        // 1. Fetch user's enrolled profile embeddings
        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            columns: {
                id: true,
                face_embedding_512: true,
                face_embedding: true,
                avatar_url: true,
            }
        })

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const stored512 = profile.face_embedding_512 as number[] | null
        const stored128 = profile.face_embedding as number[] | null

        if (!stored512 && !stored128) {
            return NextResponse.json({
                error: 'No profile face registered. Please register profile photo first.'
            }, { status: 400 })
        }

        // 2. Call Face AI microservice to extract 512-d ArcFace vector & liveness from selfie
        const extractRes = await FaceServiceClient.extract(selfieBase64)

        if (!extractRes.success || !extractRes.face_detected) {
            return NextResponse.json({
                matched: false,
                similarity: 0.0,
                is_live: false,
                face_detected: false,
                error: extractRes.error_message || 'No face detected in selfie. Please look directly at the camera.',
                tip: extractRes.troubleshooting_tip
            }, { status: 200 })
        }

        const selfie512 = extractRes.embedding_512 || (extractRes.embedding?.length === 512 ? extractRes.embedding : null)
        const selfie128 = extractRes.embedding_128 || (extractRes.embedding?.length === 128 ? extractRes.embedding : null)

        // 3. Match 512-d ArcFace vectors with Cosine Dot Product (threshold: 0.65)
        let matched = false
        let similarity = 0.0

        if (stored512 && stored512.length === 512 && selfie512 && selfie512.length === 512) {
            let dot = 0
            for (let i = 0; i < 512; i++) {
                dot += stored512[i] * selfie512[i]
            }
            similarity = Math.max(0, Math.min(1, dot))
            matched = similarity >= 0.65
        } else if (stored128 && stored128.length === 128 && selfie128 && selfie128.length === 128) {
            let sum = 0
            for (let i = 0; i < 128; i++) {
                const diff = selfie128[i] - stored128[i]
                sum += diff * diff
            }
            const dist = Math.sqrt(sum)
            similarity = Math.max(0, 1 - dist)
            matched = dist < 0.50
        } else if (stored512 || stored128) {
            // Compare fallback
            const cmpRes = await FaceServiceClient.compare(
                (selfie512 || selfie128) as number[],
                (stored512 || stored128) as number[]
            )
            matched = cmpRes.matched
            similarity = cmpRes.similarity
        }

        return NextResponse.json({
            matched,
            similarity: Math.round(similarity * 1000) / 1000,
            is_live: extractRes.is_live,
            liveness_score: extractRes.liveness_score,
            face_detected: true,
            method: 'arcface-512',
            diagnostics: extractRes.diagnostics
        })
    } catch (err: any) {
        console.error('[VerifyFaceAPI] Error:', err)
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
    }
}
