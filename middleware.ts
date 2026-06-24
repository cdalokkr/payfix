import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant } from '@/lib/tenant/resolver';
import authMiddleware from '@/lib/auth/auth-middleware';

export async function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();
    const hostname = request.headers.get('host') || '';

    // Exclude static assets and static files
    if (
        url.pathname.startsWith('/_next') ||
        url.pathname.startsWith('/api/public') ||
        url.pathname.startsWith('/favicon.ico') ||
        url.pathname.startsWith('/robots.txt') ||
        url.pathname.startsWith('/sitemap.xml') ||
        url.pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // 1. Resolve Tenant from Hostname
    const tenant = await resolveTenant(hostname);
    
    // Redirect if tenant not found but trying to access subdomains
    const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'payfix.com';
    const isMainDomain = hostname === mainDomain || hostname === `www.${mainDomain}` || hostname.endsWith('.vercel.app');
    
    if (!tenant && !isMainDomain) {
        return new NextResponse('Workspace Not Found', { status: 404 });
    }

    // 2. Gatekeeper: Expiry and Suspension Check
    if (tenant) {
        const isExpiredPage = url.pathname === '/trial-expired';
        
        const isSuspended = tenant.status === 'suspended' || tenant.status === 'cancelled';
        let isTrialExpired = false;
        
        if (tenant.status === 'trial') {
            const trialExpiry = new Date(tenant.trial_start);
            trialExpiry.setDate(trialExpiry.getDate() + tenant.trial_duration_days);
            if (Date.now() > trialExpiry.getTime()) {
                isTrialExpired = true;
            }
        }

        if (isSuspended || isTrialExpired) {
            if (!isExpiredPage && !url.pathname.startsWith('/api/')) {
                const expiredUrl = new URL('/trial-expired', request.url);
                return NextResponse.redirect(expiredUrl);
            }
        } else {
            // Redirect away from /trial-expired if active
            if (isExpiredPage) {
                const homeUrl = new URL('/', request.url);
                return NextResponse.redirect(homeUrl);
            }
        }
    }

    // 3. Dynamic Manifest Rewrite
    if (url.pathname === '/manifest.json' && tenant) {
        url.pathname = '/api/manifest';
        url.searchParams.set('tenant', tenant.slug);
        return NextResponse.rewrite(url);
    }

    // 4. Propagate Headers to Request (so authMiddleware and API routes can read them)
    const requestHeaders = new Headers(request.headers);
    
    // Strip incoming client headers to prevent spoofing/header injection overrides
    requestHeaders.delete('x-tenant-id');
    requestHeaders.delete('x-tenant-slug');
    requestHeaders.delete('x-tenant-db-url');
    requestHeaders.delete('x-tenant-schema');
    requestHeaders.delete('x-tenant-brand');
    requestHeaders.delete('x-tenant-theme');

    if (tenant) {
        requestHeaders.set('x-tenant-id', tenant.id);
        requestHeaders.set('x-tenant-slug', tenant.slug);
        requestHeaders.set('x-tenant-db-url', tenant.database_url || '');
        requestHeaders.set('x-tenant-schema', tenant.tenant_schema || '');
        requestHeaders.set('x-tenant-brand', tenant.branding?.app_name || tenant.company_name);
        requestHeaders.set('x-tenant-theme', JSON.stringify({
            primary: tenant.branding?.primary_color || '#4f46e5',
            secondary: tenant.branding?.secondary_color || '#0f172a',
            logo: tenant.branding?.logo_url || '/logo.png'
        }));
    }

    // Create a new request with the updated headers
    const modifiedRequest = new NextRequest(request, {
        headers: requestHeaders
    });

    // 5. Run Auth Middleware
    const authResponse = await authMiddleware(modifiedRequest);

    // 6. Merge tenant headers into response so downstream client-side can read them
    if (tenant && authResponse) {
        authResponse.headers.set('x-tenant-id', tenant.id);
        authResponse.headers.set('x-tenant-slug', tenant.slug);
        authResponse.headers.set('x-tenant-brand', tenant.branding?.app_name || tenant.company_name);
    }

    return authResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - api/public (public APIs)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api/public|_next/static|_next/image|favicon.ico).*)',
    ],
};
