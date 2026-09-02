/** @jest-environment node */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db, centralDb } from '@/lib/db';
import {
    createOptimizedContext,
    invalidateAllSessions,
    invalidateUserSession,
} from './optimized-context';
import { resolveTrustedTenantFromRequest } from '@/lib/tenant/trusted-context';

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
    headers: jest.fn(),
}));

const mockSessions = new Map<string, { id: string; email: string }>();
const mockTenantRecords = new Map<string, any>();
const mockProfileRecords = new Map<string, any>();

jest.mock('@/lib/tenant/trusted-context', () => {
    const { tenantStorage } = jest.requireActual('@/lib/tenant/store');

    const trustedContextFor = (tenant: any) => tenant && tenant.status === 'active'
        ? {
            tenantId: tenant.id,
            slug: tenant.slug,
            databaseUrl: tenant.database_url,
            tenantSchema: tenant.tenant_schema,
            brandName: tenant.company_name,
            licenseExpiresAt: tenant.license_expires_at?.toISOString?.() || null,
            trusted: true,
        }
        : null;

    const resolveFromRequest = async (request?: Request) => {
        const host = request?.headers.get('host') || '';
        const tenant = mockTenantRecords.get(host);
        if (!tenant) return null;

        const expected = {
            id: tenant.id,
            slug: tenant.slug,
            schema: tenant.tenant_schema,
        };
        if (
            (request?.headers.get('x-tenant-id') && request.headers.get('x-tenant-id') !== expected.id)
            || (request?.headers.get('x-tenant-slug') && request.headers.get('x-tenant-slug') !== expected.slug)
            || (request?.headers.get('x-tenant-schema') && request.headers.get('x-tenant-schema') !== expected.schema)
        ) {
            return null;
        }

        return trustedContextFor(tenant);
    };

    return {
        getTrustedTenantStore: () => {
            const context = tenantStorage.getStore();
            return context?.trusted ? context : null;
        },
        resolveTrustedTenantBySlug: async (slug: string) => {
            const tenant = [...mockTenantRecords.values()].find((record: any) => record.slug === slug);
            return trustedContextFor(tenant);
        },
        resolveTrustedTenantFromRequest: resolveFromRequest,
    };
});

jest.mock('@/lib/db', () => {
    const { tenantStorage } = jest.requireActual('@/lib/tenant/store');

    function profileIdFromWhere(where: any): string | null {
        const chunks = where?.queryChunks || [];
        const valueChunk = chunks.find((chunk: any) => typeof chunk?.value === 'string');
        return valueChunk?.value || null;
    }

    const findTenantProfile = jest.fn(async (config: any) => {
        // Keep the delay so Promise.all below exercises two overlapping
        // requests instead of only checking sequential behavior.
        await new Promise(resolve => setTimeout(resolve, 5));
        const tenant = tenantStorage.getStore();
        const profileId = profileIdFromWhere(config?.where);
        return tenant && profileId
            ? mockProfileRecords.get(`${tenant.tenantId}:${profileId}`) || null
            : null;
    });

    const findCentralProfile = jest.fn(async (config: any) => {
        const profileId = profileIdFromWhere(config?.where);
        // A regular public profile must never become a tenant profile.
        return profileId
            ? {
                id: profileId,
                email: `public-${profileId}@example.com`,
                role: 'employee',
                status: 'active',
            }
            : null;
    });

    return {
        db: {
            query: {
                profiles: { findFirst: findTenantProfile },
            },
        },
        centralDb: {
            query: {
                profiles: { findFirst: findCentralProfile },
            },
        },
    };
});

const mockedCreateServerClient = jest.mocked(createServerClient);
const mockedCookies = jest.mocked(cookies);
const tenants = {
    acme: {
        id: '11111111-1111-4111-8111-111111111111',
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
        admin_email: 'admin@acme.example',
        license_expires_at: new Date('2026-12-31'),
        branding: null,
    },
    beta: {
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'beta',
        company_name: 'Beta',
        custom_domain: null,
        status: 'active',
        tenant_schema: 'tenant_beta',
        database_url: null,
        biometric_api_key: null,
        trial_start: new Date('2026-01-01'),
        trial_end: new Date('2026-12-31'),
        trial_duration_days: 365,
        trial_extended: false,
        admin_email: 'admin@beta.example',
        license_expires_at: new Date('2026-12-31'),
        branding: null,
    },
};

const profiles = {
    acme: {
        id: 'user-acme',
        email: 'employee@acme.example',
        role: 'employee',
        status: 'active',
        tenantSlug: 'acme',
    },
    beta: {
        id: 'user-beta',
        email: 'employee@beta.example',
        role: 'employee',
        status: 'active',
        tenantSlug: 'beta',
    },
};

function requestFor(token: string, host: string, headers: Record<string, string> = {}): Request {
    return {
        headers: new Headers({
            host,
            cookie: `sb-test-auth-token=${token}`,
            ...headers,
        }),
    } as Request;
}

