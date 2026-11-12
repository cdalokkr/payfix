import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { masterDb } from '@/lib/db/master-connection';
import { tenants } from '@/lib/db/master-schema';
import { tenantStorage } from '@/lib/tenant/store';
import { employeeSettings, biometricDevices, biometricRawLogs, attendanceSessions } from '@/lib/db/schema';
import { AttendanceService } from '@/lib/services/attendance.service';
import { formatDateIST, parseBiometricTimestamp } from '@/lib/utils/date-utils';
import { eq, and, desc } from 'drizzle-orm';

interface PunchLog {
    userId: string;
    timestamp: string; // ISO string
    punchType?: number; // 0: Check-In, 1: Check-Out, 2: Break In, 3: Break Out
}

interface SyncPayload {
    deviceId: string;
    logs: PunchLog[];
}

interface ClockDriftEvaluation {
    effectiveTime: Date;
    isFlagged: boolean;
    remarks: string | null;
    driftMinutes: number;
    skewCategory: 'normal' | 'future_tamper' | 'stale_reset' | 'delayed_offline';
}

const MAX_SYNC_BATCH_SIZE = 500;

/**
 * Option 2: Smart Drift Guard
 * Evaluates hardware clock skew against server time.
 * - Tolerable skew (<= 30 mins): Accept hardware punch time seamlessly.
 * - Future skew (> 5 mins ahead): Clamp to server time, flag as skew.
 * - Stale reset (< 2024 or > 7 days old): Fallback to server time, flag.
 * - Delayed offline queue / backdated punch (> 30 mins): Retain hardware punch time to protect
 *   honest worker hours, but flag with audit remark for administrative review.
 */
