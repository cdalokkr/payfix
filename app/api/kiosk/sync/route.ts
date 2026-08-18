import { NextRequest, NextResponse } from 'next/server';
import { AttendanceService } from '@/lib/services/attendance.service';
import { db, runWithTenantSchema } from '@/lib/db';
import { attendanceSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { KioskDeviceService } from '@/lib/services/kiosk-device.service';
import { GeofenceService } from '@/lib/services/geofence.service';

interface KioskPunch {
    profileId: string;
    timestamp: string;
    punchType?: 'check_in' | 'check_out' | 'auto';
    selfieUrl?: string;
    deviceId?: string;
    locationId?: string;
    latitude?: number | null;
    longitude?: number | null;
}

/**
 * POST /api/kiosk/sync
 * Ingests single or batch offline-queued punches from Express Selfie Kiosks.
 * Requires header `x-kiosk-secret` or query parameter `pairingCode`.
 * Enforces tenant isolation and GPS Geofence boundary verification.
 */
export async function POST(req: NextRequest) {
    try {
        const kioskSecret = req.headers.get('x-kiosk-secret') || req.nextUrl.searchParams.get('pairingCode');

        if (!kioskSecret) {
            return NextResponse.json({
                error: 'UNAUTHORIZED_KIOSK_DEVICE',
                message: 'Kiosk terminal is not paired. Please pair this device using a Kiosk Pairing Key.'
            }, { status: 401 });
        }

        const pairingInfo = await KioskDeviceService.verifyPairingCode(kioskSecret);

        if (!pairingInfo) {
            return NextResponse.json({
                error: 'INVALID_PAIRING_CODE',
                message: 'Invalid or inactive Kiosk Pairing Key. Please pair device again.'
            }, { status: 401 });
        }

        const body = await req.json();
        const punches: KioskPunch[] = Array.isArray(body.punches) ? body.punches : [body];

        // Process punches inside the paired tenant workspace schema
        const result = await runWithTenantSchema(pairingInfo.tenantSchema, async () => {
            let processed = 0;
            let errors = 0;
            const errorDetails: string[] = [];
            let lastProcessedPunch: any = null;

            for (const punch of punches) {
                try {
                    const punchTime = new Date(punch.timestamp);
                    const localDate = punchTime.toISOString().split('T')[0];

                    // Geofence boundary check (if kiosk is assigned to an office location with coordinates)
                    const { device } = pairingInfo;
                    if (device.latitude !== null && device.longitude !== null && punch.latitude && punch.longitude) {
                        const distMeters = GeofenceService.calculateDistance(
                            punch.latitude,
                            punch.longitude,
                            device.latitude,
                            device.longitude
                        );

                        if (distMeters > device.radiusMeters) {
                            console.warn(`[Kiosk Sync] Geofence violation for profile ${punch.profileId}: ${distMeters}m away (radius: ${device.radiusMeters}m)`);
                            errorDetails.push(`Geofence violation: Device is ${distMeters}m away from ${device.locationName || 'office'} (max: ${device.radiusMeters}m)`);
                            errors++;
                            continue;
                        }
                    }

                    const activeSession = await db.query.attendanceSessions.findFirst({
                        where: and(
                            eq(attendanceSessions.profile_id, punch.profileId),
                            eq(attendanceSessions.date, localDate),
                            eq(attendanceSessions.status, 'active')
                        )
                    });

                    let punchAction: 'check_in' | 'check_out' = 'check_in';
                    let sessionNumber = 1;

                    if (punch.punchType === 'check_out' || (punch.punchType === 'auto' && activeSession)) {
                        punchAction = 'check_out';
                        sessionNumber = activeSession?.session_number || 1;
                        await AttendanceService.clockOut({
                            profileId: punch.profileId,
                            email: 'kiosk@device.local',
                            localDate
                        });
                    } else {
                        punchAction = 'check_in';
                        const parent = await AttendanceService.clockIn({
                            profileId: punch.profileId,
                            email: 'kiosk@device.local',
                            localDate,
                            source: 'kiosk',
                            deviceId: device.id,
                            locationId: device.locationId || undefined,
                            selfieUrl: punch.selfieUrl,
                            latitude: punch.latitude !== null && punch.latitude !== undefined ? Number(punch.latitude) : undefined,
                            longitude: punch.longitude !== null && punch.longitude !== undefined ? Number(punch.longitude) : undefined,
                        });
                        sessionNumber = parent?.total_sessions || 1;
                    }
                    processed++;
                    lastProcessedPunch = {
                        action: punchAction,
                        sessionNumber,
                        timestamp: punch.timestamp
                    };
                } catch (err: any) {
                    console.error(`[Kiosk Sync] Error processing punch for profile ${punch.profileId}:`, err);
                    errorDetails.push(err.message || 'Unknown error');
                    errors++;
                }
            }

            return { processed, errors, errorDetails, lastProcessedPunch };
        });

        return NextResponse.json({
            success: result.errors === 0,
            tenantSlug: pairingInfo.tenantSlug,
            device: pairingInfo.device,
            processed: result.processed,
            errors: result.errors,
            errorDetails: result.errorDetails,
            punchResult: result.lastProcessedPunch,
            message: `Processed ${result.processed} kiosk punches. Errors: ${result.errors}`
        });

    } catch (err: any) {
        console.error('[Kiosk Sync API] error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
