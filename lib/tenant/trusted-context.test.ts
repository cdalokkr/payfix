import {
    resolveTrustedTenantFromRequest,
    tenantMetadataToTrustedContext,
} from './trusted-context';
import { resolveTenant, type TenantMetadata } from './resolver';

jest.mock('./resolver', () => ({
    resolveTenant: jest.fn(),
}));

const mockedResolveTenant = resolveTenant as jest.MockedFunction<typeof resolveTenant>;

function tenant(overrides: Partial<TenantMetadata> = {}): TenantMetadata {
    return {
        id: 'tenant-id',
        slug: 'acme',
        company_name: 'Acme',
        custom_domain: null,
        status: 'active',
        tenant_schema: 'tenant_acme',
        database_url: null,
        biometric_api_key: null,
        trial_start: new Date('2026-01-01'),
        trial_end: new Date('2026-12-31'),
        trial_duration_days: 365,
        trial_extended: false,
        admin_email: 'admin@example.com',
        license_expires_at: new Date('2026-12-31'),
        branding: null,
        ...overrides,
    } as TenantMetadata;
}

describe('trusted tenant context', () => {
    beforeEach(() => {
        mockedResolveTenant.mockReset();
    });

    it('copies routing values from the registry and marks the context trusted', () => {
        const context = tenantMetadataToTrustedContext(tenant());

        expect(context).toEqual(expect.objectContaining({
            tenantId: 'tenant-id',
            slug: 'acme',
            tenantSchema: 'tenant_acme',
            trusted: true,
        }));
        expect((context as any).databaseUrl).toBeNull();
    });

    it('rejects suspended tenants and public or unsafe schemas', () => {
        expect(tenantMetadataToTrustedContext(tenant({ status: 'suspended' }))).toBeNull();
        expect(tenantMetadataToTrustedContext(tenant({ tenant_schema: 'public' }))).toBeNull();
        expect(tenantMetadataToTrustedContext(tenant({ tenant_schema: 'tenant_bad-name' }))).toBeNull();
    });

    it('treats forwarded database and schema headers as consistency checks only', async () => {
        mockedResolveTenant.mockResolvedValue(tenant());

        const valid = await resolveTrustedTenantFromRequest({
            headers: new Headers({
                host: 'acme.payfix.com',
                'x-tenant-slug': 'acme',
                'x-tenant-schema': 'tenant_acme',
                'x-tenant-db-url': '',
            }),
        } as Request);
        expect(valid?.trusted).toBe(true);
        expect(valid?.tenantSchema).toBe('tenant_acme');

        const spoofed = await resolveTrustedTenantFromRequest({
            headers: new Headers({
                host: 'acme.payfix.com',
                'x-tenant-slug': 'acme',
                'x-tenant-schema': 'tenant_other',
            }),
        } as Request);
        expect(spoofed).toBeNull();
    });

    it('uses the host for lookup instead of a spoofed tenant slug', async () => {
        mockedResolveTenant.mockImplementation(async (lookup) => {
            if (lookup === 'acme.payfix.com') return tenant();
            return null;
        });

        const spoofed = await resolveTrustedTenantFromRequest({
            headers: new Headers({
                host: 'acme.payfix.com',
                'x-tenant-slug': 'beta',
            }),
        } as Request);

        expect(spoofed).toBeNull();
        expect(mockedResolveTenant).toHaveBeenCalledWith('acme.payfix.com', true);

        mockedResolveTenant.mockClear();
        const missingHost = await resolveTrustedTenantFromRequest({
            headers: new Headers({
                'x-tenant-slug': 'acme',
            }),
        } as Request);

        expect(missingHost).toBeNull();
        expect(mockedResolveTenant).not.toHaveBeenCalled();
    });

    it('accepts a fallback cookie only on the main application host', async () => {
        mockedResolveTenant.mockImplementation(async (lookup) => {
            if (lookup === 'beta') return tenant({ slug: 'beta', tenant_schema: 'tenant_beta' });
            return null;
        });

        const context = await resolveTrustedTenantFromRequest({
            headers: new Headers({
                host: 'payfix.vercel.app',
                cookie: 'tenant_fallback=beta',
                'x-tenant-slug': 'beta',
            }),
        } as Request);

        expect(context?.slug).toBe('beta');
        expect(mockedResolveTenant).toHaveBeenCalledWith('beta', true);
    });
});