/** @jest-environment node */

const mockResponseEvents: string[] = [];

jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    const ActualNextResponse = actual.NextResponse;

    class InstrumentedNextResponse extends ActualNextResponse {
        static json(...args: any[]) {
            const response = ActualNextResponse.json(...args);
            const originalSet = Object.getPrototypeOf(response.cookies).set;
            response.cookies.set = ((...setArgs: any[]) => {
                mockResponseEvents.push(`cookie:${setArgs[0]}`);
                return originalSet.call(response.cookies, ...setArgs);
            }) as any;
            return response;
        }
    }

    return { ...actual, NextResponse: InstrumentedNextResponse };
});

jest.mock('@/lib/db', () => ({
    runWithTenantSchema: jest.fn(async (_schema: string, callback: () => Promise<unknown>) => callback()),
}));

jest.mock('@/lib/trpc/server', () => ({
    createContext: jest.fn(),
}));

jest.mock('@/lib/services/kiosk-device.service', () => ({
    KIOSK_SESSION_COOKIE: 'payfix_kiosk_session',
    KIOSK_SESSION_MAX_AGE_SECONDS: 30 * 24 * 60 * 60,
    KioskDeviceService: {
        ensureSchema: jest.fn(),
        verifyPairingCode: jest.fn(),
        claimPairingCode: jest.fn(),
        issueSessionCredential: jest.fn(),
        verifySessionCredential: jest.fn(),
        revokeSessionCredential: jest.fn(),
    },
    getKioskSessionCredential: jest.fn(),
    toPublicKioskDevice: jest.fn((device: Record<string, unknown>) => {
        const { pairingCode: _pairingCode, ...publicDevice } = device;
        return publicDevice;
    }),
}));

import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from './route';
import { createContext } from '@/lib/trpc/server';
import { KioskDeviceService, getKioskSessionCredential } from '@/lib/services/kiosk-device.service';

const mockedCreateContext = jest.mocked(createContext);
const mockedGetCredential = jest.mocked(getKioskSessionCredential);
const mockedVerifyPairingCode = jest.mocked(KioskDeviceService.verifyPairingCode);
const mockedClaimPairingCode = jest.mocked(KioskDeviceService.claimPairingCode);
const mockedIssueSessionCredential = jest.mocked(KioskDeviceService.issueSessionCredential);
const mockedVerifySessionCredential = jest.mocked(KioskDeviceService.verifySessionCredential);
const mockedRevokeSessionCredential = jest.mocked(KioskDeviceService.revokeSessionCredential);

const terminalId = 'terminal-installation-123';
const pairingCode = 'KSK-PAIR-123';
const rawCredential = 'server-only-session-credential';

const pairing = {
    device: {
        id: 'device-1',
        name: 'Front Desk',
        pairingCode,
        terminalId,
        locationId: null,
        locationName: 'Head Office',
        latitude: null,
        longitude: null,
        radiusMeters: 200,
    },
    tenantSchema: 'tenant_acme',
    tenantSlug: 'acme',
};

function makeRequest(
    method: string,
    init: { headers?: HeadersInit; body?: string } = {},
): NextRequest {
    return new NextRequest('http://localhost/api/kiosk/session', {
        method,
        headers: init.headers,
        body: init.body,
    });
}

function adminContext() {
    return {
        user: { id: 'admin-user' },
        profile: { role: 'admin' },
        tenant: { slug: 'acme' },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockResponseEvents.length = 0;
    mockedGetCredential.mockReturnValue(null);
    mockedCreateContext.mockResolvedValue(adminContext() as never);
});

