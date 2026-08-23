import { NextResponse } from 'next/server'

/**
 * Legacy browser-embedding enrollment is intentionally retired.
 * Enrollment must use the natural-portrait flow, where the Python service
 * produces the canonical portrait and normalized 512-d template server-side.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: 'LEGACY_ENROLLMENT_RETIRED',
      message: 'Face enrollment must use the secure server-verified profile photo approval flow.',
    },
    { status: 410 }
  )
}
