import { NextResponse } from 'next/server'
import { FaceServiceClient } from '@/lib/face-service-client'

export async function GET() {
    try {
        const result = await FaceServiceClient.prewarm()
        return NextResponse.json({ ok: result.ok, latencyMs: result.latencyMs }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            }
        })
    } catch {
        return NextResponse.json({ ok: false }, { status: 200 })
    }
}
