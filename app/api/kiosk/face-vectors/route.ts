import { NextRequest, NextResponse } from 'next/server'

/**
 * Legacy template download endpoint. Employee embeddings must not be copied to
 * kiosk browsers; /api/kiosk/verify-face performs the search server-side.
 */
export async function GET(_request: NextRequest) {
    return NextResponse.json({
        success: false,
        error: 'KIOSK_TEMPLATE_DOWNLOAD_DISABLED',
        message: 'Employee biometric templates are retained on the server.',
    }, { status: 410 })
}