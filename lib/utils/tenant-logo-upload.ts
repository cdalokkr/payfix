import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

export const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const ALLOWED_LOGO_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml'
];

/**
 * Validates logo file before upload
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type.toLowerCase())) {
        return { 
            valid: false, 
            error: 'Invalid file format. Please upload a PNG, JPEG, WebP, or SVG image.' 
        };
    }
    if (file.size > MAX_LOGO_FILE_SIZE) {
        return { 
            valid: false, 
            error: `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum allowed size is 2MB.` 
        };
    }
    return { valid: true };
}

/**
 * Upload a tenant business logo via secure server-side endpoint
 * Bypasses client-side RLS restrictions by using service-role storage client on server
 */
export async function uploadTenantLogo(
    file: File | Blob,
    tenantId: string,
    bucket: string = 'avatars'
): Promise<string> {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tenantId', tenantId);

        const res = await fetch('/api/organization/upload-logo', {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || errData.message || `Upload failed with status [${res.status}]`);
        }

        const data = await res.json();
        return data.logoUrl;
    } catch (err: any) {
        console.error('[TenantLogoUpload] Upload exception:', err);
        throw err;
    }
}

/**
 * Deletes an existing tenant logo from Supabase Storage
 */
export async function deleteTenantLogo(
    logoUrl: string | null | undefined,
    bucket: string = 'avatars'
): Promise<void> {
    if (!logoUrl) return;

    try {
        // Skip default or placeholder logos
        if (logoUrl.startsWith('/') || logoUrl.includes('placeholder') || logoUrl.includes('default')) {
            return;
        }

        // Extract relative path from Supabase storage public URL
        // Format: .../storage/v1/object/public/{bucket}/{filePath}
        const bucketMarker = `/${bucket}/`;
        const markerIndex = logoUrl.indexOf(bucketMarker);
        let storagePath = '';
        if (markerIndex !== -1) {
            storagePath = logoUrl.substring(markerIndex + bucketMarker.length);
        } else {
            const urlParts = logoUrl.split('/');
            storagePath = urlParts.slice(-2).join('/'); // e.g. logos/tenant-xyz.png
        }

        if (storagePath) {
            // Check if on server with service role key
            if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
                const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-admin');
                const admin = createSupabaseAdminClient();
                await admin.storage.from(bucket).remove([storagePath]);
            } else {
                await getSupabase().storage.from(bucket).remove([storagePath]);
            }
        }
    } catch (err) {
        console.warn('[TenantLogoUpload] Storage delete ignored:', err);
    }
}

/**
 * Converts an image URL into a base64 Data URL and extracts natural dimensions
 * Used for inserting logos into jsPDF reports & payslips
 */
export async function loadImageAsBase64(
    url: string
): Promise<{ dataUrl: string; width: number; height: number; format: string } | null> {
    if (!url) return null;

    try {
        // If already a data url
        if (url.startsWith('data:image/')) {
            const formatMatch = url.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
            const format = (formatMatch?.[1] || 'png').toUpperCase();
            return {
                dataUrl: url,
                width: 100,
                height: 100,
                format: format === 'JPEG' ? 'JPEG' : 'PNG'
            };
        }

        // If in browser environment
        if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || 200;
                        canvas.height = img.naturalHeight || 200;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            resolve(null);
                            return;
                        }
                        ctx.drawImage(img, 0, 0);
                        const isPng = url.toLowerCase().includes('.png') || url.toLowerCase().includes('.svg');
                        const format = isPng ? 'PNG' : 'JPEG';
                        const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg');
                        resolve({
                            dataUrl,
                            width: img.naturalWidth || 200,
                            height: img.naturalHeight || 200,
                            format
                        });
                    } catch (e) {
                        console.warn('[loadImageAsBase64] Canvas conversion error:', e);
                        resolve(null);
                    }
                };
                img.onerror = () => {
                    console.warn('[loadImageAsBase64] Image load failed:', url);
                    resolve(null);
                };
                img.src = url;
            });
        }

        // Server-side fetch fallback
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/png';
        const format = contentType.includes('jpeg') ? 'JPEG' : 'PNG';
        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        return {
            dataUrl,
            width: 200,
            height: 200,
            format
        };
    } catch (err) {
        console.warn('[loadImageAsBase64] Error loading image:', err);
        return null;
    }
}
