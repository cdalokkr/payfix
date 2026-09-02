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
        mockedCookies.mockResolvedValue({
            getAll: () => [{ name: 'sb-security-auth-token', value: 'session' }],
        } as never);
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

    it('invalidates every cached device session when a role or status changes', async () => {
        await preSeedSessionCache(user, profile);
        const firstCacheSize = getAuthPerformanceStats().cacheSize;

        invalidateUserSession(user.id);

        expect(firstCacheSize).toBeGreaterThan(0);
        expect(getAuthPerformanceStats().cacheSize).toBe(0);
    });
});