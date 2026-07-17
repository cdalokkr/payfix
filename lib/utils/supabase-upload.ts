import { createClient } from '@supabase/supabase-js'

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
    if (!_supabase) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing.')
        }
        _supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            }
        })
    }
    return _supabase;
}

export const supabase = new Proxy({} as any, {
    get(_, prop, receiver) {
        return Reflect.get(getSupabase(), prop, receiver);
    }
});

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
        const { data, error } = await supabase.storage
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
        const { data: { publicUrl } } = supabase.storage
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

        const { error } = await supabase.storage
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
