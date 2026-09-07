import { masterDb } from '@/lib/db/master-connection';
import { tenants, tenantBranding } from '@/lib/db/master-schema';
import { eq, or } from 'drizzle-orm';

export interface TenantMetadata {
    id: string;
    slug: string;
    company_name: string;
    custom_domain: string | null;
    status: string;
    tenant_schema: string | null;
    database_url: string | null;
    biometric_api_key: string | null;
    trial_start: Date;
    trial_end: Date;
    trial_duration_days: number;
    trial_extended: boolean;
    admin_email: string;
    license_expires_at: Date;
    branding?: {
        app_name: string;
        short_name: string | null;
        tagline: string | null;
        primary_color: string;
        secondary_color: string;
        accent_color: string;
        background_color: string;
        theme_color: string;
        logo_url: string | null;
        favicon_url: string | null;
        splash_url: string | null;
        pwa_display: string;
        pwa_orientation: string;
    } | null;
}

// In-memory cache for resolved hostnames to prevent overloading database
const resolverCache = new Map<string, { data: TenantMetadata | null; expires: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache expiration

import { isLocalOrPrivateIp, PRIMARY_TENANT_FALLBACK } from './schema-contract';

async function queryWithRetry<T>(queryFn: () => Promise<T>, retries = 1, delayMs = 250): Promise<T> {
    try {
        return await queryFn();
    } catch (err) {
        if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return queryWithRetry(queryFn, retries - 1, delayMs * 2);
        }
        throw err;
    }
}

export async function resolveTenant(hostname: string, forceRefresh = false): Promise<TenantMetadata | null> {
    // Normalize hostname and strip port if present
    const host = hostname.split(':')[0].toLowerCase().trim();

    if (!forceRefresh) {
        const cached = resolverCache.get(host);
        if (cached && Date.now() < cached.expires) {
            return cached.data;
        }
    }

    const mainDomain = (process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'payfix.com').toLowerCase();
    let isSubdomain = false;
    let slug = '';


    if (host.endsWith(mainDomain)) {
        const subdomain = host.replace(`.${mainDomain}`, '');
        if (subdomain !== 'www' && subdomain !== host) {
            slug = subdomain;
            isSubdomain = true;
        }
    }

    const isMainDomain = 
        host === mainDomain || 
        host === `www.${mainDomain}` || 
        host.endsWith('.vercel.app') ||
        isLocalOrPrivateIp(host);

    try {
        let tenantRecord;
        if (isSubdomain) {
            // Find by subdomain slug
            tenantRecord = await queryWithRetry(() => masterDb.query.tenants.findFirst({
                where: eq(tenants.slug, slug),
            }));
        } else if (isMainDomain) {
            tenantRecord = await queryWithRetry(() => masterDb.query.tenants.findFirst({
                where: eq(tenants.slug, 'primary'),
            }));
        } else {
            // Find by custom domain mapping or matching slug directly (e.g. for local testing)
            tenantRecord = await queryWithRetry(() => masterDb.query.tenants.findFirst({
                where: or(
                    eq(tenants.custom_domain, host),
                    eq(tenants.slug, host)
                ),
            }));
        }

        if (!tenantRecord) {
            resolverCache.set(host, { data: null, expires: Date.now() + CACHE_TTL });
            return null;
        }

        // Retrieve white-label branding configurations
        let brandingRecord: any = null;
        try {
            brandingRecord = await queryWithRetry(() => masterDb.query.tenantBranding.findFirst({
                where: eq(tenantBranding.tenant_id, tenantRecord.id),
            }), 1, 100);
        } catch (brandingErr) {
            console.warn('[Tenant Resolver] Failed to fetch branding, using defaults:', brandingErr);
        }

        const tenantData: TenantMetadata = {
            id: tenantRecord.id,
            slug: tenantRecord.slug,
            company_name: tenantRecord.company_name,
            custom_domain: tenantRecord.custom_domain,
            status: tenantRecord.status,
            tenant_schema: tenantRecord.tenant_schema,
            database_url: tenantRecord.database_url,
            biometric_api_key: tenantRecord.biometric_api_key,
            trial_start: tenantRecord.trial_start,
            trial_end: tenantRecord.trial_end,
            trial_duration_days: tenantRecord.trial_duration_days,
            trial_extended: tenantRecord.trial_extended,
            admin_email: tenantRecord.admin_email,
            license_expires_at: tenantRecord.license_expires_at,
            branding: brandingRecord ? {
                app_name: brandingRecord.app_name,
                short_name: brandingRecord.short_name,
                tagline: brandingRecord.tagline,
                primary_color: brandingRecord.primary_color,
                secondary_color: brandingRecord.secondary_color,
                accent_color: brandingRecord.accent_color,
                background_color: brandingRecord.background_color,
                theme_color: brandingRecord.theme_color,
                logo_url: brandingRecord.logo_url,
                favicon_url: brandingRecord.favicon_url,
                splash_url: brandingRecord.splash_url,
                pwa_display: brandingRecord.pwa_display,
                pwa_orientation: brandingRecord.pwa_orientation,
            } : null,
        };

        resolverCache.set(host, { data: tenantData, expires: Date.now() + CACHE_TTL });
        return tenantData;

    } catch (err) {
        console.error(`[Tenant Resolver] Error resolving hostname ${host}:`, err);

        // Fallback 1: Return stale cached metadata if previously cached
        const staleCached = resolverCache.get(host);
        if (staleCached?.data) {
            console.warn(`[Tenant Resolver] Returning stale cached tenant metadata for ${host}`);
            return staleCached.data;
        }

        // Fallback 2: For main domain / localhost / private IP or primary slug, fallback to PRIMARY_TENANT_FALLBACK
        if (isMainDomain || slug === 'primary' || host === 'primary') {
            console.warn(`[Tenant Resolver] Using fallback primary tenant metadata for ${host}`);
            resolverCache.set(host, { data: PRIMARY_TENANT_FALLBACK, expires: Date.now() + CACHE_TTL });
            return PRIMARY_TENANT_FALLBACK;
        }

        return null;
    }
}

/**
 * Clears resolver cache entries for a deleted tenant.
 * Called by deprovisionTenant() during tenant deletion.
 */
export function clearResolverCache(slug?: string): void {
    if (!slug) {
        resolverCache.clear();
        return;
    }
    for (const [key] of resolverCache.entries()) {
        if (key === slug || key.includes(slug)) {
            resolverCache.delete(key);
        }
    }
}
