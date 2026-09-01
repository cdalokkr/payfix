import { and, eq } from 'drizzle-orm'
import { masterDb } from '@/lib/db/master-connection'
import { tenants } from '@/lib/db/master-schema'
import type { TenantContext } from './store'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TENANT_SCHEMA_PATTERN = /^tenant_[a-z0-9_]{3,40}$/
const TENANT_SLUG_PATTERN = /^[a-z0-9-]{3,30}$/
const BLOCKED_STATUSES = new Set(['suspended', 'cancelled'])

type TenantRecord = typeof tenants.$inferSelect

export class TenantContextError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'TenantContextError'
    }
}

export function tenantRuntimeRoleName(tenantId: string): string {
    if (!UUID_PATTERN.test(tenantId)) {
        throw new TenantContextError('Tenant ID is invalid.')
    }
    return `payfix_tenant_${tenantId.replace(/-/g, '').toLowerCase()}`
}

export function createTrustedTenantContext(tenant: TenantRecord): TenantContext {
    if (!UUID_PATTERN.test(tenant.id)) {
        throw new TenantContextError('Tenant registry ID is invalid.')
    }
    if (!TENANT_SLUG_PATTERN.test(tenant.slug)) {
        throw new TenantContextError('Tenant registry slug is invalid.')
    }
    if (!tenant.tenant_schema || !TENANT_SCHEMA_PATTERN.test(tenant.tenant_schema)) {
        throw new TenantContextError('Tenant registry schema is invalid.')
    }
    if (BLOCKED_STATUSES.has(tenant.status)) {
        throw new TenantContextError('Tenant is not active.')
    }

    const context: TenantContext = {
        tenantId: tenant.id,
        slug: tenant.slug,
        databaseUrl: tenant.database_url || null,
        tenantSchema: tenant.tenant_schema,
        brandName: tenant.company_name,
        trusted: true,
    }
    if (tenant.license_expires_at) {
        context.licenseExpiresAt = new Date(tenant.license_expires_at).toISOString()
    }
    return context
}

export async function resolveTrustedTenantContext(requestHeaders: Headers): Promise<TenantContext> {
    const tenantId = requestHeaders.get('x-tenant-id')
    const slug = requestHeaders.get('x-tenant-slug')
    const tenantSchema = requestHeaders.get('x-tenant-schema')

    if (!tenantId || !slug || !tenantSchema) {
        throw new TenantContextError('Trusted tenant headers are required.')
    }
    if (!UUID_PATTERN.test(tenantId) || !TENANT_SLUG_PATTERN.test(slug) || !TENANT_SCHEMA_PATTERN.test(tenantSchema)) {
        throw new TenantContextError('Trusted tenant headers are malformed.')
    }

    const tenant = await masterDb.query.tenants.findFirst({
        where: and(
            eq(tenants.id, tenantId),
            eq(tenants.slug, slug),
            eq(tenants.tenant_schema, tenantSchema),
        ),
    })
    if (!tenant) {
        throw new TenantContextError('Tenant headers do not match the tenant registry.')
    }
    return createTrustedTenantContext(tenant)
}

export async function resolveTrustedTenantBySchema(tenantSchema: string): Promise<TenantContext> {
    if (!TENANT_SCHEMA_PATTERN.test(tenantSchema)) {
        throw new TenantContextError('Tenant schema is invalid.')
    }
    const tenant = await masterDb.query.tenants.findFirst({
        where: eq(tenants.tenant_schema, tenantSchema),
    })
    if (!tenant) {
        throw new TenantContextError('Tenant schema is not registered.')
    }
    return createTrustedTenantContext(tenant)
}

export async function resolveTrustedTenantBySlug(slug: string): Promise<TenantContext> {
    if (!TENANT_SLUG_PATTERN.test(slug)) {
        throw new TenantContextError('Tenant slug is invalid.')
    }
    const tenant = await masterDb.query.tenants.findFirst({
        where: eq(tenants.slug, slug),
    })
    if (!tenant) {
        throw new TenantContextError('Tenant slug is not registered.')
    }
    return createTrustedTenantContext(tenant)
}