function configureSupabaseSessions() {
    mockedCreateServerClient.mockImplementation((_url, _key, options: any) => {
        const bearer = options.global?.headers?.Authorization?.replace(/^Bearer /, '');
        const cookieToken = options.cookies
            .getAll()
            .find((entry: { name: string }) => entry.name.includes('-auth-token'))
            ?.value;
        const token = bearer || cookieToken;
        const session = token ? mockSessions.get(token) : undefined;

        return {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: session || null },
                    error: session ? null : { message: 'Invalid session' },
                }),
            },
            rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        } as never;
    });
}

function seedTenantProfiles() {
    mockTenantRecords.set('acme.payfix.com', tenants.acme);
    mockTenantRecords.set('beta.payfix.com', tenants.beta);
    mockTenantRecords.set('acme', tenants.acme);
    mockTenantRecords.set('beta', tenants.beta);
    mockProfileRecords.set(`${tenants.acme.id}:${profiles.acme.id}`, profiles.acme);
    mockProfileRecords.set(`${tenants.beta.id}:${profiles.beta.id}`, profiles.beta);
}

describe('production-like tenant session isolation', () => {
    beforeEach(() => {
        invalidateAllSessions();
        mockSessions.clear();
        mockTenantRecords.clear();
        mockProfileRecords.clear();
        mockedCreateServerClient.mockReset();
        mockedCookies.mockResolvedValue({
            getAll: () => [],
            set: jest.fn(),
        } as never);
        seedTenantProfiles();
        configureSupabaseSessions();
    });

    it('keeps two concurrent cookie sessions on their own registry tenant', async () => {
        mockSessions.set('cookie-acme', { id: profiles.acme.id, email: profiles.acme.email });
        mockSessions.set('cookie-beta', { id: profiles.beta.id, email: profiles.beta.email });

        const [acmeContext, betaContext] = await Promise.all([
            createOptimizedContext(requestFor('cookie-acme', 'acme.payfix.com')),
            createOptimizedContext(requestFor('cookie-beta', 'beta.payfix.com')),
        ]);

        expect(acmeContext.tenant?.slug).toBe('acme');
        expect(acmeContext.profile?.email).toBe(profiles.acme.email);
        expect(betaContext.tenant?.slug).toBe('beta');
        expect(betaContext.profile?.email).toBe(profiles.beta.email);
        expect(acmeContext.profile?.email).not.toBe(betaContext.profile?.email);
        expect(db).toBeDefined();
        expect(centralDb).toBeDefined();
    });

    it('rejects revoked cookie and bearer sessions even after an old cache entry exists', async () => {
        mockSessions.set('cookie-acme', { id: profiles.acme.id, email: profiles.acme.email });
        const request = requestFor('cookie-acme', 'acme.payfix.com');

        const first = await createOptimizedContext(request);
        expect(first.profile?.email).toBe(profiles.acme.email);

        mockSessions.delete('cookie-acme');
        const revokedCookie = await createOptimizedContext(request);
        expect(revokedCookie.user).toBeNull();
        expect(revokedCookie.profile).toBeNull();

        mockSessions.set('bearer-acme', { id: profiles.acme.id, email: profiles.acme.email });
        const bearerRequest = {
            headers: new Headers({
                host: 'acme.payfix.com',
                authorization: 'Bearer bearer-acme',
            }),
        } as Request;
        const bearerContext = await createOptimizedContext(bearerRequest);
        expect(bearerContext.profile?.email).toBe(profiles.acme.email);

        mockSessions.delete('bearer-acme');
        const revokedBearer = await createOptimizedContext(bearerRequest);
        expect(revokedBearer.user).toBeNull();
        expect(revokedBearer.profile).toBeNull();
    });

    it('applies profile role/status changes after session invalidation and blocks suspended tenants', async () => {
        mockSessions.set('cookie-acme', { id: profiles.acme.id, email: profiles.acme.email });
        const request = requestFor('cookie-acme', 'acme.payfix.com');

        const first = await createOptimizedContext(request);
        expect(first.profile?.role).toBe('employee');

        mockProfileRecords.set(`${tenants.acme.id}:${profiles.acme.id}`, {
            ...profiles.acme,
            role: 'admin',
            status: 'inactive',
        });
        invalidateUserSession(profiles.acme.id);

        const changed = await createOptimizedContext(request);
        expect(changed.profile?.role).toBe('admin');
        expect(changed.profile?.status).toBe('inactive');

        mockTenantRecords.set('acme.payfix.com', { ...tenants.acme, status: 'suspended' });
        invalidateUserSession(profiles.acme.id);

        const suspended = await createOptimizedContext(request);
        expect(suspended.tenant).toBeNull();
        expect(suspended.profile).toBeNull();
    });

    it('does not let spoofed tenant headers select another registry tenant or public profile', async () => {
        mockSessions.set('cookie-acme', { id: profiles.acme.id, email: profiles.acme.email });

        const context = await createOptimizedContext(requestFor('cookie-acme', 'acme.payfix.com', {
            'x-tenant-id': tenants.beta.id,
            'x-tenant-slug': tenants.beta.slug,
            'x-tenant-schema': tenants.beta.tenant_schema,
        }));

        expect(context.tenant).toBeNull();
        expect(context.profile).toBeNull();
    });
});