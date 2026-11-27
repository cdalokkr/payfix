import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get('type');

    // Dedicated Manifest for Kiosk Terminal PWA Installation
    if (type === 'kiosk') {
        const kioskManifest = {
            id: '/kiosk',
            name: 'NIYAMO Attendance Kiosk Terminal',
            short_name: 'NIYAMO Kiosk',
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
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
            }
        });
    }

    // Standard Universal NIYAMO PWA Manifest across all tenants
    const manifest = {
        id: '/mobile',
        name: 'NIYAMO Attendance',
        short_name: 'NIYAMO',
        description: 'Multi-tenant biometric attendance, geofencing & payroll platform',
        start_url: '/mobile',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#020617',
        theme_color: '#4f46e5',
        icons: [
            {
                src: '/icons/icon-72x72.png',
                sizes: '72x72',
                type: 'image/png',
                purpose: 'any maskable'
            },
            {
                src: '/icons/icon-96x96.png',
                sizes: '96x96',
                type: 'image/png',
                purpose: 'any maskable'
            },
            {
                src: '/icons/icon-128x128.png',
                sizes: '128x128',
                type: 'image/png',
                purpose: 'any maskable'
            },
            {
                src: '/icons/icon-144x144.png',
                sizes: '144x144',
                type: 'image/png',
                purpose: 'any maskable'
            },
            {
                src: '/icons/icon-152x152.png',
                sizes: '152x152',
                type: 'image/png',
                purpose: 'any maskable'
            },
            {
                src: '/icons/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
            },
            {
                src: '/icons/icon-384x384.png',
                sizes: '384x384',
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
        shortcuts: [
            {
                name: 'Mark Attendance',
                short_name: 'Attendance',
                description: 'Mark your daily attendance',
                url: '/mobile/attendance',
                icons: [
                    {
                        src: '/icons/icon-96x96.png',
                        sizes: '96x96'
                    }
                ]
            }
        ],
        categories: ['business', 'productivity'],
        prefer_related_applications: false,
        related_applications: []
    };

    return NextResponse.json(manifest, {
        headers: {
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
        }
    });
}
