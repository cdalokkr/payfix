import { NextResponse } from 'next/server'

/**
 * Retired: an offline kiosk batch includes a browser-selected profile ID and
 * cannot establish who was actually in front of the camera. The paired,
 * online verification route creates attendance only after server-side 1:N
 * identification.
 */
export async function POST() {
    return NextResponse.json(
        {
            success: false,
            error: 'OFFLINE_KIOSK_PUNCHES_DISABLED',
            message: 'Capture a natural camera frame and use server-side kiosk verification.',
        },
        { status: 410 }
    )
}