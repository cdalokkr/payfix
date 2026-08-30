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
        ['hostname spoof', { id: '22222222-2222-4222-8222-222222222222' }],
        ['query spoof', { tenant_schema: 'tenant_other_team' }],
        ['cookie spoof', { slug: '../other-team' }],
        ['suspended tenant', { status: 'suspended' }],
    ])('rejects a registry/header mismatch from %s routing', (_label, override) => {
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