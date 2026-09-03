/** @jest-environment node */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
    createOptimizedContext,
    getAuthPerformanceStats,
    invalidateAllSessions,
    invalidateUserSession,
    preSeedSessionCache,
} from './optimized-context';

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
    headers: jest.fn(),
}));

const mockedCreateServerClient = jest.mocked(createServerClient);
const mockedCookies = jest.mocked(cookies);
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const user = {
    id: 'user-security-test',
    email: 'security@example.com',
    user_metadata: {},
} as any;

const profile = {
    id: user.id,
    email: user.email,
    role: 'admin',
    status: 'active',
} as any;

function requestWithSession(): Request {
    return {
        method: 'GET',
        headers: new Headers({
            cookie: 'sb-security-auth-token=session',
        }),
    } as Request;
}

describe('optimized authentication trust boundary', () => {
    beforeEach(() => {
        invalidateAllSessions();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unit-test-anon-key';
        mockedCookies.mockResolvedValue({
            getAll: () => [{ name: 'sb-security-auth-token', value: 'session' }],
        } as never);
    });

    afterAll(() => {
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

    it('verifies a revoked session before considering a cached context', async () => {
        await preSeedSessionCache(user, profile);
        const getUser = jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Session revoked' },
        });
        mockedCreateServerClient.mockReturnValue({
            auth: { getUser },
        } as never);

        const context = await createOptimizedContext(requestWithSession());

        expect(getUser).toHaveBeenCalledTimes(1);
        expect(context.user).toBeNull();
        expect(context.profile).toBeNull();
    });

    it('writes refreshed auth cookies through the response cookie store for request contexts', async () => {
        const setCookie = jest.fn();
        let clientOptions: any;
        const getUser = jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Session expired' },
        });
        mockedCookies.mockResolvedValue({
            getAll: () => [{ name: 'sb-security-auth-token', value: 'session' }],
            set: setCookie,
        } as never);
        mockedCreateServerClient.mockImplementation((_url, _key, options) => {
            clientOptions = options;
            return { auth: { getUser } } as never;
        });

        await createOptimizedContext(requestWithSession());

        clientOptions.cookies.setAll([
            { name: 'sb-security-auth-token', value: 'refreshed-session', options: { path: '/' } },
        ]);

        expect(setCookie).toHaveBeenCalledWith(
            'sb-security-auth-token',
            'refreshed-session',
            expect.objectContaining({
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
            }),
        );
    });

    it('invalidates every cached device session when a role or status changes', async () => {
        await preSeedSessionCache(user, profile);
        const firstCacheSize = getAuthPerformanceStats().cacheSize;

        invalidateUserSession(user.id);

        expect(firstCacheSize).toBeGreaterThan(0);
        expect(getAuthPerformanceStats().cacheSize).toBe(0);
    });
});