describe('/api/kiosk/session pairing', () => {
    beforeEach(() => {
        mockedVerifyPairingCode.mockResolvedValue(pairing as never);
        mockedClaimPairingCode.mockResolvedValue(pairing as never);
        mockedIssueSessionCredential.mockResolvedValue({
            ...pairing,
            credential: rawCredential,
            expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        } as never);
    });

    it('exchanges a pairing key for an HttpOnly SameSite=Lax cookie without returning the credential', async () => {
        const response = await POST(makeRequest('POST', {
            body: JSON.stringify({ pairingCode, terminalId }),
            headers: { 'content-type': 'application/json' },
        }));
        const body = await response.json();
        const setCookie = response.headers.get('set-cookie') || '';

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            device: {
                id: 'device-1',
                name: 'Front Desk',
                terminalId,
                locationId: null,
                locationName: 'Head Office',
                latitude: null,
                longitude: null,
                radiusMeters: 200,
            },
        });
        expect(JSON.stringify(body)).not.toContain(rawCredential);
        expect(JSON.stringify(body)).not.toContain(pairingCode);
        expect(setCookie).toMatch(/payfix_kiosk_session=server-only-session-credential/);
        expect(setCookie).toMatch(/HttpOnly/);
        expect(setCookie).toMatch(/SameSite=lax/i);
        expect(setCookie).toMatch(/Path=\//);
        expect(setCookie).toMatch(/Max-Age=2592000/);
        expect(setCookie).toMatch(/payfix_kiosk_pairing_code=/);
        expect(setCookie).toMatch(/payfix_kiosk_device_info=/);
    });

    it('supports an explicit re-pair on the same terminal with a newly issued session', async () => {
        const replacementCode = 'KSK-REPAIR-456';
        const replacementPairing = {
            ...pairing,
            device: { ...pairing.device, pairingCode: replacementCode, name: 'Replacement Front Desk' },
        };
        mockedVerifyPairingCode.mockResolvedValue(replacementPairing as never);
        mockedClaimPairingCode.mockResolvedValue(replacementPairing as never);
        mockedIssueSessionCredential.mockResolvedValue({
            ...replacementPairing,
            credential: 'replacement-session-credential',
            expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        } as never);

        const response = await POST(makeRequest('POST', {
            body: JSON.stringify({ pairingCode: replacementCode, terminalId }),
            headers: { 'content-type': 'application/json' },
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mockedClaimPairingCode).toHaveBeenCalledWith(replacementCode, terminalId);
        expect(mockedIssueSessionCredential).toHaveBeenCalledWith(replacementPairing, terminalId);
        expect(body.device).toMatchObject({ name: 'Replacement Front Desk', terminalId });
        expect(JSON.stringify(body)).not.toContain('replacement-session-credential');
    });
});

describe('/api/kiosk/session restore', () => {
    it('restores a valid session for the matching terminal without exposing the credential', async () => {
        mockedGetCredential.mockReturnValue(rawCredential);
        mockedVerifySessionCredential.mockResolvedValue(pairing as never);

        const response = await GET(makeRequest('GET', {
            headers: { 'x-kiosk-installation-id': terminalId },
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mockedVerifySessionCredential).toHaveBeenCalledWith(rawCredential, terminalId);
        expect(body).toEqual({
            success: true,
            device: {
                id: 'device-1',
                name: 'Front Desk',
                terminalId,
                locationId: null,
                locationName: 'Head Office',
                latitude: null,
                longitude: null,
                radiusMeters: 200,
            },
        });
        expect(JSON.stringify(body)).not.toContain(rawCredential);
        expect(response.headers.get('set-cookie') || '').not.toContain('payfix_kiosk_session=');
    });

    it.each([
        ['expired', 'expired-session-credential'],
        ['revoked', 'revoked-session-credential'],
        ['deleted', 'deleted-device-session-credential'],
    ])('clears the browser session and requires re-pairing for a %s session', async (_state, credential) => {
        mockedGetCredential.mockReturnValue(credential);
        mockedVerifySessionCredential.mockResolvedValue(null);

        const response = await GET(makeRequest('GET', {
            headers: { 'x-kiosk-installation-id': terminalId },
        }));
        const body = await response.json();
        const setCookie = response.headers.get('set-cookie') || '';

        expect(response.status).toBe(401);
        expect(body).toEqual({
            success: false,
            error: 'KIOSK_SESSION_INVALID',
            message: 'This kiosk session has expired or been revoked. Pair this terminal again.',
        });
        expect(setCookie).toMatch(/payfix_kiosk_session=;/);
        expect(setCookie).toMatch(/HttpOnly/);
        expect(setCookie).toMatch(/SameSite=lax/i);
        expect(setCookie).toMatch(/payfix_kiosk_pairing_code=;/);
        expect(setCookie).toMatch(/payfix_kiosk_device_info=;/);
    });
});

describe('/api/kiosk/session logout', () => {
    it('revokes the server-side credential before clearing the session cookie', async () => {
        mockedGetCredential.mockReturnValue(rawCredential);
        mockedRevokeSessionCredential.mockImplementation(async () => {
            mockResponseEvents.push('server-hash-cleared');
            return true;
        });

        const response = await DELETE(makeRequest('DELETE', {
            headers: { 'x-kiosk-installation-id': terminalId },
        }));

        expect(response.status).toBe(200);
        expect(mockedRevokeSessionCredential).toHaveBeenCalledWith(rawCredential, terminalId);
        expect(mockResponseEvents.indexOf('server-hash-cleared')).toBeGreaterThanOrEqual(0);
        expect(mockResponseEvents.indexOf('cookie:payfix_kiosk_session'))
            .toBeGreaterThan(mockResponseEvents.indexOf('server-hash-cleared'));
        expect(response.headers.get('set-cookie') || '').toMatch(/payfix_kiosk_session=;/);
    });
});