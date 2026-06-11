import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

        // Create admin client with service role (bypasses RLS)
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        )

        // Upload to Supabase Storage using service role
        const fileName = `profile-${profileId}-${Date.now()}.jpg`
        const { error: uploadError } = await adminClient.storage
            .from('avatars')
            .upload(fileName, file, {
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

        // Update profile with new avatar URL (using service role)
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({
                avatar_url: publicUrl,
                avatar_status: 'custom',
                updated_at: new Date().toISOString()
            })
            .eq('id', profileId)

        if (updateError) {
            console.error('[UPLOAD-API] Profile update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        console.log('[UPLOAD-API] Success:', { fileName, publicUrl })

        return NextResponse.json({
            success: true,
            path: publicUrl,
            message: 'Avatar uploaded successfully'
        })

    } catch (error: any) {
        console.error('[UPLOAD-API] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Upload failed' },
            { status: 500 }
        )
    }
}
