import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { masterDb } from '@/lib/db/master-connection';
import { tenants } from '@/lib/db/master-schema';
import { tenantStorage } from '@/lib/tenant/store';
import { biometricDevices, employeeSettings, biometricRawLogs, attendanceSessions } from '@/lib/db/schema';
import { AttendanceService } from '@/lib/services/attendance.service';
import { formatDateIST, parseBiometricTimestamp } from '@/lib/utils/date-utils';
import { eq, and } from 'drizzle-orm';

type AuthenticatedTenant = {
    id: string;
    slug: string;
    database_url: string | null;
    tenant_schema: string | null;
    company_name: string;
};

const textResponse = (body: string, status = 200) =>
    new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'text/plain' }
    });

async function authenticateDevice(req: NextRequest): Promise<AuthenticatedTenant | null> {
    const header = req.headers.get('authorization');
    // Do not accept a missing, malformed, or empty bearer credential.
    const match = header?.match(/^Bearer[ \t]+(\S+)$/i);
    if (!match) return null;

    const tenant = await masterDb.query.tenants.findFirst({
        where: eq(tenants.biometric_api_key, match[1])
    });
    return tenant ?? null;
}

/**
 * eSSL ADMS / iclock Protocol Web Listener
 * Standard ZKTeco/eSSL hardware HTTP push protocol implementation.
 */

// GET Handler: eSSL ADMS Device Handshake & Command Polling
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sn = searchParams.get('SN') || searchParams.get('sn');

    const tenant = await authenticateDevice(req);
    if (!tenant || !sn) return textResponse('Unauthorized', 401);

    // A valid tenant key is not sufficient: the serial must be registered in
    // that tenant's database. Never fall back to an arbitrary tenant.
    const tenantContext = {
        tenantId: tenant.id,
        slug: tenant.slug,
        databaseUrl: tenant.database_url || null,
        tenantSchema: tenant.tenant_schema || null,
        brandName: tenant.company_name,
        trusted: true,
    };
    return tenantStorage.run(tenantContext, async () => {
        const device = await db.query.biometricDevices.findFirst({
            where: eq(biometricDevices.serial_number, sn)
        });
        if (!device) return textResponse('Forbidden', 403);
        return textResponse('OK');
    });
}

// POST Handler: eSSL ADMS Punch Receiver
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sn = searchParams.get('SN') || searchParams.get('sn');

        const tenant = await authenticateDevice(req);
        if (!tenant || !sn) return textResponse('Unauthorized', 401);
        const rawText = await req.text();

        const tenantContext = {
            tenantId: tenant.id,
            slug: tenant.slug,
            databaseUrl: tenant.database_url || null,
            tenantSchema: tenant.tenant_schema || null,
            brandName: tenant.company_name,
            trusted: true,
        };

        return await tenantStorage.run(tenantContext, async () => {
            // Update device health status
            const device = await db.query.biometricDevices.findFirst({
                where: eq(biometricDevices.serial_number, sn)
            });

            if (!device) return textResponse('Forbidden', 403);

            await db.update(biometricDevices)
                .set({ last_sync_time: new Date(), status: 'active', updated_at: new Date() })
                .where(eq(biometricDevices.id, device.id));

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
                    const punchTime = parseBiometricTimestamp(timestampStr);
                    const localDate = formatDateIST(punchTime);

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
                                localDate,
                                source: 'biometric',
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
            return textResponse('OK');
        });

    } catch (err) {
        console.error('[eSSL ADMS Listener] Processing error');
        return textResponse('Internal Server Error', 500);
    }
}
