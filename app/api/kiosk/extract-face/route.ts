import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/kiosk/extract-face
 *
 * Legacy diagnostic endpoint retired. The active kiosk path performs extraction
 * and matching server-side inside /api/kiosk/verify-face.
 */
export async function POST(_request: NextRequest) {
    return NextResponse.json({
        success: false,
        error: 'KIOSK_FACE_EXTRACTION_DISABLED',
        message: 'Face extraction is performed only inside the paired kiosk verification flow.',
    }, { status: 410 });
}
