import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FaceServiceClient } from '@/lib/face-service-client'


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
        const profileId = formData.get('profileId') as string

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

        const isPending = formData.get('isPending') === 'true'

        // 1. Process image through FaceServiceClient for validation & 512x512 Face Crop
        const arrayBuffer = await file.arrayBuffer()
        const rawBase64 = Buffer.from(arrayBuffer).toString('base64')
        const extractRes = await FaceServiceClient.extract(rawBase64)

        if (!extractRes.success || !extractRes.face_detected) {
            return NextResponse.json({
                error: extractRes.error_message || 'No face detected in photo. Please ensure face is clearly visible in good lighting.'
            }, { status: 400 })
        }

        // 2. Prepare cropped 512x512 HD avatar or fallback to original
        let fileToUpload: Buffer = Buffer.from(arrayBuffer)
        if (extractRes.cropped_face_base64) {
            const cropB64Clean = extractRes.cropped_face_base64.replace(/^data:image\/\w+;base64,/, '')
            fileToUpload = Buffer.from(cropB64Clean, 'base64')
        }

        // 3. Create admin client with service role (bypasses RLS)
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        )

        // Upload to Supabase Storage using service role
        const fileName = `profile-${profileId}-${Date.now()}.jpg`
        const { error: uploadError } = await adminClient.storage
            .from('avatars')
            .upload(fileName, fileToUpload, {
                contentType: 'image/jpeg',
                upsert: true,
            })

        if (uploadError) {
            console.error('[UPLOAD-API] Storage error:', uploadError)
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        // Get public URL
        const { data: { publicUrl } } = adminClient.storage
            .from('avatars')
            .getPublicUrl(fileName)

        // If first-time direct upload (not pending review), update profile and face vector immediately
        if (!isPending) {
            const updateData: any = {
                avatar_url: publicUrl,
                avatar_status: 'custom',
                updated_at: new Date().toISOString()
            }
            if (extractRes.embedding_512 && extractRes.embedding_512.length === 512) {
                updateData.face_embedding_512 = extractRes.embedding_512
                updateData.face_enrolled_at = new Date().toISOString()
            }

            const { error: updateError } = await adminClient
                .from('profiles')
                .update(updateData)
                .eq('id', profileId)

            if (updateError) {
                console.error('[UPLOAD-API] Profile update error:', updateError)
                return NextResponse.json({ error: updateError.message }, { status: 500 })
            }
        }

        console.log('[UPLOAD-API] Success with 512x512 Face Crop:', { fileName, publicUrl, isPending })

        return NextResponse.json({
            success: true,
            path: publicUrl,
            embedding_512: extractRes.embedding_512,
            message: 'Avatar cropped (+15% padding) and uploaded successfully'
        })

    } catch (error: any) {
        console.error('[UPLOAD-API] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Upload failed' },
            { status: 500 }
        )
    }
}