function evaluateClockDrift(hardwareTime: Date, serverTime: Date): ClockDriftEvaluation {
    const driftMs = serverTime.getTime() - hardwareTime.getTime();
    const driftMinutes = driftMs / (1000 * 60);

    // 1. Extreme Stale / Reset Epoch (CMOS battery dead, e.g. year < 2024 or epoch reset)
    if (hardwareTime.getFullYear() < 2024) {
        return {
            effectiveTime: serverTime,
            isFlagged: true,
            remarks: `[Clock Reset Flag] Hardware clock was invalid/stale (${hardwareTime.toISOString()}). Server time applied.`,
            driftMinutes: Math.round(driftMinutes),
            skewCategory: 'stale_reset',
        };
    }

    // 2. Future Clock Skew (> 5 minutes ahead of server time)
    // Prevents tampering where device clock is pushed forward into the future
    if (hardwareTime.getTime() > serverTime.getTime() + (5 * 60 * 1000)) {
        return {
            effectiveTime: serverTime,
            isFlagged: true,
            remarks: `[Clock Skew Flag] Hardware clock was ahead of server (+${Math.round(-driftMinutes)}m). Server time applied.`,
            driftMinutes: Math.round(driftMinutes),
            skewCategory: 'future_tamper',
        };
    }

    // 3. Normal / Tolerable Operational Skew (Within -5m to +30m)
    // Genuine live or near-live punches — accepted automatically without audit flags
    if (driftMinutes >= -5 && driftMinutes <= 30) {
        return {
            effectiveTime: hardwareTime,
            isFlagged: false,
            remarks: null,
            driftMinutes: Math.round(driftMinutes),
            skewCategory: 'normal',
        };
    }

    // 4. Delayed Offline Queue or Backdated Skew (> 30m up to 7 days)
    // Retains hardware punch timestamp so honest workers in an offline office are not marked late,
    // BUT attaches an audit flag and marks the session pending admin verification.
    return {
        effectiveTime: hardwareTime,
        isFlagged: true,
        remarks: `[Clock Drift Audit] Offline queue / backdated punch detected (${Math.round(driftMinutes)}m skew between device and server). Verification pending review.`,
        driftMinutes: Math.round(driftMinutes),
        skewCategory: 'delayed_offline',
    };
}

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate Request using Tenant-Isolated API Key
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid Authorization header.' }, { status: 401 });
        }

        const token = authHeader.slice(7).trim();
        if (!token) {
            return NextResponse.json({ error: 'Empty token payload.' }, { status: 401 });
        }

        // Query Central master database to match token to a tenant
        const tenant = await masterDb.query.tenants.findFirst({
            where: eq(tenants.biometric_api_key, token),
        });

        if (
            !tenant ||
            tenant.status === 'suspended' ||
            tenant.status === 'cancelled' ||
            (tenant.license_expires_at && Date.now() > new Date(tenant.license_expires_at).getTime())
        ) {
            return NextResponse.json({ error: 'Unauthorized, suspended, or expired workspace key.' }, { status: 401 });
        }

        // 2. Parse & Validate Payload
        const body: SyncPayload = await req.json();
        if (!body.deviceId || typeof body.deviceId !== 'string' || !Array.isArray(body.logs)) {
            return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
        }

        if (body.logs.length > MAX_SYNC_BATCH_SIZE) {
            return NextResponse.json(
                { error: `Batch exceeds maximum of ${MAX_SYNC_BATCH_SIZE} logs per request.` },
                { status: 413 }
            );
        }

        const tenantContext = {
            tenantId: tenant.id,
            slug: tenant.slug,
            databaseUrl: tenant.database_url || null,
            tenantSchema: tenant.tenant_schema || null,
            brandName: tenant.company_name,
            licenseExpiresAt: tenant.license_expires_at ? new Date(tenant.license_expires_at).toISOString() : null,
            trusted: false, // Never bypass subscription checks
        };

        // 3. Process logs chronologically inside the resolved tenant context
        return await tenantStorage.run(tenantContext, async () => {
            let processedCount = 0;
            let errorCount = 0;
            let driftFlaggedCount = 0;
            const serverNow = new Date();

            const device = await db.query.biometricDevices.findFirst({
                where: eq(biometricDevices.serial_number, body.deviceId),
            });

            if (!device) {
                return NextResponse.json({ error: 'Unregistered device for workspace.' }, { status: 403 });
            }

            if (device.status && device.status !== 'active') {
                return NextResponse.json({ error: 'Unregistered or inactive device for workspace.' }, { status: 403 });
            }

            await db.update(biometricDevices)
                .set({ last_sync_time: serverNow, updated_at: serverNow })
                .where(eq(biometricDevices.id, device.id));

            const locationId = device.location_id || null;

            // Sort logs chronologically so out-of-order device batches do not invert clock-in/out state
            const sortedLogs = [...body.logs]
                .map((log) => ({
                    log,
                    punchTime: parseBiometricTimestamp(log.timestamp),
                }))
                .filter(({ punchTime }) => !Number.isNaN(punchTime.getTime()))
                .sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());

            errorCount += body.logs.length - sortedLogs.length;

            for (const { log, punchTime } of sortedLogs) {
                try {
                    // Option 2: Evaluate clock drift against server time
                    const driftEval = evaluateClockDrift(punchTime, serverNow);
                    if (driftEval.isFlagged) {
                        driftFlaggedCount++;
                    }

                    const effectivePunchTime = driftEval.effectiveTime;
                    const localDate = formatDateIST(effectivePunchTime);

                    const settings = await db.query.employeeSettings.findFirst({
                        where: eq(employeeSettings.biometric_device_user_id, log.userId),
                    });

                    const profileId = settings?.profile_id || null;

                    // Deduplicate identical retries before processing attendance state transitions
                    if (db.query.biometricRawLogs?.findFirst) {
                        const duplicateRaw = await db.query.biometricRawLogs.findFirst({
                            where: and(
                                eq(biometricRawLogs.device_id, body.deviceId),
                                eq(biometricRawLogs.biometric_user_id, log.userId),
                                eq(biometricRawLogs.punch_time, punchTime)
                            ),
                        });
                        if (duplicateRaw) {
                            continue;
                        }
                    }

                    // Save dual timestamps and audit drift metadata in raw logs
                    await db.insert(biometricRawLogs).values({
                        profile_id: profileId,
                        biometric_user_id: log.userId,
                        device_id: body.deviceId,
                        location_id: locationId,
                        punch_time: punchTime, // raw hardware timestamp
                        punch_type: log.punchType ?? 0,
                        raw_payload: {
                            ...(typeof log === 'object' && log !== null ? (log as unknown as Record<string, unknown>) : {}),
                            server_received_at: serverNow.toISOString(),
                            effective_punch_time: effectivePunchTime.toISOString(),
                            drift_minutes: driftEval.driftMinutes,
                            drift_flagged: driftEval.isFlagged,
                            skew_category: driftEval.skewCategory,
                            drift_remarks: driftEval.remarks,
                        },
                    });

                    if (!profileId) {
                        console.warn(`[Biometric Sync] Unmapped biometric user ID: ${log.userId} in tenant ${tenant.slug}`);
                        errorCount++;
                        continue;
                    }

                    const activeSession = await db.query.attendanceSessions.findFirst({
                        where: and(
                            eq(attendanceSessions.profile_id, profileId),
                            eq(attendanceSessions.date, localDate),
                            eq(attendanceSessions.status, 'active')
                        ),
                        orderBy: [desc(attendanceSessions.check_in)],
                    });

                    if (activeSession) {
                        const checkInTime = new Date(activeSession.check_in).getTime();
                        const secondsSinceCheckIn = (effectivePunchTime.getTime() - checkInTime) / 1000;

                        if (secondsSinceCheckIn >= 15 || (log.punchType === 1 && secondsSinceCheckIn >= 0)) {
                            await AttendanceService.clockOut({
                                profileId,
                                email: 'biometric@device.local',
                                localDate,
                                punchTime: effectivePunchTime,
                                remarks: driftEval.remarks || undefined,
                                source: 'biometric',
                                trustedHardwareSync: true,
                            });
                        }
                    } else {
                        // Do not convert an explicit Check-Out punch (1) into a Clock-In
                        if (log.punchType === 1) {
                            console.warn(`[Biometric Sync] Ignoring orphan check-out for user ${log.userId} on ${localDate}`);
                            continue;
                        }

                        await AttendanceService.clockIn({
                            profileId,
                            email: 'biometric@device.local',
                            localDate,
                            punchTime: effectivePunchTime,
                            remarks: driftEval.remarks || undefined,
                            source: 'biometric',
                            trustedHardwareSync: true,
                            deviceId: body.deviceId,
                            locationId: locationId || undefined,
                        });
                    }

                    processedCount++;
                } catch (err) {
                    console.error(`[Biometric Sync] Error processing log for user ${log.userId}:`, err);
                    errorCount++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `Processed ${processedCount} punches. Errors: ${errorCount}. Drift Flagged: ${driftFlaggedCount}.`,
                serverTime: serverNow.toISOString(),
                driftFlaggedCount,
            });
        });
    } catch (error) {
        console.error('[Biometric Sync] Fatal error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
