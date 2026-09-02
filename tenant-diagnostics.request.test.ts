/** @jest-environment node */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, type NextResponse } from 'next/server';
import { proxy } from './proxy';
import { GET as getTenantHealth } from './app/api/health/tenant/route';
import { GET as getTenantDeepHealth } from './app/api/health/tenant-deep/route';
import {
    TENANT_HEALTH_PROBE_TOKEN_HEADER,
} from './lib/auth/tenant-health-policy';
import { centralDb, db } from './lib/db';
import { headers, cookies } from 'next/headers';
import { resolveTenant } from './lib/tenant/resolver';
import { addSecurityHeaders, validateRequest } from './lib/proxy/security';
import { createContext } from './lib/trpc/server';

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

jest.mock('jose', () => ({
    decodeJwt: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
    centralDb: { execute: jest.fn() },
    db: { execute: jest.fn() },
}));

jest.mock('@/lib/tenant/resolver', () => ({
    resolveTenant: jest.fn(),
}));

jest.mock('@/lib/proxy/security', () => ({
    addSecurityHeaders: jest.fn((response) => response),
    validateRequest: jest.fn(() => ({ valid: true })),
}));

jest.mock('@/lib/trpc/server', () => ({
    createContext: jest.fn(),
}));

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
    headers: jest.fn(),
}));

jest.mock('@/lib/tenant/store', () => ({
    tenantStorage: {
        getStore: jest.fn(() => undefined),
        run: jest.fn((_store, callback) => callback()),
    },
}));

const mockedCreateServerClient = jest.mocked(createServerClient);
const mockedCentralDb = jest.mocked(centralDb.execute);
const mockedDb = jest.mocked(db.execute);
const mockedResolveTenant = jest.mocked(resolveTenant);
const mockedAddSecurityHeaders = jest.mocked(addSecurityHeaders);
const mockedValidateRequest = jest.mocked(validateRequest);
const mockedCreateContext = jest.mocked(createContext);
const mockedHeaders = jest.mocked(headers);
const mockedCookies = jest.mocked(cookies);

const PROBE_TOKEN = 'request-contract-probe-token';
const diagnosticHandlers = {
    '/api/health/tenant': getTenantHealth,
    '/api/health/tenant-deep': getTenantDeepHealth,
} as const;

type DiagnosticRole = 'admin' | 'super_admin';

let currentRole: DiagnosticRole | null = null;
let requestSequence = 0;
const originalProbeToken = process.env.TENANT_HEALTH_PROBE_TOKEN;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function makeRequest(
    pathname: keyof typeof diagnosticHandlers,
    headersInit: Record<string, string> = {},
): NextRequest {
    return new NextRequest(`http://localhost${pathname}`, {
        method: 'GET',
        headers: {
            host: 'localhost',
            ...headersInit,
        },
    });
}

/**
 * NextResponse.next() carries rewritten request headers in internal
 * x-middleware-* response headers. Reconstruct those headers as the request
 * the route handler receives after the proxy.
 */
