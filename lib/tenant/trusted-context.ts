import { headers, cookies } from 'next/headers';
import { resolveTenant, type TenantMetadata } from './resolver';
import { tenantStorage, type TenantContext } from './store';
import { assertTenantSchemaName } from './schema-contract';
import { masterDb } from '@/lib/db/master-connection';
import { tenants } from '@/lib/db/master-schema';
import { eq } from 'drizzle-orm';

export type TrustedTenantContext = TenantContext & {
    trusted: true;
};

function isPostgresUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
    } catch {
        return false;
    }
}

function isTenantAvailable(tenant: TenantMetadata): boolean {
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') return false;

    const now = Date.now();
    if (tenant.license_expires_at && now > new Date(tenant.license_expires_at).getTime()) {
        return false;
    }
    if (tenant.status === 'trial' && tenant.trial_end && now > new Date(tenant.trial_end).getTime()) {
        return false;
    }

    return tenant.status === 'pending_setup' || tenant.status === 'trial' || tenant.status === 'active';
}

/**
 * Convert a control-plane tenant record into the only context shape accepted
 * by tenant database routing. Credentials and identifiers are copied solely
 * from the registry record; request headers are never used as values.
 */
export function tenantMetadataToTrustedContext(tenant: TenantMetadata): TrustedTenantContext | null {
    if (!isTenantAvailable(tenant)) return null;

    if (tenant.tenant_schema) {
        try {
            assertTenantSchemaName(tenant.tenant_schema);
        } catch {
            return null;
        }
    }

    if (tenant.database_url && !isPostgresUrl(tenant.database_url)) {
        return null;
    }

    return {
        tenantId: tenant.id,
        slug: tenant.slug,
        databaseUrl: tenant.database_url || null,
        tenantSchema: tenant.tenant_schema || null,
        brandName: tenant.branding?.app_name || tenant.company_name,
        licenseExpiresAt: tenant.license_expires_at
            ? new Date(tenant.license_expires_at).toISOString()
            : null,
        trusted: true,
    };
}

export async function resolveTrustedTenantBySlug(slug: string | null | undefined): Promise<TrustedTenantContext | null> {
    if (!slug?.trim()) return null;
    const tenant = await resolveTenant(slug.trim(), true);
    return tenant ? tenantMetadataToTrustedContext(tenant) : null;
}

export async function resolveTrustedTenantBySchema(schemaName: string | null | undefined): Promise<TrustedTenantContext | null> {
    if (!schemaName?.trim()) return null;

    try {
        assertTenantSchemaName(schemaName);
        const tenant = await masterDb.query.tenants.findFirst({
            where: eq(tenants.tenant_schema, schemaName),
        });
        return tenant
            ? tenantMetadataToTrustedContext(await resolveTenant(tenant.slug, true) || tenant as TenantMetadata)
            : null;
    } catch {
        return null;
    }
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
    const prefix = `${name}=`;
    const pair = cookieHeader
        ?.split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(prefix));
    return pair ? decodeURIComponent(pair.slice(prefix.length)) : null;
}

async function getRequestInputs(request?: Request): Promise<{
    host: string;
    tenantId: string | null;
    tenantSlug: string | null;
    tenantSchema: string | null;
    databaseUrl: string | null;
    fallbackSlug: string | null;
}> {
    if (request) {
        const requestHeaders = request.headers;
        return {
            host: requestHeaders.get('host') || '',
            tenantId: requestHeaders.get('x-tenant-id'),
            tenantSlug: requestHeaders.get('x-tenant-slug'),
            tenantSchema: requestHeaders.get('x-tenant-schema'),
            databaseUrl: requestHeaders.get('x-tenant-db-url'),
            fallbackSlug: getCookieValue(requestHeaders.get('cookie'), 'tenant_fallback'),
        };
    }

    const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
    return {
        host: requestHeaders.get('host') || '',
        tenantId: requestHeaders.get('x-tenant-id'),
        tenantSlug: requestHeaders.get('x-tenant-slug'),
        tenantSchema: requestHeaders.get('x-tenant-schema'),
        databaseUrl: requestHeaders.get('x-tenant-db-url'),
        fallbackSlug: cookieStore.get('tenant_fallback')?.value || null,
    };
}

/**
 * Resolve the tenant once from the control-plane registry. Header values are
 * treated only as consistency checks, while schema/database URL values always
 * come from the registry result.
 */
export async function resolveTrustedTenantFromRequest(request?: Request): Promise<TrustedTenantContext | null> {
    try {
        const inputs = await getRequestInputs(request);
        const lookup = inputs.tenantSlug || inputs.fallbackSlug || inputs.host;
        const tenant = lookup ? await resolveTenant(lookup, true) : null;
        if (!tenant) return null;

        if (inputs.tenantId && inputs.tenantId !== tenant.id) return null;
        if (inputs.tenantSlug && inputs.tenantSlug !== tenant.slug) return null;
        if (inputs.tenantSchema && inputs.tenantSchema !== (tenant.tenant_schema || '')) return null;
        if (inputs.databaseUrl !== null && inputs.databaseUrl !== (tenant.database_url || '')) return null;

        return tenantMetadataToTrustedContext(tenant);
    } catch {
        return null;
    }
}

export function getTrustedTenantStore(): TrustedTenantContext | null {
    const context = tenantStorage.getStore();
    return context?.trusted ? context as TrustedTenantContext : null;
}