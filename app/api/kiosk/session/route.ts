import { NextRequest, NextResponse } from 'next/server'
import { createContext } from '@/lib/trpc/server'
import { runWithTenantSchema } from '@/lib/db'
import {
    KioskDeviceService,
    KIOSK_SESSION_COOKIE,
    KIOSK_SESSION_MAX_AGE_SECONDS,
    getKioskSessionCredential,
    toPublicKioskDevice,
} from '@/lib/services/kiosk-device.service'

const LEGACY_COOKIE_NAMES = ['payfix_kiosk_pairing_code', 'payfix_kiosk_device_info']

function clearLegacyCookies(response: NextResponse) {
    for (const name of LEGACY_COOKIE_NAMES) {
        response.cookies.set(name, '', {
            expires: new Date(0),
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
        })
    }
}

function clearSessionCookie(response: NextResponse) {
    response.cookies.set(KIOSK_SESSION_COOKIE, '', {
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    })
}

function setSessionCookie(response: NextResponse, credential: string, expiresAt: Date) {
    response.cookies.set(KIOSK_SESSION_COOKIE, credential, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: KIOSK_SESSION_MAX_AGE_SECONDS,
        expires: expiresAt,
    })
}

function getTerminalId(request: NextRequest): string | null {
    const terminalId = request.headers.get('x-kiosk-installation-id')?.trim() || ''
    return terminalId.length >= 8 && terminalId.length <= 128 ? terminalId : null
}

/**
 * Restore a kiosk using the browser-managed HttpOnly session cookie. No
 * credential is returned to page JavaScript.
 */
export async function GET(request: NextRequest) {
    try {
        const terminalId = getTerminalId(request)
        const credential = getKioskSessionCredential(request)
        const pairing = terminalId && credential
            ? await KioskDeviceService.verifySessionCredential(credential, terminalId)
            : null

        if (!pairing) {
            const response = NextResponse.json(
                { success: false, error: 'KIOSK_SESSION_INVALID', message: 'This kiosk session has expired or been revoked. Pair this terminal again.' },
                { status: 401 },
            )
            clearSessionCookie(response)
            clearLegacyCookies(response)
            return response
        }

        const response = NextResponse.json({
            success: true,
            device: toPublicKioskDevice(pairing.device),
        })
        clearLegacyCookies(response)
        return response
    } catch {
        return NextResponse.json({ success: false, error: 'KIOSK_SESSION_UNAVAILABLE' }, { status: 503 })
    }
}

/**
 * Admin-only first pairing/re-pair endpoint. The submitted pairing key is
 * exchanged immediately for a random HttpOnly session credential.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const pairingCode = typeof body.pairingCode === 'string' ? body.pairingCode.trim() : ''
        const terminalId = typeof body.terminalId === 'string' ? body.terminalId.trim() : ''
        if (pairingCode.length < 3 || terminalId.length < 8 || terminalId.length > 128) {
            return NextResponse.json({ success: false, message: 'Invalid kiosk pairing details.' }, { status: 400 })
        }

        const context = await createContext({ req: request })
        if (!context.user || !context.profile) {
            return NextResponse.json({ success: false, message: 'Only a signed-in tenant admin can pair a kiosk.' }, { status: 401 })
        }
        if (context.profile.role !== 'admin' && context.profile.role !== 'super_admin') {
            return NextResponse.json({ success: false, message: 'Only a tenant admin can pair a kiosk.' }, { status: 403 })
        }

        const existing = await KioskDeviceService.verifyPairingCode(pairingCode)
        if (!existing || !context.tenant || existing.tenantSlug !== context.tenant.slug) {
            return NextResponse.json({ success: false, message: 'Invalid or inactive pairing code for this workspace.' }, { status: 400 })
        }

        const session = await runWithTenantSchema(existing.tenantSchema, async () => {
            await KioskDeviceService.ensureSchema()
            const claimed = await KioskDeviceService.claimPairingCode(pairingCode, terminalId)
            return claimed ? KioskDeviceService.issueSessionCredential(claimed, terminalId) : null
        })
        if (!session) {
            return NextResponse.json({
                success: false,
                message: 'This pairing key is already registered to another kiosk terminal. Unpair it in Admin Settings before registering a replacement.',
            }, { status: 409 })
        }

        const response = NextResponse.json({
            success: true,
            device: toPublicKioskDevice(session.device),
        })
        setSessionCookie(response, session.credential, session.expiresAt)
        clearLegacyCookies(response)
        return response
    } catch (error) {
        console.error('[KioskSession] Pairing failed:', error)
        return NextResponse.json({ success: false, message: 'Kiosk pairing could not be completed.' }, { status: 500 })
    }
}

/**
 * Kiosk logout/revocation. Revokes the server-side credential before clearing
 * the browser cookie, so a copied request cannot continue using the session.
 */
export async function DELETE(request: NextRequest) {
    try {
        const credential = getKioskSessionCredential(request)
        const terminalId = getTerminalId(request)
        if (credential) await KioskDeviceService.revokeSessionCredential(credential, terminalId || undefined)

        const response = NextResponse.json({ success: true })
        clearSessionCookie(response)
        clearLegacyCookies(response)
        return response
    } catch {
        return NextResponse.json({ success: false, error: 'KIOSK_SESSION_UNAVAILABLE' }, { status: 503 })
    }
}