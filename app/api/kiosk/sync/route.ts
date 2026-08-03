import { NextRequest, NextResponse } from 'next/server';
import { AttendanceService } from '@/lib/services/attendance.service';
import { withTenantContext } from '@/lib/tenant/with-context';
import { db } from '@/lib/db';
import { attendanceSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface KioskPunch {
    profileId: string;
    timestamp: string;
    punchType?: 'check_in' | 'check_out' | 'auto';
    selfieUrl?: string;
    deviceId?: string;
    locationId?: string;
}

/**
 * POST /api/kiosk/sync
 * Ingests single or batch offline-queued punches from Express Selfie Kiosks.
 */
export const POST = withTenantContext(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const punches: KioskPunch[] = Array.isArray(body.punches) ? body.punches : [body];

        let processed = 0;
        let errors = 0;

        for (const punch of punches) {
            try {
                const punchTime = new Date(punch.timestamp);
                const localDate = punchTime.toISOString().split('T')[0];

                const activeSession = await db.query.attendanceSessions.findFirst({
                    where: and(
                        eq(attendanceSessions.profile_id, punch.profileId),
                        eq(attendanceSessions.date, localDate),
                        eq(attendanceSessions.status, 'active')
                    )
                });

                if (punch.punchType === 'check_out' || (punch.punchType === 'auto' && activeSession)) {
                    await AttendanceService.clockOut({
                        profileId: punch.profileId,
                        email: 'kiosk@device.local',
                        localDate
                    });
                } else {
                    await AttendanceService.clockIn({
                        profileId: punch.profileId,
                        email: 'kiosk@device.local',
                        localDate,
                        source: 'kiosk',
                        deviceId: punch.deviceId,
                        locationId: punch.locationId,
                        selfieUrl: punch.selfieUrl
                    });
                }
                processed++;
            } catch (err) {
                console.error(`[Kiosk Sync] Error processing punch for profile ${punch.profileId}:`, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${processed} kiosk punches. Errors: ${errors}`
        });

    } catch (err: any) {
        console.error('[Kiosk Sync API] error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
});
