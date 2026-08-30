import { createTrustedTenantContext, tenantRuntimeRoleName, TenantContextError } from '@/lib/tenant/trusted-context'

const registeredTenant = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'acme-team',
    tenant_schema: 'tenant_acme_team',
    database_url: null,
    company_name: 'Acme Team',
    status: 'active',
} as any

describe('trusted tenant context', () => {
    it('derives a stable non-login runtime role from the registry UUID', () => {
        expect(tenantRuntimeRoleName(registeredTenant.id))
            .toBe('payfix_tenant_11111111111141118111111111111111')
    })

    it.each([
        ['invalid registry UUID', { id: 'not-a-uuid' }],
        ['invalid registry schema', { tenant_schema: 'public' }],
        ['invalid registry slug', { slug: '../other-team' }],
        ['suspended tenant', { status: 'suspended' }],
    ])('rejects an invalid tenant registry record from %s', (_label, override) => {
        expect(() => createTrustedTenantContext({ ...registeredTenant, ...override }))
            .toThrow(TenantContextError)
    })

    it('builds context only from a valid active registry record', () => {
        expect(createTrustedTenantContext(registeredTenant)).toEqual({
            tenantId: registeredTenant.id,
            slug: registeredTenant.slug,
            databaseUrl: null,
            tenantSchema: registeredTenant.tenant_schema,
            brandName: registeredTenant.company_name,
            trusted: true,
        })
    })
})