function requestAfterProxy(
    response: NextResponse,
    pathname: keyof typeof diagnosticHandlers,
    sourceRequest?: NextRequest,
): NextRequest {
    const forwardedHeaders = new Headers();
    const overrideHeaders = response.headers.get('x-middleware-override-headers');

    for (const name of overrideHeaders?.split(',') ?? []) {
        const normalizedName = name.trim();
        if (!normalizedName) continue;

        const value = response.headers.get(`x-middleware-request-${normalizedName}`);
        if (value !== null) {
            forwardedHeaders.set(normalizedName, value);
        }
    }

    const sourceCookie = sourceRequest?.headers.get('cookie');
    if (sourceCookie) forwardedHeaders.set('cookie', sourceCookie);

    return new NextRequest(`http://localhost${pathname}`, {
        method: 'GET',
        headers: forwardedHeaders,
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.TENANT_HEALTH_PROBE_TOKEN = PROBE_TOKEN;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unit-test-anon-key';
    currentRole = null;

    mockedResolveTenant.mockImplementation(async (lookup) => {
        if (!currentRole) return null;
        if (lookup === 'localhost' || lookup === 'primary' || lookup === 'acme') {
            return {
                id: 'tenant-id',
                slug: 'primary',
                company_name: 'Primary',
                custom_domain: null,
                status: 'active',
                tenant_schema: 'tenant_primary',
                database_url: null,
                biometric_api_key: null,
                trial_start: new Date('2026-01-01'),
                trial_end: new Date('2026-12-31'),
                trial_duration_days: 365,
                trial_extended: false,
                admin_email: 'admin@example.com',
                license_expires_at: new Date('2026-12-31'),
                branding: null,
            } as never;
        }
        return null;
    });
    mockedValidateRequest.mockReturnValue({ valid: true });
    mockedAddSecurityHeaders.mockImplementation((response) => response);
    mockedHeaders.mockResolvedValue(new Headers({
        'x-tenant-id': 'tenant-id',
        'x-tenant-slug': 'acme',
        'x-tenant-schema': 'tenant_acme',
    }) as never);
    mockedCookies.mockResolvedValue({
        get: () => undefined,
    } as never);
    mockedCentralDb.mockResolvedValue([{
        current_schema: 'tenant_acme',
        search_path: 'tenant_acme',
        cnt: '15',
    }] as never);
    mockedDb.mockResolvedValue([{
        current_schema: 'tenant_acme',
        search_path: 'tenant_acme',
        cnt: '15',
    }] as never);
    mockedCreateContext.mockResolvedValue({
        tenant: {
            tenantId: 'tenant-id',
            slug: 'acme',
            tenantSchema: 'tenant_acme',
        },
    } as never);

    mockedCreateServerClient.mockImplementation(() => ({
        auth: {
            getUser: jest.fn().mockResolvedValue({
                data: currentRole
                    ? {
                        user: {
                            id: `user-${currentRole}`,
                            email: `${currentRole}@example.com`,
                            user_metadata: {},
                        },
                    }
                    : { user: null },
            }),
        },
        rpc: jest.fn().mockImplementation(async (name: string) => (
            name === 'find_profile_across_schemas' && currentRole
                ? {
                    data: {
                        id: `user-${currentRole}`,
                        role: currentRole,
                        status: 'active',
                        tenant_slug: 'primary',
                    },
                    error: null,
                }
                : { data: null, error: null }
        )),
        from: jest.fn(),
    }) as never);
});

afterAll(() => {
    if (originalProbeToken === undefined) {
        delete process.env.TENANT_HEALTH_PROBE_TOKEN;
    } else {
        process.env.TENANT_HEALTH_PROBE_TOKEN = originalProbeToken;
    }
    if (originalSupabaseUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseAnonKey === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
});

describe('tenant diagnostic request authorization contract', () => {
    it.each(Object.keys(diagnosticHandlers) as Array<keyof typeof diagnosticHandlers>)(
        'rejects unauthenticated requests to %s before any diagnostic query',
        async (pathname) => {
            const request = makeRequest(pathname);
            const proxyResponse = await proxy(request);

            expect(proxyResponse.status).toBe(401);
            expect(await proxyResponse.json()).toEqual({ error: 'Unauthorized' });
            expect(mockedCentralDb).not.toHaveBeenCalled();
            expect(mockedDb).not.toHaveBeenCalled();

            jest.clearAllMocks();
            const handlerResponse = await diagnosticHandlers[pathname](request);

            expect(handlerResponse.status).toBe(401);
            expect(await handlerResponse.json()).toEqual({ error: 'Unauthorized' });
            expect(mockedCentralDb).not.toHaveBeenCalled();
            expect(mockedDb).not.toHaveBeenCalled();
        },
    );

    it.each(['admin', 'super_admin'] as DiagnosticRole[])(
        'allows a %s session through the proxy and both diagnostic handlers',
        async (role) => {
            currentRole = role;

            for (const pathname of Object.keys(diagnosticHandlers) as Array<keyof typeof diagnosticHandlers>) {
                requestSequence += 1;
                const request = makeRequest(pathname, {
                    cookie: `sb-request-contract-${role}-${requestSequence}-auth-token=session`,
                });
                const proxyResponse = await proxy(request);

                expect(proxyResponse.status).toBe(200);
                const downstreamRequest = requestAfterProxy(proxyResponse, pathname, request);
                expect(downstreamRequest.headers.get('x-user-profile')).toContain(`"role":"${role}"`);

                const handlerResponse = await diagnosticHandlers[pathname](downstreamRequest);

                expect(handlerResponse.status).toBe(200);
            }
        },
    );

    it.each(Object.keys(diagnosticHandlers) as Array<keyof typeof diagnosticHandlers>)(
        'allows the configured probe token through %s without exposing it in the response',
        async (pathname) => {
            const request = makeRequest(pathname, {
                [TENANT_HEALTH_PROBE_TOKEN_HEADER]: PROBE_TOKEN,
            });
            const proxyResponse = await proxy(request);

            expect(proxyResponse.status).toBe(200);
            expect(proxyResponse.headers.get(TENANT_HEALTH_PROBE_TOKEN_HEADER)).toBeNull();

            const downstreamRequest = requestAfterProxy(proxyResponse, pathname);
            expect(downstreamRequest.headers.get(TENANT_HEALTH_PROBE_TOKEN_HEADER)).toBe(PROBE_TOKEN);

            const handlerResponse = await diagnosticHandlers[pathname](downstreamRequest);

            expect(handlerResponse.status).toBe(200);
            expect(await handlerResponse.text()).not.toContain(PROBE_TOKEN);
        },
    );

    it.each(Object.keys(diagnosticHandlers) as Array<keyof typeof diagnosticHandlers>)(
        'rejects an invalid probe token for %s before any diagnostic query',
        async (pathname) => {
            const request = makeRequest(pathname, {
                [TENANT_HEALTH_PROBE_TOKEN_HEADER]: 'not-the-configured-token',
            });
            const proxyResponse = await proxy(request);

            expect(proxyResponse.status).toBe(401);
            expect(await proxyResponse.json()).toEqual({ error: 'Unauthorized' });
            expect(mockedCentralDb).not.toHaveBeenCalled();
            expect(mockedDb).not.toHaveBeenCalled();
        },
    );
});