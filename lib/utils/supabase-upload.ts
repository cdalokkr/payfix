import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton: created on first use at runtime, not at build time
let _supabase: SupabaseClient | null = null;
function getSupabase() {
    if (!_supabase) {
        _supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );
    }
    return _supabase;
}

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param userId - The user ID for naming the file
 * @param bucket - The storage bucket name (default: 'avatars')
 * @returns The public URL of the uploaded file
 */
export async function uploadAvatar(
    file: File,
    userId: string,
    bucket: string = 'avatars'
): Promise<string> {
    try {
        // Generate unique filename: user-{userId}-{timestamp}.{extension}
        const fileExt = file.name.split('.').pop()
        const fileName = `user-${userId}-${Date.now()}.${fileExt}`
        const filePath = fileName

        // Upload file to Supabase Storage
        const { data, error } = await getSupabase().storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false // Don't overwrite existing files
            })

        if (error) {
            console.error('[SupabaseUpload] Upload error:', error)
            throw new Error(`Failed to upload file: ${error.message}`)
        }

        // Get public URL
        const { data: { publicUrl } } = getSupabase().storage
            .from(bucket)
            .getPublicUrl(filePath)

        console.log('[SupabaseUpload] File uploaded successfully:', publicUrl)
        return publicUrl
    } catch (error) {
        console.error('[SupabaseUpload] Error:', error)
        throw error
    }
}

/**
 * Delete a file from Supabase Storage
 * @param fileUrl - The public URL of the file to delete
 * @param bucket - The storage bucket name (default: 'avatars')
 */
export async function deleteAvatar(
    fileUrl: string,
    bucket: string = 'avatars'
): Promise<void> {
    try {
        // Extract filename from URL
        // URL format: https://{project}.supabase.co/storage/v1/object/public/avatars/user-{userId}-{timestamp}.png
        const urlParts = fileUrl.split('/')
        const fileName = urlParts[urlParts.length - 1]

        // Skip deletion for default avatars
        if (fileName.startsWith('default-')) {
            console.log('[SupabaseUpload] Skipping deletion of default avatar')
            return
        }

        const { error } = await getSupabase().storage
            .from(bucket)
            .remove([fileName])

        if (error) {
            console.error('[SupabaseUpload] Delete error:', error)
            // Don't throw error for deletion failures - not critical
        } else {
            console.log('[SupabaseUpload] File deleted successfully:', fileName)
        }
    } catch (error) {
        console.error('[SupabaseUpload] Error deleting file:', error)
        // Don't throw - deletion failure shouldn't block the upload
    }
}
