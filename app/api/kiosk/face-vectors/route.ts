import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, employeeSettings } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withTenantContext } from '@/lib/tenant/with-context';

/**
 * GET /api/kiosk/face-vectors
 * Serves cached face vectors for ALL active employees to entrance kiosks.
 * Primary source: profiles.face_embedding (128-d real face-api.js vector)
 * Fallback: employee_settings.face_vector (legacy biometric vector)
 */
export const GET = withTenantContext(async (req: NextRequest) => {
    try {
        // Auto-heal missing columns if migration wasn't executed yet
        try {
            await db.execute(sql`ALTER TABLE IF EXISTS "employee_settings" ADD COLUMN IF NOT EXISTS "face_vector" jsonb;`);
        } catch (e) { /* ignore — column already exists */ }

        let activeEmployees: any[] = [];
        try {
            activeEmployees = await db
                .select({
                    id: profiles.id,
                    full_name: profiles.full_name,
                    email: profiles.email,
                    avatar_url: profiles.avatar_url,
                    biometric_device_user_id: employeeSettings.biometric_device_user_id,
                    // Primary: real face-api.js 128-d REAL[] embedding from profiles
                    face_embedding: profiles.face_embedding,
                    // Legacy fallback: jsonb vector from employee_settings
                    face_vector: employeeSettings.face_vector,
                })
                .from(profiles)
                .leftJoin(employeeSettings, eq(profiles.id, employeeSettings.profile_id))
                .where(eq(profiles.status, 'active'));
        } catch (err: any) {
            // Fallback if face_embedding column does not exist yet
            activeEmployees = await db
                .select({
                    id: profiles.id,
                    full_name: profiles.full_name,
                    email: profiles.email,
                    avatar_url: profiles.avatar_url,
                    biometric_device_user_id: employeeSettings.biometric_device_user_id,
                    face_embedding: sql`NULL`.as('face_embedding'),
                    face_vector: employeeSettings.face_vector,
                })
                .from(profiles)
                .leftJoin(employeeSettings, eq(profiles.id, employeeSettings.profile_id))
                .where(eq(profiles.status, 'active'));
        }

        const employees = activeEmployees.map(emp => {
            // Prefer profiles.face_embedding (accurate face-api.js vector)
            // Fall back to employee_settings.face_vector (legacy)
            const faceVector: number[] | null =
                (Array.isArray(emp.face_embedding) && emp.face_embedding.length === 128)
                    ? emp.face_embedding
                    : (Array.isArray(emp.face_vector) && emp.face_vector.length > 0)
                        ? emp.face_vector
                        : null;

            return {
                id: emp.id,
                name: emp.full_name || emp.email,
                avatarUrl: emp.avatar_url || null,
                biometricUserId: emp.biometric_device_user_id || null,
                faceVector,                          // legacy compat field
                faceEmbedding: faceVector,           // preferred field for kiosk
                hasEnrolledFace: faceVector !== null,
            };
        });

        const enrolledCount = employees.filter(e => e.hasEnrolledFace).length;

        return NextResponse.json({
            success: true,
            total: employees.length,
            enrolledCount,
            employees,
        });
    } catch (err: any) {
        console.error('[Kiosk Face Vectors API] error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
});
