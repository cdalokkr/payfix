import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const LEGACY_FACE_DIMENSIONS = 128

type LegacyFaceExtractResponse = {
    success?: boolean
    embedding?: unknown
    error?: string
    face_detected?: boolean
    face_count?: number
    dimensions?: number
    diagnostics?: {
        face_box?: {
            x?: unknown
            y?: unknown
            width?: unknown
            height?: unknown
        }
    }
}

function isValidLegacyEmbedding(value: unknown): value is number[] {
    return Array.isArray(value) &&
        value.length === LEGACY_FACE_DIMENSIONS &&
        value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

function toVectorLiteral(embedding: number[]) {
    return `[${embedding.join(',')}]`
}

type NormalizedFaceBox = {
    x: number
    y: number
    width: number
    height: number
}

function isValidNormalizedFaceBox(value: unknown): value is NormalizedFaceBox {
    if (!value || typeof value !== 'object') return false
    const box = value as Record<string, unknown>
    return ['x', 'y', 'width', 'height'].every((key) =>
        typeof box[key] === 'number' &&
        Number.isFinite(box[key]) &&
        box[key] >= 0 &&
        box[key] <= 1
    ) && (box.width as number) > 0 && (box.height as number) > 0
}

async function createCanonicalPortrait(imageBuffer: Buffer, faceBox: NormalizedFaceBox) {
    const source = sharp(imageBuffer, { failOn: 'error' }).rotate()
    const metadata = await source.metadata()
    const imageWidth = metadata.width
    const imageHeight = metadata.height
    if (!imageWidth || !imageHeight) {
        throw new Error('Unable to read image dimensions')
    }

    const faceWidth = faceBox.width * imageWidth
    const faceHeight = faceBox.height * imageHeight
    const faceCenterX = (faceBox.x + faceBox.width / 2) * imageWidth
    const faceCenterY = (faceBox.y + faceBox.height / 2) * imageHeight

    // Place a detected face in a stable, portrait-friendly square: the face
    // takes ~58% of its width, with modest headroom above the eye line.
    const requestedSide = Math.max(faceWidth / 0.58, faceHeight / 0.68)
    const cropSide = Math.round(requestedSide)
    if (cropSide > Math.min(imageWidth, imageHeight)) {
        throw new Error('Move slightly farther from the camera so your full face fits the portrait guide.')
    }

    const left = Math.round(Math.max(0, Math.min(
        imageWidth - cropSide,
        faceCenterX - cropSide / 2
    )))
    const top = Math.round(Math.max(0, Math.min(
        imageHeight - cropSide,
        faceCenterY - cropSide * 0.43
    )))

    return source
        .extract({ left, top, width: cropSide, height: cropSide })
        .resize(480, 480, { fit: 'fill' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
}

export async function POST(request: NextRequest) {
    try {
        // Verify user is authenticated
        const supabase = await createServerSupabaseClient()
        const { data, error } = await supabase.auth.getUser()
        const user = data?.user || null

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get the form data
        const formData = await request.formData()
        const file = formData.get('file') as Blob
        const profileId = (formData.get('profileId') || formData.get('userId')) as string

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (!profileId) {
            return NextResponse.json({ error: 'No profileId provided' }, { status: 400 })
        }

        // Security check: only allow uploading for own profile
        if (profileId !== user.id) {
            return NextResponse.json({ error: 'Cannot upload for other users' }, { status: 403 })
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Profile photo must be an image file' }, { status: 400 })
        }

        const faceApiUrl = process.env.FACE_API_URL?.trim().replace(/\/$/, '')
        if (!faceApiUrl) {
            console.error('[UPLOAD-API] FACE_API_URL is not configured')
            return NextResponse.json({ error: 'Profile photo verification is temporarily unavailable' }, { status: 503 })
        }

        // Enrollment is server-authoritative: only store a photo after the
        // face service confirms one valid 128-d descriptor.
        const imageBuffer = Buffer.from(await file.arrayBuffer())
        const imageBase64 = imageBuffer.toString('base64')
        let extraction: LegacyFaceExtractResponse | null = null
        try {
            const faceResponse = await fetch(`${faceApiUrl}/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_base64: imageBase64 }),
                signal: AbortSignal.timeout(8000),
            })
            extraction = await faceResponse.json().catch(() => null) as LegacyFaceExtractResponse | null

            if (!faceResponse.ok || !extraction) {
                throw new Error('Face service returned an invalid response')
            }
        } catch (error) {
            console.error('[UPLOAD-API] Face service unavailable:', error)
            return NextResponse.json(
                { error: 'Profile photo verification is temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            )
        }

        if (
            extraction.success !== true ||
            extraction.face_detected !== true ||
            extraction.face_count !== 1 ||
            extraction.dimensions !== LEGACY_FACE_DIMENSIONS ||
            !isValidLegacyEmbedding(extraction.embedding)
        ) {
            return NextResponse.json(
                { error: extraction.error || 'Use a clear photo containing exactly one face.' },
                { status: 400 }
            )
        }

        const faceEmbedding = extraction.embedding
        const faceBox = extraction.diagnostics?.face_box
        if (!isValidNormalizedFaceBox(faceBox)) {
            return NextResponse.json(
                { error: 'Profile photo framing could not be verified. Please retake the photo.' },
                { status: 400 }
            )
        }

        let canonicalPortrait: Buffer
        try {
            canonicalPortrait = await createCanonicalPortrait(imageBuffer, faceBox)
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Unable to prepare the profile portrait.' },
                { status: 400 }
            )
        }

        // Create admin client with service role (bypasses RLS)
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        )

        // A pending candidate is never allowed to replace the approved profile
        // portrait. Check before writing storage so a user cannot submit a
        // second candidate while an admin/moderator is reviewing the first.
        const { data: existingRequest, error: pendingRequestError } = await adminClient
            .from('profile_photo_requests')
            .select('id')
            .eq('profile_id', profileId)
            .eq('status', 'pending')
            .maybeSingle()

        if (pendingRequestError) {
            console.error('[UPLOAD-API] Pending request lookup error:', pendingRequestError)
            return NextResponse.json({ error: 'Unable to check photo approval status' }, { status: 500 })
        }
        if (existingRequest) {
            return NextResponse.json(
                { error: 'A profile photo is already pending approval. Wait for an admin or moderator to approve or reject it.' },
                { status: 409 }
            )
        }

        // Keep the candidate under a non-live path. It is not written to
        // profiles.avatar_url until an admin or moderator approves it.
        const fileName = `pending/${profileId}/profile-${Date.now()}.jpg`
        const { error: uploadError } = await adminClient.storage
            .from('avatars')
            .upload(fileName, canonicalPortrait, {
                contentType: 'image/jpeg',
                upsert: false,
            })

        if (uploadError) {
            console.error('[UPLOAD-API] Storage error:', uploadError)
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        // Get public URL
        const { data: { publicUrl } } = adminClient.storage
            .from('avatars')
            .getPublicUrl(fileName)

        const { error: createRequestError } = await adminClient
            .from('profile_photo_requests')
            .insert({
                profile_id: profileId,
                pending_photo_url: publicUrl,
                // PostgREST expects a pgvector literal rather than a JSON
                // array for vector(128) columns.
                pending_face_embedding: toVectorLiteral(faceEmbedding),
                status: 'pending',
            })

        if (createRequestError) {
            // Do not leave an orphaned candidate when the request could not
            // be created (including a concurrent pending-request conflict).
            await adminClient.storage.from('avatars').remove([fileName])
            if (createRequestError.code === '23505') {
                return NextResponse.json(
                    { error: 'A profile photo is already pending approval. Wait for an admin or moderator to approve or reject it.' },
                    { status: 409 }
                )
            }
            console.error('[UPLOAD-API] Photo request creation error:', createRequestError)
            return NextResponse.json({ error: createRequestError.message }, { status: 500 })
        }

        console.log('[UPLOAD-API] Pending candidate created:', { fileName })

        return NextResponse.json({
            success: true,
            path: publicUrl,
            pending: true,
            message: 'Photo submitted for admin or moderator approval'
        })

    } catch (error: any) {
        console.error('[UPLOAD-API] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Upload failed' },
            { status: 500 }
        )
    }
}
