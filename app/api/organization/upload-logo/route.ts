import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-admin';
import { masterDb } from '@/lib/db/master-connection';
import { tenantBranding, tenants } from '@/lib/db/master-schema';
import { db, centralDb } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { clearTenantBrandingCache } from '@/lib/tenant/resolver';

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml'
]);

export async function POST(request: NextRequest) {
  try {
    // 1. Verify User Authentication
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve Profile & Check Permissions (Admin, Moderator, or SuperAdmin)
    const tenantIdHeader = request.headers.get('x-tenant-id');
    const tenantSchemaHeader = request.headers.get('x-tenant-schema');

    let userRole: string | null = null;
    let tenantId = tenantIdHeader || null;

    // Check centralDb first if superadmin or fallback
    const centralProfile = await centralDb.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      columns: { id: true, role: true, tenant_id: true }
    }).catch(() => null);

    if (centralProfile) {
      userRole = centralProfile.role;
      if (!tenantId && centralProfile.tenant_id) {
        tenantId = centralProfile.tenant_id;
      }
    }

    if (!userRole) {
      // Check tenant-scoped db
      const scopedProfile = await db.query.profiles.findFirst({
        where: eq(profiles.id, user.id),
        columns: { id: true, role: true, tenant_id: true }
      }).catch(() => null);

      if (scopedProfile) {
        userRole = scopedProfile.role;
        if (!tenantId && scopedProfile.tenant_id) {
          tenantId = scopedProfile.tenant_id;
        }
      }
    }

    if (!userRole || (userRole !== 'admin' && userRole !== 'moderator' && userRole !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace administrators and moderators can manage business logos.' },
        { status: 403 }
      );
    }

    // 3. Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const formTenantId = formData.get('tenantId') as string | null;

    if (formTenantId && !tenantId) {
      tenantId = formTenantId;
    }

    if (!tenantId) {
      // Find tenant where user is admin
      const tenantMatch = await masterDb.query.tenants.findFirst({
        where: eq(tenants.admin_email, user.email || '')
      }).catch(() => null);

      if (tenantMatch) {
        tenantId = tenantMatch.id;
      }
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context could not be identified.' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No logo file provided.' }, { status: 400 });
    }

    // 4. Validate Format and Size
    const mimeType = (file.type || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid file format. Please upload a PNG, JPEG, WebP, or SVG image.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 2MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB).` },
        { status: 400 }
      );
    }

    // 5. Upload using Supabase Admin Client (Service Role bypasses Storage RLS)
    const admin = createSupabaseAdminClient();
    const fileExt = (file.name ? file.name.split('.').pop() : 'png') || 'png';
    const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const fileName = `logos/tenant-${tenantId}-${Date.now()}.${cleanExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(fileName, fileBuffer, {
        contentType: mimeType || 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[API upload-logo] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = admin.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // 6. Update Database & Clean Up Previous Logo
    const existing = await masterDb.query.tenantBranding.findFirst({
      where: eq(tenantBranding.tenant_id, tenantId)
    });

    const oldLogoUrl = existing?.logo_url;

    if (existing) {
      await masterDb
        .update(tenantBranding)
        .set({
          logo_url: publicUrl,
          updated_at: new Date()
        })
        .where(eq(tenantBranding.tenant_id, tenantId));
    } else {
      await masterDb.insert(tenantBranding).values({
        tenant_id: tenantId,
        logo_url: publicUrl,
        updated_at: new Date()
      });
    }

    // If an old custom logo existed, remove it from storage in background
    if (oldLogoUrl && oldLogoUrl !== publicUrl && oldLogoUrl.includes('/avatars/logos/')) {
      const bucketMarker = '/avatars/';
      const markerIndex = oldLogoUrl.indexOf(bucketMarker);
      if (markerIndex !== -1) {
        const oldStoragePath = oldLogoUrl.substring(markerIndex + bucketMarker.length);
        admin.storage.from('avatars').remove([oldStoragePath]).catch((err) => {
          console.warn('[API upload-logo] Failed to delete old logo file:', err);
        });
      }
    }

    // 7. Clear Resolver In-Memory Cache
    clearTenantBrandingCache(tenantId);

    return NextResponse.json({
      success: true,
      logoUrl: publicUrl
    });

  } catch (err: any) {
    console.error('[API upload-logo] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while uploading logo' },
      { status: 500 }
    );
  }
}
