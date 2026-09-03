/** @jest-environment node */

import { cookies, headers } from 'next/headers';
import { GET } from './route';
import { centralDb, db } from '@/lib/db';
import { createContext } from '@/lib/trpc/server';
import { canAccessTenantHealthDiagnostics } from '@/lib/auth/optimized-context';

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
    headers: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
    centralDb: { execute: jest.fn() },
    db: { execute: jest.fn() },
}));

jest.mock('@/lib/trpc/server', () => ({
    createContext: jest.fn(),
}));

jest.mock('@/lib/auth/optimized-context', () => ({
    canAccessTenantHealthDiagnostics: jest.fn(),
}));

const mockedHeaders = jest.mocked(headers);
const mockedCookies = jest.mocked(cookies);
const mockedCentralDb = jest.mocked(centralDb.execute);
const mockedDb = jest.mocked(db.execute);
const mockedCreateContext = jest.mocked(createContext);
const mockedCanAccessTenantHealthDiagnostics = jest.mocked(canAccessTenantHealthDiagnostics);

describe('GET /api/health/tenant-deep', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedHeaders.mockResolvedValue(new Headers({
            'x-tenant-id': 'tenant-id',
            'x-tenant-slug': 'acme',
            'x-tenant-schema': 'tenant_acme',
        }) as never);
        mockedCookies.mockResolvedValue({
            get: () => undefined,
        } as never);
        mockedCreateContext.mockResolvedValue({
            tenant: {
                tenantId: 'tenant-id',
                slug: 'acme',
                tenantSchema: 'tenant_acme',
                databaseUrl: 'sensitive-connection-value',
            },
        } as never);
        mockedCanAccessTenantHealthDiagnostics.mockResolvedValue(true);
    });

    it('rejects public requests before running diagnostic queries', async () => {
        mockedCanAccessTenantHealthDiagnostics.mockResolvedValue(false);

        const response = await GET({} as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Unauthorized' });
        expect(mockedDb).not.toHaveBeenCalled();
        expect(mockedCentralDb).not.toHaveBeenCalled();
    });

    it('passes the database route when proxy and selected tenant-schema counts match', async () => {
        mockedDb
            .mockResolvedValueOnce([{ current_schema: 'tenant_acme', search_path: 'tenant_acme' }] as never)
            .mockResolvedValueOnce([{ cnt: '15' }] as never);
        mockedCentralDb
            .mockResolvedValueOnce([{ cnt: '15' }] as never)
            .mockResolvedValueOnce([{ cnt: '15' }] as never);

        const response = await GET({} as never);
        const body = await response.json();

        expect(body.tests['5_asynclocalstorage_inside_run'].interpretation).not.toContain('WRONG');
        expect(body.tests['6_direct_schema_comparison']).toMatchObject({
            status: '✅ PASS — database route matches selected tenant schema',
            proxyProfiles: 15,
            tenantProfiles: 15,
            profileCountsMatch: true,
        });
        expect(body.verdict).toContain('ALL PASSED');
        expect(JSON.stringify(body)).not.toContain('sensitive-connection-value');
    });

    it('does not treat an unavailable count as a matching zero', async () => {
        mockedDb
            .mockResolvedValueOnce([{ current_schema: 'tenant_acme', search_path: 'tenant_acme' }] as never)
            .mockResolvedValueOnce([{ cnt: '0' }] as never);
        mockedCentralDb
            .mockResolvedValueOnce([{ cnt: '0' }] as never)
            .mockRejectedValueOnce(new Error('database unavailable'));

        const response = await GET({} as never);
        const body = await response.json();

        expect(body.tests['6_direct_schema_comparison'].profileCountsMatch).toBe(false);
        expect(body.tests['6_direct_schema_comparison'].status).toContain('FAIL');
        expect(body.verdict).toContain('data mismatch');
    });
});