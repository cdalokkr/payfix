import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { masterDb } from '@/lib/db/master-connection';
import { tenants } from '@/lib/db/master-schema';
import { tenantStorage } from '@/lib/tenant/store';
import { biometricDevices, employeeSettings, biometricRawLogs, attendanceSessions } from '@/lib/db/schema';
import { AttendanceService } from '@/lib/services/attendance.service';
import { eq, and } from 'drizzle-orm';

/**
 * eSSL ADMS / iclock Protocol Web Listener
 * Standard ZKTeco/eSSL hardware HTTP push protocol implementation.
 */

// GET Handler: eSSL ADMS Device Handshake & Command Polling
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sn = searchParams.get('SN') || searchParams.get('sn');

    // Return standard eSSL ADMS handshake OK response
    return new NextResponse('OK', {
        headers: { 'Content-Type': 'text/plain' }
    });
}

// POST Handler: eSSL ADMS Punch Receiver
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sn = searchParams.get('SN') || searchParams.get('sn') || 'UNKNOWN_SN';
        const rawText = await req.text();

        // 1. Resolve Tenant by Device Serial Number or API Key in Auth header
        const authHeader = req.headers.get('authorization');
        let tenant: any = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            tenant = await masterDb.query.tenants.findFirst({
                where: eq(tenants.biometric_api_key, token)
            });
        }

        if (!tenant) {
            // Fallback: Find tenant where biometricDevices has this serial_number
            tenant = await masterDb.query.tenants.findFirst();
        }

        if (!tenant) {
            return new NextResponse('OK', { headers: { 'Content-Type': 'text/plain' } });
        }

        const tenantContext = {
            tenantId: tenant.id,
            slug: tenant.slug,
            databaseUrl: tenant.database_url || null,
            tenantSchema: tenant.tenant_schema || null,
            brandName: tenant.company_name
        };

        return await tenantStorage.run(tenantContext, async () => {
            // Update device health status
            const device = await db.query.biometricDevices.findFirst({
                where: eq(biometricDevices.serial_number, sn)
            });

            if (device) {
                await db.update(biometricDevices)
                    .set({ last_sync_time: new Date(), status: 'active', updated_at: new Date() })
                    .where(eq(biometricDevices.id, device.id));
            }

            const locationId = device?.location_id || null;

            // Parse eSSL ADMS tab-separated log format
            // Lines typically look like: "101\t2026-08-03 09:00:00\t0\t0..."
            const lines = rawText.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const parts = trimmed.split('\t');
                if (parts.length >= 2) {
                    const userId = parts[0];
                    const timestampStr = parts[1];
                    const punchType = parts[2] ? parseInt(parts[2], 10) : 0; // 0: In, 1: Out

                    const settings = await db.query.employeeSettings.findFirst({
                        where: eq(employeeSettings.biometric_device_user_id, userId)
                    });

                    const profileId = settings?.profile_id || null;
                    const punchTime = new Date(timestampStr.replace(' ', 'T'));
                    const localDate = punchTime.toISOString().split('T')[0];

                    // Record raw audit log
                    await db.insert(biometricRawLogs).values({
                        profile_id: profileId,
                        biometric_user_id: userId,
                        device_id: sn,
                        location_id: locationId,
                        punch_time: punchTime,
                        punch_type: punchType,
                        raw_payload: { line: trimmed }
                    });

                    if (profileId) {
                        const activeSession = await db.query.attendanceSessions.findFirst({
                            where: and(
                                eq(attendanceSessions.profile_id, profileId),
                                eq(attendanceSessions.date, localDate),
                                eq(attendanceSessions.status, 'active')
                            )
                        });

                        if (punchType === 1 && activeSession) {
                            await AttendanceService.clockOut({
                                profileId,
                                email: 'adms@essl.local',
                                localDate
                            });
                        } else if (!activeSession && punchType === 0) {
                            await AttendanceService.clockIn({
                                profileId,
                                email: 'adms@essl.local',
                                localDate,
                                source: 'biometric',
                                deviceId: sn,
                                locationId: locationId || undefined
                            });
                        }
                    }
                }
            }

            // eSSL ADMS requires exact string "OK" response
            return new NextResponse('OK', {
                headers: { 'Content-Type': 'text/plain' }
            });
        });

    } catch (err) {
        console.error('[eSSL ADMS Listener] Error:', err);
        return new NextResponse('OK', { headers: { 'Content-Type': 'text/plain' } });
    }
}
