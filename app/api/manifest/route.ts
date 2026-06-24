import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant } from '@/lib/tenant/resolver';

export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get('x-tenant-slug') 
        || request.nextUrl.searchParams.get('tenant');
        
    let tenant = null;
    if (tenantSlug) {
        // Resolve tenant branding from central DB using slug
        tenant = await resolveTenant(tenantSlug);
    } else {
        // Try to resolve from hostname if search parameter is not provided
        const hostname = request.headers.get('host') || '';
        tenant = await resolveTenant(hostname);
    }

    const appName = tenant?.branding?.app_name || 'PayFix';
    const shortName = tenant?.branding?.short_name || appName;
    const tagline = tenant?.branding?.tagline || `${appName} - Employee Portal`;
    const primaryColor = tenant?.branding?.primary_color || '#4f46e5';
    const secondaryColor = tenant?.branding?.secondary_color || '#020617';
    const logoUrl = tenant?.branding?.logo_url || '/icons/icon-192x192.png';
    const pwaDisplay = tenant?.branding?.pwa_display || 'standalone';
    const pwaOrientation = tenant?.branding?.pwa_orientation || 'portrait';

    const manifest = {
        name: appName,
        short_name: shortName,
        description: tagline,
        start_url: '/mobile',
        display: pwaDisplay,
        orientation: pwaOrientation,
        background_color: secondaryColor,
        theme_color: primaryColor,
        icons: [
            {
                src: logoUrl,
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
            },
            {
                src: logoUrl,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
            }
        ],
        categories: ['business', 'productivity'],
        prefer_related_applications: false,
        related_applications: []
    };

    return NextResponse.json(manifest, {
        headers: {
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200'
        }
    });
}
