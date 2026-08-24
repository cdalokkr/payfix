import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { KioskDeviceService } from '@/lib/services/kiosk-device.service'
import { issueLivenessChallenge } from '@/lib/liveness-challenge'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const purpose = body.purpose === 'enrollment' ? 'enrollment' : 'attendance'
        const kioskSecret = request.headers.get('x-kiosk-secret')
        if (kioskSecret) {
            const terminalId = request.headers.get('x-kiosk-installation-id') || undefined
            const pairing = await KioskDeviceService.verifyPairingCode(kioskSecret, terminalId)
            if (!pairing) return NextResponse.json({ error: 'Invalid kiosk pairing.' }, { status: 401 })
            if (purpose !== 'attendance') return NextResponse.json({ error: 'Invalid challenge purpose.' }, { status: 400 })
            return NextResponse.json(issueLivenessChallenge(pairing.device.id, purpose))
        }
        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        return NextResponse.json(issueLivenessChallenge(user.id, purpose))
    } catch (error) {
        console.error('[LivenessChallenge] Error:', error)
        return NextResponse.json({ error: 'Could not start liveness verification.' }, { status: 500 })
    }
}