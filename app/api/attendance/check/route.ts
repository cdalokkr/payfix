import { NextRequest, NextResponse } from 'next/server'

/**
 * Retired compatibility endpoint.
 *
 * The former implementation accepted a caller-supplied tenant, client-side
 * embedding, and optional bearer token before writing to a separate table.
 * Keeping that path available would bypass tenant context, approval, and the
 * server-issued attendance proof used by the current flow.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      code: 'LEGACY_ATTENDANCE_ROUTE_RETIRED',
      message: 'This attendance endpoint has been retired. Use authenticated biometric verification.',
    },
    { status: 410 }
  )
}