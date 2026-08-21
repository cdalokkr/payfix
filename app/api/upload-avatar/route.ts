import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FaceServiceClient } from '@/lib/face-service-client'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function hasSupportedImageSignature(bytes: Uint8Array) {
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    const isWebp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    return isJpeg || isPng || isWebp
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const formData = await request.formData()
        const file = formData.get('file')
        const profileId = formData.get('profileId')
        if (!(file instanceof Blob) || typeof profileId !== 'string') return NextResponse.json({ error: 'A profile image is required.' }, { status: 400 })
        if (profileId !== user.id) return NextResponse.json({ error: 'Cannot upload for another user.' }, { status: 403 })
        if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Upload a JPEG, PNG, or WebP image smaller than 5 MB.' }, { status: 400 })

        const arrayBuffer = await file.arrayBuffer()
        if (!hasSupportedImageSignature(new Uint8Array(arrayBuffer.slice(0, 12)))) return NextResponse.json({ error: 'The uploaded file is not a supported image.' }, { status: 400 })
        const extraction = await FaceServiceClient.extract(Buffer.from(arrayBuffer).toString('base64'))
        const embedding = extraction.embedding_512 || (extraction.embedding?.length === 512 ? extraction.embedding : null)
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

        // Persist the exact portrait that the service just validated.
        // cropped_face_base64 is a detector-derived derivative, not an enrollment source: re-detecting
        // on that tight crop during admin approval can legitimately return “no face detected”.
        const fileToUpload = Buffer.from(arrayBuffer)
        const contentType = file.type
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
        console.info('[UPLOAD-API] Profile selfie accepted', {
            bytes: file.size,
            contentType,
            storedOriginalPortrait: true,
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
        // Only the admin approval service can activate this image and its biometric template.
        return NextResponse.json({
            success: true,
            path: publicUrl,
            status: 'pending_review',
            message: 'Photo uploaded for admin review.',
            diagnostics: extraction.diagnostics,
            verification: {
                imageBytes: file.size,
                mimeType: contentType,
                storedOriginalPortrait: true,
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
