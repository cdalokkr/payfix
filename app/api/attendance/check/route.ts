import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: 'LEGACY_ATTENDANCE_ENDPOINT_DISABLED',
      message: 'Use the authenticated 512-dimensional attendance verification flow.',
    },
    { status: 410 },
  );
}
