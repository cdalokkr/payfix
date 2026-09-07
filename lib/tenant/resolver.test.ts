import { resolveTenant, clearResolverCache } from './resolver';
import { masterDb } from '@/lib/db/master-connection';
import { PRIMARY_TENANT_FALLBACK } from './schema-contract';

jest.mock('@/lib/db/master-connection', () => ({
    masterDb: {
        query: {
            tenants: {
                findFirst: jest.fn(),
            },
            tenantBranding: {
                findFirst: jest.fn(),
            },
        },
    },
}));

const mockedMasterDb = masterDb as any;

describe('resolveTenant resilience and fallbacks', () => {
    beforeEach(() => {
        clearResolverCache();
        jest.clearAllMocks();
    });

    it('resolves primary tenant on localhost when database query succeeds', async () => {
        mockedMasterDb.query.tenants.findFirst.mockResolvedValueOnce({
            id: 'c3e28d92-e3ea-4fe0-8efd-927ce550b666',
            slug: 'primary',
            company_name: 'PayFix Corporate',
            custom_domain: null,
            status: 'active',
            tenant_schema: 'tenant_primary',
            database_url: null,
            biometric_api_key: null,
            trial_start: new Date(),
            trial_end: new Date(),
            trial_duration_days: 3650,
            trial_extended: false,
            admin_email: 'admin@payfix.com',
            license_expires_at: new Date(),
        });
        mockedMasterDb.query.tenantBranding.findFirst.mockResolvedValueOnce(null);

        const result = await resolveTenant('localhost:3000');
        expect(result).not.toBeNull();
        expect(result?.slug).toBe('primary');
        expect(result?.tenant_schema).toBe('tenant_primary');
    });

    it('resolves primary tenant on private LAN IP (e.g. 10.16.0.226)', async () => {
        mockedMasterDb.query.tenants.findFirst.mockResolvedValueOnce({
            id: 'c3e28d92-e3ea-4fe0-8efd-927ce550b666',
            slug: 'primary',
            company_name: 'PayFix Corporate',
            custom_domain: null,
            status: 'active',
            tenant_schema: 'tenant_primary',
            database_url: null,
            biometric_api_key: null,
            trial_start: new Date(),
            trial_end: new Date(),
            trial_duration_days: 3650,
            trial_extended: false,
            admin_email: 'admin@payfix.com',
            license_expires_at: new Date(),
        });

        const result = await resolveTenant('10.16.0.226:3000');
        expect(result).not.toBeNull();
        expect(result?.slug).toBe('primary');
    });

    it('falls back to PRIMARY_TENANT_FALLBACK when masterDb throws ENOTFOUND on localhost', async () => {
        const dnsError = new Error('getaddrinfo ENOTFOUND aws-1-ap-south-1.pooler.supabase.com');
        mockedMasterDb.query.tenants.findFirst.mockRejectedValue(dnsError);

        const result = await resolveTenant('localhost');
        expect(result).not.toBeNull();
        expect(result?.slug).toBe('primary');
        expect(result?.tenant_schema).toBe('tenant_primary');
        expect(result?.id).toBe(PRIMARY_TENANT_FALLBACK.id);
    });

    it('returns stale cached metadata if database throws on forceRefresh', async () => {
        const tenantData = {
            id: 'custom-id',
            slug: 'custom',
            company_name: 'Custom Corp',
            custom_domain: null,
            status: 'active',
            tenant_schema: 'tenant_custom',
            database_url: null,
            biometric_api_key: null,
            trial_start: new Date(),
            trial_end: new Date(),
            trial_duration_days: 30,
            trial_extended: false,
            admin_email: 'custom@example.com',
            license_expires_at: new Date(),
        };

        // First call succeeds and caches
        mockedMasterDb.query.tenants.findFirst.mockResolvedValueOnce(tenantData);
        const initial = await resolveTenant('custom');
        expect(initial?.slug).toBe('custom');

        // Second call with forceRefresh encounters DB drop
        mockedMasterDb.query.tenants.findFirst.mockRejectedValue(new Error('Connection timeout'));
        const fallback = await resolveTenant('custom', true);
        expect(fallback).not.toBeNull();
        expect(fallback?.slug).toBe('custom');
        expect(fallback?.tenant_schema).toBe('tenant_custom');
    });
});
