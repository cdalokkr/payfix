import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { masterDb } from '@/lib/db/master-connection';
import { tenants } from '@/lib/db/master-schema';
import { tenantStorage } from '@/lib/tenant/store';
import { createTrustedTenantContext } from '@/lib/tenant/trusted-context';
import { employeeSettings, biometricDevices, biometricRawLogs, attendanceSessions } from '@/lib/db/schema';
import { AttendanceService } from '@/lib/services/attendance.service';
import { eq, and } from 'drizzle-orm';

interface PunchLog {
    userId: string;
    timestamp: string; // ISO string
    punchType?: number; // 0: Check-In, 1: Check-Out, 2: Break In, 3: Break Out
}

interface SyncPayload {
    deviceId: string;
    logs: PunchLog[];
}

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate Request using Tenant-Isolated API Key
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid Authorization header.' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Empty token payload.' }, { status: 401 });
        }

        // Query Central master database to match token to a tenant
        const tenant = await masterDb.query.tenants.findFirst({
            where: eq(tenants.biometric_api_key, token),
            with: { plan: true }
        });

        if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled') {
            return NextResponse.json({ error: 'Unauthorized or suspended workspace key.' }, { status: 401 });
        }

        // 2. Parse Payload
        const body: SyncPayload = await req.json();
        if (!body.deviceId || !Array.isArray(body.logs)) {
            return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
        }

        const tenantContext = createTrustedTenantContext(tenant);

        // 3. Process logs inside the resolved tenant context
        return await tenantStorage.run(tenantContext, async () => {
            let processedCount = 0;
            let errorCount = 0;

            // Fetch device record if registered to update health status & get location_id
            const device = await db.query.biometricDevices.findFirst({
                where: eq(biometricDevices.serial_number, body.deviceId)
            });

            if (device) {
                await db.update(biometricDevices)
                    .set({ last_sync_time: new Date(), status: 'active', updated_at: new Date() })
                    .where(eq(biometricDevices.id, device.id));
            }

            const locationId = device?.location_id || null;

            for (const log of body.logs) {
                try {
                    // Find profile_id for this biometric userId
                    const settings = await db.query.employeeSettings.findFirst({
                        where: eq(employeeSettings.biometric_device_user_id, log.userId),
                    });

                    const profileId = settings?.profile_id || null;
                    const punchTime = new Date(log.timestamp);
                    const localDate = punchTime.toISOString().split('T')[0];

                    // 1. Record raw audit log
                    await db.insert(biometricRawLogs).values({
                        profile_id: profileId,
                        biometric_user_id: log.userId,
                        device_id: body.deviceId,
                        location_id: locationId,
                        punch_time: punchTime,
                        punch_type: log.punchType ?? 0,
                        raw_payload: log as any
                    });

                    if (!profileId) {
                        console.warn(`[Biometric Sync] Unmapped biometric user ID: ${log.userId} in tenant ${tenant.slug}`);
                        errorCount++;
                        continue;
                    }

                    // 2. Handle session clock-in / clock-out logic
                    const activeSession = await db.query.attendanceSessions.findFirst({
                        where: and(
                            eq(attendanceSessions.profile_id, profileId),
                            eq(attendanceSessions.date, localDate),
                            eq(attendanceSessions.status, 'active')
                        )
                    });

                    if (log.punchType === 1 && activeSession) {
                        // Explicit Punch Out -> Clock out active session
                        await AttendanceService.clockOut({
                            profileId,
                            email: 'biometric@device.local',
                            localDate
                        });
                    } else if (!activeSession && (log.punchType === undefined || log.punchType === 0)) {
                        // Start new attendance session
                        await AttendanceService.clockIn({
                            profileId,
                            email: 'biometric@device.local',
                            localDate,
                            source: 'biometric',
                            deviceId: body.deviceId,
                            locationId: locationId || undefined
                        });
                    } else if (activeSession && (log.punchType === 0 || log.punchType === undefined)) {
                        // Secondary in-between punch without explicit out:
                        // Logged into biometric_raw_logs above, do NOT force clock-out automatically.
                    }

                    processedCount++;
                } catch (err) {
                    console.error(`[Biometric Sync] Error processing log for user ${log.userId}:`, err);
                    errorCount++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `Processed ${processedCount} punches. Errors: ${errorCount}.`
            });
        });

    } catch (error) {
        console.error('[Biometric Sync] Fatal error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

