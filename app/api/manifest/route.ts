import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant, type TenantMetadata } from '@/lib/tenant/resolver';

export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get('type');

    // Dedicated Manifest for Kiosk Terminal PWA Installation
    if (type === 'kiosk') {
        const kioskManifest = {
            id: '/kiosk',
            name: 'PayFix Attendance Kiosk Terminal',
            short_name: 'PayFix Kiosk',
            description: 'Touchless Entrance Face Verification Attendance Kiosk',
            start_url: '/kiosk',
            scope: '/kiosk',
            display: 'standalone',
            orientation: 'any',
            background_color: '#020617',
            theme_color: '#0f172a',
            icons: [
                {
                    src: '/icons/icon-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: '/icons/icon-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any maskable'
                }
            ],
            categories: ['business', 'productivity'],
            prefer_related_applications: false,
            related_applications: []
        };

        return NextResponse.json(kioskManifest, {
            headers: {
                'Content-Type': 'application/manifest+json',
                'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200'
            }
        });
    }

    let tenant: TenantMetadata | null = null;
    // Resolve from the host first. Proxy-added tenant headers are routing
    // hints, not an authorization source, and can be spoofed on direct calls.
    const hostname = request.headers.get('host') || '';
    tenant = await resolveTenant(hostname);
    if (!tenant) {
        const requestedSlug = request.nextUrl.searchParams.get('tenant');
        if (requestedSlug) {
            tenant = await resolveTenant(requestedSlug);
        }
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
        id: '/mobile',
        name: appName,
        short_name: shortName,
        description: tagline,
        start_url: '/mobile',
        scope: '/',
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
            'Cache-Control': 'private, no-store, max-age=0'
        }
    });
}
