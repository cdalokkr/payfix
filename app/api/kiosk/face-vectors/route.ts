import { NextRequest, NextResponse } from 'next/server';
import { db, runWithTenantSchema } from '@/lib/db';
import { profiles, employeeSettings } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { KioskDeviceService } from '@/lib/services/kiosk-device.service';

function parseVector(val: unknown): number[] | null {
    if (!val) return null;
    let vec = val;
    if (typeof vec === 'string') {
        try {
            vec = JSON.parse(vec.replace(/^\[/, '[').replace(/\]$/, ']'));
        } catch {
            return null;
        }
    }
    if (Array.isArray(vec) && vec.length > 0) {
        return vec.map(v => Number(v));
    }
    return null;
}

/**
 * GET /api/kiosk/face-vectors

 * Serves cached face vectors ONLY for active employees belonging to the paired tenant workspace.
 * Requires header `x-kiosk-secret` or query parameter `pairingCode`.
 */
export async function GET(req: NextRequest) {
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

        // Execute query strictly inside the paired tenant workspace schema
        const employeesData = await runWithTenantSchema(pairingInfo.tenantSchema, async () => {
            let activeEmployees: any[] = [];
            try {
                activeEmployees = await db
                    .select({
                        id: profiles.id,
                        full_name: profiles.full_name,
                        email: profiles.email,
                        avatar_url: profiles.avatar_url,
                        biometric_device_user_id: employeeSettings.biometric_device_user_id,
                        face_embedding: profiles.face_embedding,
                        face_embedding_512: profiles.face_embedding_512,
                        face_vector: employeeSettings.face_vector,
                    })
                    .from(profiles)
                    .leftJoin(employeeSettings, eq(profiles.id, employeeSettings.profile_id))
                    .where(eq(profiles.status, 'active'));
            } catch (err: any) {
                activeEmployees = await db
                    .select({
                        id: profiles.id,
                        full_name: profiles.full_name,
                        email: profiles.email,
                        avatar_url: profiles.avatar_url,
                        biometric_device_user_id: employeeSettings.biometric_device_user_id,
                        face_embedding: sql`NULL`.as('face_embedding'),
                        face_embedding_512: sql`NULL`.as('face_embedding_512'),
                        face_vector: employeeSettings.face_vector,
                    })
                    .from(profiles)
                    .leftJoin(employeeSettings, eq(profiles.id, employeeSettings.profile_id))
                    .where(eq(profiles.status, 'active'));
            }

            return activeEmployees.map(row => {
                const faceEmbedding512 = parseVector(row.face_embedding_512);
                const faceVector = faceEmbedding512;

                return {
                    id: row.id,
                    name: row.full_name || row.email,
                    avatarUrl: row.avatar_url || null,
                    biometricUserId: row.biometric_device_user_id || null,
                    embedding: faceEmbedding512,
                    faceVector: faceEmbedding512,
                    faceEmbedding: faceEmbedding512,
                    faceEmbedding512,
                    face_embedding_512: faceEmbedding512,
                    hasEnrolledFace: faceEmbedding512 !== null && faceEmbedding512.length === 512,
                };
            });
        });

        const enrolledCount = employeesData.filter(e => e.hasEnrolledFace).length;


        return NextResponse.json({
            success: true,
            tenantSlug: pairingInfo.tenantSlug,
            device: pairingInfo.device,
            total: employeesData.length,
            enrolledCount,
            employees: employeesData,
        });

    } catch (err: any) {
        console.error('[Kiosk Face Vectors API] error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
